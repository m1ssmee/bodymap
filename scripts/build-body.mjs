// One-time build: MakeHuman base mesh (CC0) -> public/body.json for the 3D body page.
// Run: node scripts/build-body.mjs [--preview]
// Sources are fetched once into scripts/.cache. Output is committed; nothing is downloaded at runtime.
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const CACHE = path.join(ROOT, ".cache");
const SRC = "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/";
const FILES = { obj: "3dobjs/base.obj", skel: "rigs/default.mhskel", weights: "rigs/default_weights.mhw" };
const ARM_DOWN_DEG = 80; // arms hang this far below horizontal (reference: close to the body, slightly out)
const LEGS_IN_DEG = 4.5; // MakeHuman stands with legs ~8° apart; the reference is nearly parallel
const HEIGHT = 3.6; // scene units, feet at -1.8

async function source(key) {
  const file = path.join(CACHE, path.basename(FILES[key]));
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const res = await fetch(SRC + FILES[key]);
    if (!res.ok) throw new Error(`download ${FILES[key]}: ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return fs.readFileSync(file, "utf8");
}

// ---- mesh ----
const verts = [], faces = [];
{
  let group = "";
  for (const line of (await source("obj")).split("\n")) {
    if (line.startsWith("v ")) verts.push(line.split(/\s+/).slice(1, 4).map(Number));
    else if (line.startsWith("g ")) group = line.slice(2).trim();
    else if (line.startsWith("f ") && group === "body") faces.push(line.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1));
  }
}
const skel = JSON.parse(await source("skel"));
const weights = JSON.parse(await source("weights")).weights;
const joint = (name) => {
  const ids = skel.joints[name];
  const p = [0, 0, 0];
  for (const i of ids) for (let k = 0; k < 3; k++) p[k] += verts[i][k] / ids.length;
  return new THREE.Vector3(...p);
};

// ---- pose (forward kinematics + linear blend skinning with MakeHuman's own weights) ----
// Arms down to hang by the sides, forearms straightened so the hands sit beside the thighs, legs a little closer.
const bones = skel.bones;
const children = {};
for (const [name, b] of Object.entries(bones)) (children[b.parent] ??= []).push(name);
const local = {}; // bone -> rotation about its own head, in rest space
const turn = (name, q) => {
  const h = joint(`${name}____head`);
  local[name] = new THREE.Matrix4().makeTranslation(h.x, h.y, h.z)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
    .multiply(new THREE.Matrix4().makeTranslation(-h.x, -h.y, -h.z));
};
const aroundZ = (rad) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rad);
for (const side of ["L", "R"]) {
  const s = joint(`upperarm01.${side}____head`), e = joint(`lowerarm01.${side}____head`), w = joint(`wrist.${side}____head`);
  const out = Math.sign(w.x - s.x); // +1 for the arm on +x
  // 1. straighten the forearm into the body's plane (rotations about z keep that plane, so this works in rest space)
  const f = w.clone().sub(e), flat = new THREE.Vector3(f.x, f.y, 0).setLength(f.length());
  turn(`lowerarm01.${side}`, new THREE.Quaternion().setFromUnitVectors(f.clone().normalize(), flat.clone().normalize()));
  const wrist = e.clone().add(flat); // where the wrist sits once straightened
  // 2. swing the whole arm down about the shoulder
  const below = Math.atan2(s.y - wrist.y, Math.abs(wrist.x - s.x));
  const delta = THREE.MathUtils.degToRad(ARM_DOWN_DEG) - below;
  turn(`shoulder01.${side}`, aroundZ(-out * delta * 0.2)); // a little of it in the shoulder keeps the deltoid round
  turn(`upperarm01.${side}`, aroundZ(-out * delta * 0.8));
  // 3. legs a little closer: rotate each leg about its hip so the foot moves toward the middle
  const h = joint(`upperleg01.${side}____head`);
  const legOut = Math.sign(joint(`foot.${side}____head`).x - h.x);
  turn(`upperleg01.${side}`, aroundZ(-legOut * THREE.MathUtils.degToRad(LEGS_IN_DEG)));
  console.log(`arm ${side}: ${THREE.MathUtils.radToDeg(below).toFixed(0)}° -> ${ARM_DOWN_DEG}° below horizontal`);
}
const world = {};
const walk = (name, parentM) => {
  world[name] = local[name] ? parentM.clone().multiply(local[name]) : parentM;
  for (const c of children[name] ?? []) walk(c, world[name]);
};
for (const r of children[null] ?? children["null"] ?? []) walk(r, new THREE.Matrix4());

const posed = verts.map((v) => [...v]);
{
  const acc = verts.map(() => ({ p: new THREE.Vector3(), w: 0 }));
  const tmp = new THREE.Vector3();
  for (const [bone, list] of Object.entries(weights)) {
    const M = world[bone];
    if (!M) continue;
    for (const [i, w] of list) {
      tmp.set(...verts[i]).applyMatrix4(M);
      acc[i].p.addScaledVector(tmp, w); acc[i].w += w;
    }
  }
  acc.forEach((a, i) => { // unweighted remainder stays in rest pose
    if (!a.w) return;
    const rest = new THREE.Vector3(...verts[i]).multiplyScalar(Math.max(0, 1 - a.w));
    const p = a.p.add(rest).divideScalar(Math.max(1, a.w));
    posed[i] = [p.x, p.y, p.z];
  });
}

// ---- normalise: feet at -1.8, height 3.6, centred, facing +z ----
const used = [...new Set(faces.flat())];
const box = new THREE.Box3();
for (const i of used) box.expandByPoint(new THREE.Vector3(...posed[i]));
const scale = HEIGHT / (box.max.y - box.min.y);
let zMean = 0; for (const i of used) zMean += posed[i][2] / used.length;
const norm = (p) => new THREE.Vector3((p[0] - (box.min.x + box.max.x) / 2) * scale, (p[1] - box.min.y) * scale - HEIGHT / 2, (p[2] - zMean) * scale);
const P = posed.map(norm);
const J = (name) => { // joint position in the posed, normalised body
  const ids = skel.joints[name]; const p = new THREE.Vector3();
  for (const i of ids) p.add(P[i]); return p.divideScalar(ids.length);
};

if (process.argv.includes("--landmarks") || process.argv.includes("--preview")) {
  const show = ["head____head", "head____tail", "neck01____head", "spine01____head", "spine03____head", "spine05____head", "root____head",
    "clavicle.L____head", "upperarm01.L____head", "lowerarm01.L____head", "wrist.L____head", "pelvis.L____head",
    "upperleg01.L____head", "lowerleg01.L____head", "foot.L____head", "breast.L____head", "eye.L____head"];
  for (const n of show) if (skel.joints[n]) console.log(n.padEnd(24), J(n).toArray().map((v) => v.toFixed(3)).join(" "));
}

export { P, faces, used, J, skel };

if (process.argv.includes("--preview")) {
  const pts = used.filter((_, k) => k % 3 === 0).map((i) => P[i]);
  const html = `<!doctype html><canvas id=c width=1000 height=760></canvas><script>
  const p=${JSON.stringify(pts.map((v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]))};
  const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,1000,760); g.fillStyle='rgba(30,50,150,.35)';
  for(const [x,y,z] of p){ g.fillRect(250+x*190, 380-y*190, 1.6, 1.6); g.fillRect(750+z*190, 380-y*190, 1.6, 1.6); }
  </script>`;
  fs.writeFileSync(path.join(CACHE, "preview.html"), html);
  console.log("preview: scripts/.cache/preview.html");
}
