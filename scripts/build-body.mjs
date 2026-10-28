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

// The eyelids and lips are dense, curved loops whose inner surfaces catch the outline shading: drawn as-is they make
// the face look like a mask. Points and wireframe edges inside these small zones are left out.
const faceZones = [J("eye.L____head"), J("eye.R____head")].map((c) => (p) => p.distanceTo(c) < 0.036);
const inFace = (x, y, z) => faceZones.some((f) => f(new THREE.Vector3(x, y, z)));
// The lips and chin stand out from the face, so their edges catch the outline shading and draw a ring around the
// mouth. Over the lower face the normals keep their direction but are shortened: the shader reads a normal's length
// as "outline strength", so this area stays quiet from every angle while the head's outline is untouched.
const eyeY = J("eye.L____head").y, eyeZ = J("eye.L____head").z;
const lowerFace = (x, y, z) => Math.abs(x) < 0.09 && y > eyeY - 0.24 && y < eyeY - 0.03 && z > eyeZ - 0.12;
const QUIET = 0.15;
const faceNormal = (x, y, z, n) => (lowerFace(x, y, z) ? n.map((c) => Math.round(c * QUIET * 1000) / 1000) : n);

const torsoAt = (y, halfWidth = 0.3) => { // front/back of the torso at height y (arms excluded)
  let zf = -Infinity, zb = Infinity, xl = 0;
  for (const i of used) { const v = P[i]; if (Math.abs(v.y - y) < 0.02 && Math.abs(v.x) < halfWidth) { zf = Math.max(zf, v.z); zb = Math.min(zb, v.z); xl = Math.max(xl, Math.abs(v.x)); } }
  return { front: zf, back: zb, mid: (zf + zb) / 2, depth: zf - zb, half: xl };
};

// ---- the mouth's inside: MakeHuman's body includes the cavity behind the lips. It's drawn as a dense bulb in the
// face, so faces built from vertices that sit behind the face's front surface are removed. ----
{
  const ey = J("eye.L____head").y, cell = 0.01, front = new Map();
  const box = (v) => Math.abs(v.x) < 0.08 && v.y > ey - 0.24 && v.y < ey - 0.04;
  const key = (v) => `${Math.round(v.x / cell)},${Math.round(v.y / cell)}`;
  for (const i of used) { const v = P[i]; if (box(v)) front.set(key(v), Math.max(front.get(key(v)) ?? -Infinity, v.z)); }
  const headMid = torsoAt(ey - 0.1, 0.12).mid;
  const inside = (i) => { const v = P[i]; return box(v) && v.z > headMid - 0.05 && v.z < (front.get(key(v)) ?? v.z) - 0.015; };
  const before = faces.length;
  for (let k = faces.length - 1; k >= 0; k--) if (faces[k].filter(inside).length >= 2) faces.splice(k, 1);
  console.log(`mouth interior: removed ${before - faces.length} faces`);
  used.length = 0; used.push(...new Set(faces.flat()));
}

// ---- full-detail surface ----
const remap = new Map(used.map((i, k) => [i, k]));
const pos = new Float32Array(used.length * 3);
used.forEach((i, k) => P[i].toArray(pos, k * 3));
const index = [];
for (const f of faces) for (let t = 1; t + 1 < f.length; t++) index.push(remap.get(f[0]), remap.get(f[t]), remap.get(f[t + 1]));
const full = new THREE.BufferGeometry();
full.setAttribute("position", new THREE.BufferAttribute(pos, 3));
full.setIndex(index);
full.computeVertexNormals();

// seeded random so the figure is identical on every build
let seed = 7;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const r3 = (v) => Math.round(v * 1000) / 1000, r2 = (v) => Math.round(v * 100) / 100;

// ---- 6,000 points on the skin (+ 80 larger accents) ----
const { MeshSurfaceSampler } = await import("three/addons/math/MeshSurfaceSampler.js");
const sampler = new MeshSurfaceSampler(new THREE.Mesh(full)).setRandomGenerator(rnd).build();
const points = [], pointNormals = [];
{
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  while (points.length < 6000 * 3) {
    sampler.sample(p, n); if (inFace(p.x, p.y, p.z)) continue;
    points.push(r3(p.x), r3(p.y), r3(p.z)); pointNormals.push(...faceNormal(p.x, p.y, p.z, [r2(n.x), r2(n.y), r2(n.z)]));
  }
}
const accents = Array.from({ length: 80 }, () => Math.floor(rnd() * 6000));

// ---- wireframe: simplify to ~5,000 triangles and keep the edges ----
const { SimplifyModifier } = await import("three/addons/modifiers/SimplifyModifier.js");
const { mergeVertices } = await import("three/addons/utils/BufferGeometryUtils.js");
const t0 = Date.now();
const plain = new THREE.BufferGeometry().setAttribute("position", full.getAttribute("position").clone());
plain.setIndex(index.slice());
const merged = mergeVertices(plain, 1e-4);
const simple = await new SimplifyModifier().modify(merged, Math.max(0, merged.getAttribute("position").count - 2600));
simple.computeVertexNormals();
const sp = simple.getAttribute("position"), sn = simple.getAttribute("normal");
const wireVerts = [], wireNormals = [];
for (let i = 0; i < sp.count; i++) {
  wireVerts.push(r3(sp.getX(i)), r3(sp.getY(i)), r3(sp.getZ(i)));
  wireNormals.push(...faceNormal(sp.getX(i), sp.getY(i), sp.getZ(i), [r2(sn.getX(i)), r2(sn.getY(i)), r2(sn.getZ(i))]));
}
const si = simple.getIndex();
const tri = si ? si.array : Array.from({ length: sp.count }, (_, i) => i);
const uses = new Map(); // edge -> how many triangles share it
for (let t = 0; t < tri.length; t += 3) for (const [a, b] of [[tri[t], tri[t + 1]], [tri[t + 1], tri[t + 2]], [tri[t + 2], tri[t]]]) {
  const k = a < b ? `${a},${b}` : `${b},${a}`;
  uses.set(k, (uses.get(k) ?? 0) + 1);
}
// edges on only one triangle would outline holes in the mesh; edges in the face zones are dropped too
const edges = [...uses].filter(([, n]) => n > 1).map(([k]) => k.split(",").map(Number))
  .filter((e) => !e.some((i) => inFace(sp.getX(i), sp.getY(i), sp.getZ(i)))).flat();
console.log(`wireframe: ${tri.length / 3} triangles, ${sp.count} vertices, ${edges.length / 2} edges (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

// ---- landmarks: joints + torso depth at a given height ----
const L = (n) => J(`${n}____head`);

if (process.argv.includes("--landmarks")) {
  for (const n of ["head", "neck01", "neck03", "spine01", "spine02", "spine03", "spine04", "spine05", "root", "clavicle.L", "upperarm01.L", "lowerarm01.L", "wrist.L",
    "upperleg01.L", "lowerleg01.L", "foot.L", "eye.L", "jaw"]) if (skel.joints[`${n}____head`]) console.log(n.padEnd(14), L(n).toArray().map((v) => v.toFixed(3)).join(" "));
  for (const y of [1.25, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0]) { const t = torsoAt(y); console.log(`torso y=${y.toFixed(2)}  front ${t.front.toFixed(3)} back ${t.back.toFixed(3)} half-width ${t.half.toFixed(3)}`); }
}

// ---- organs, joints, bones and arteries, placed from the skeleton's own landmarks ----
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Z = V(0, 0, 1);
const ell = (c, r, rotZ = 0) => (p) => { const d = p.clone().sub(c); if (rotZ) d.applyAxisAngle(Z, -rotZ); return (d.x / r.x) ** 2 + (d.y / r.y) ** 2 + (d.z / r.z) ** 2 <= 1; };
const volume = (n, c, half, test) => { // n points spread evenly inside a shape
  const out = [];
  for (let guard = 0; out.length < n && guard < n * 2000; guard++) {
    const p = V(c.x + (rnd() * 2 - 1) * half.x, c.y + (rnd() * 2 - 1) * half.y, c.z + (rnd() * 2 - 1) * half.z);
    if (test(p)) out.push(p);
  }
  return out;
};
const plexus = (pts, maxDist, maxPer = 3) => { // join near neighbours: the constellation texture
  const deg = new Uint8Array(pts.length), idx = [];
  for (let i = 0; i < pts.length; i++) {
    const near = pts.map((q, j) => [j, pts[i].distanceTo(q)]).filter(([j, d]) => j > i && d < maxDist).sort((a, b) => a[1] - b[1]);
    for (const [j] of near) { if (deg[i] >= maxPer) break; if (deg[j] >= maxPer) continue; deg[i]++; deg[j]++; idx.push(i, j); }
  }
  return idx;
};
const chain = (pts) => pts.slice(1).flatMap((_, i) => [i, i + 1]);
const curve = (ctrl, step = 0.016) => { const c = new THREE.CatmullRomCurve3(ctrl); return c.getSpacedPoints(Math.max(2, Math.round(c.getLength() / step))); };
const ringAround = (center, axis, radius, n) => { // circle in the plane perpendicular to axis
  const a = axis.clone().normalize(), u = new THREE.Vector3().crossVectors(a, Math.abs(a.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0)).normalize(), w = new THREE.Vector3().crossVectors(a, u);
  return Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return center.clone().addScaledVector(u, Math.cos(t) * radius).addScaledVector(w, Math.sin(t) * radius); });
};
const organs = [];
const add = (id, region, side, pts, lines, center) => {
  const c = center ?? pts.reduce((a, p) => a.add(p), V(0, 0, 0)).divideScalar(pts.length);
  const r = Math.max(0.06, ...pts.map((p) => p.distanceTo(c))) * 0.85;
  organs.push({ id, region, side, c: c.toArray().map(r3), r: r3(r), p: pts.flatMap((p) => p.toArray().map(r3)), l: lines });
};
const mid = (y) => torsoAt(y).mid, front = (y) => torsoAt(y).front, back = (y) => torsoAt(y).back;
const mirror = (v, side) => V(side === "left" ? Math.abs(v.x) : -Math.abs(v.x), v.y, v.z);
const SIDES = [["left", "L"], ["right", "R"]];

// chest
const heartC = V(0.04, 0.8, mid(0.8) + 0.05), heartR = V(0.075, 0.095, 0.065), heartTilt = -0.55;
for (const [side] of SIDES) {
  const c = mirror(V(0.15, 0.86, mid(0.86)), side), r = V(0.125, 0.27, 0.155);
  const notch = ell(heartC, heartR.clone().multiplyScalar(1.3), heartTilt);
  const lung = volume(300, c, r, (p) => {
    const ty = Math.max(0, (p.y - c.y) / r.y); // narrower towards the top
    const q = V(c.x + (p.x - c.x) / (1 - 0.45 * ty), p.y, p.z);
    return ell(c, r)(q) && p.y > 0.62 + 0.04 * Math.abs(p.x) && !(side === "left" && notch(p));
  });
  add(`lungs.${side}`, "lungs", side, lung, plexus(lung, 0.07));
}
const heart = volume(170, heartC, V(0.11, 0.11, 0.08), ell(heartC, heartR, heartTilt));
add("heart", "heart", "none", heart, plexus(heart, 0.05), heartC);

// abdomen
{
  const c = V(-0.06, 0.6, mid(0.6) + 0.01), r = V(0.15, 0.085, 0.11);
  const liver = volume(230, c, r, (p) => { const t = (p.x - (c.x - r.x)) / (2 * r.x); return ell(c, V(r.x, r.y * (1.15 - 0.75 * t), r.z))(p); }); // thick on the right, thin on the left
  add("liver", "liver", "none", liver, plexus(liver, 0.06));
  const z = mid(0.55) + 0.04;
  const parts = [ell(V(0.105, 0.61, z - 0.02), V(0.055, 0.05, 0.05)), ell(V(0.08, 0.535, z), V(0.05, 0.07, 0.045), 0.35), ell(V(0.025, 0.475, z + 0.02), V(0.05, 0.03, 0.035), -0.2)];
  const stomach = volume(150, V(0.07, 0.54, z), V(0.11, 0.11, 0.08), (p) => parts.some((f) => f(p)));
  add("stomach", "stomach", "none", stomach, plexus(stomach, 0.05));
  const pc = V(0.025, 0.49, mid(0.49) - 0.03);
  const pancreas = volume(80, pc, V(0.11, 0.04, 0.03), ell(pc, V(0.1, 0.022, 0.025), 0.18));
  add("pancreas", "pancreas", "none", pancreas, plexus(pancreas, 0.045));
}
for (const [side] of SIDES) {
  const c = mirror(V(0.085, side === "left" ? 0.48 : 0.455, back(0.47) + 0.075), side);
  const hilum = V(c.x * 0.55, c.y, c.z); // bean: a dent on the inner side
  const kidney = volume(80, c, V(0.06, 0.11, 0.05), (p) => ell(c, V(0.045, 0.095, 0.038))(p) && p.distanceTo(hilum) > 0.045);
  add(`kidneys.${side}`, "kidneys", side, kidney, plexus(kidney, 0.045));
}
{
  const z = mid(0.3) + 0.05, small = [], large = [];
  { // small intestine: a smooth wandering path that stays inside the lower abdomen, so it reads as coiled loops
    const lo = V(-0.105, 0.19, z - 0.035), hi = V(0.105, 0.4, z + 0.035);
    let p = V(-0.09, 0.38, z), heading = 0;
    const ctrl = [];
    for (let k = 0; k < 120; k++) {
      heading += (rnd() - 0.5) * 1.1;
      const step = V(Math.cos(heading), Math.sin(heading), Math.sin(heading * 1.7) * 0.6).multiplyScalar(0.022);
      const next = p.clone().add(step);
      if (next.x < lo.x || next.x > hi.x) { heading = Math.PI - heading; continue; }
      if (next.y < lo.y || next.y > hi.y) { heading = -heading; continue; }
      next.z = Math.min(hi.z, Math.max(lo.z, next.z));
      ctrl.push(p = next);
    }
    small.push(...curve(ctrl, 0.01));
  }
  const colon = curve([V(-0.12, 0.17, z), V(-0.14, 0.3, z), V(-0.13, 0.44, z), V(0, 0.45, z + 0.02), V(0.13, 0.44, z), V(0.14, 0.3, z), V(0.12, 0.17, z), V(0.03, 0.13, z - 0.02)], 0.012);
  large.push(...colon);
  add("intestines", "intestines", "none", [...small, ...large], [...chain(small), ...chain(large).map((i) => i + small.length)]);
  const bc = V(0, 0.12, front(0.12) - 0.07);
  const bladder = volume(70, bc, V(0.05, 0.045, 0.045), ell(bc, V(0.045, 0.04, 0.04)));
  add("bladder", "bladder", "none", bladder, plexus(bladder, 0.04));
}

// head and neck
{
  const head = torsoAt(1.66, 0.15);
  const bc = V(0, 1.665, head.mid - 0.01), br = V(0.098, 0.085, head.depth * 0.42);
  const brain = volume(280, bc, br, (p) => ell(bc, br)(p) && Math.abs(p.x) > 0.006);
  add("brain", "brain", "none", brain, plexus(brain, 0.05));
  for (const [side, s] of SIDES) {
    const e = L(`eye.${s}`), eye = ringAround(e, V(0, 0, 1), 0.02, 18).concat(ringAround(e, V(0, 1, 0), 0.02, 18));
    add(`eyes.${side}`, "eyes", side, eye, [...chain(eye.slice(0, 18)), 17, 0, ...chain(eye.slice(18)).map((i) => i + 18), 35, 18], e);
  }
  const nz = front(1.2) - 0.03;
  const lobes = [ell(V(0.028, 1.19, nz), V(0.018, 0.032, 0.015)), ell(V(-0.028, 1.19, nz), V(0.018, 0.032, 0.015)), ell(V(0, 1.175, nz + 0.005), V(0.022, 0.009, 0.01))];
  const thyroid = volume(60, V(0, 1.185, nz), V(0.05, 0.04, 0.02), (p) => lobes.some((f) => f(p)));
  add("thyroid", "thyroid", "none", thyroid, plexus(thyroid, 0.03));
}

// spine, joints, bones
{
  const path = curve(["neck03", "neck01", "spine01", "spine02", "spine03", "spine04", "spine05"].map((n) => L(n)), 0.036);
  const pts = [], lines = [];
  path.forEach((c, i) => {
    const ring = ringAround(c, i + 1 < path.length ? path[i + 1].clone().sub(c) : c.clone().sub(path[i - 1]), 0.02, 8);
    const base = pts.length; pts.push(...ring);
    for (let k = 0; k < 8; k++) lines.push(base + k, base + ((k + 1) % 8));
    if (i) lines.push(base - 8, base);
  });
  add("spine", "spine", "none", pts, lines);
}
for (const [side, s] of SIDES) {
  const joints = [
    ["shoulder", L(`upperarm01.${s}`), L(`lowerarm01.${s}`), 0.065],
    ["hip", L(`upperleg01.${s}`), L(`lowerleg01.${s}`), 0.075],
    ["knee", L(`lowerleg01.${s}`), L(`foot.${s}`), 0.065],
  ];
  for (const [region, at, toward, radius] of joints) {
    const outer = ringAround(at, V(0, 0, 1), radius, 28), inner = ringAround(at, toward.clone().sub(at).normalize().add(V(0, 0, 1)), radius * 0.8, 20);
    add(`${region}.${side}`, region, side, [...outer, ...inner], [...chain(outer), 27, 0, ...chain(inner).map((i) => i + 28), 47, 28], at);
  }
  const femur = curve([L(`upperleg01.${s}`), L(`lowerleg01.${s}`)], 0.03);
  add(`bones.${side}`, "bones", side, femur, chain(femur));
}

// arteries ("blood"): aorta from the heart, down both legs and arms, up the neck
{
  const sz = (y) => { const sp = ["spine01", "spine02", "spine03", "spine04"].map((n) => L(n)); const near = sp.reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a)); return near.z + 0.06; };
  const aorta = curve([V(0.02, 0.85, heartC.z), V(0.0, 0.97, mid(0.97)), V(0.03, 0.95, sz(0.95)), V(0.025, 0.75, sz(0.75)), V(0.02, 0.5, sz(0.5)), V(0.01, 0.24, sz(0.24))]);
  const lines = [], pts = [];
  const push = (seg) => { const base = pts.length; pts.push(...seg); lines.push(...chain(seg).map((i) => i + base)); };
  push(aorta);
  for (const [side, s] of SIDES) {
    const hip = L(`upperleg01.${s}`), knee = L(`lowerleg01.${s}`), foot = L(`foot.${s}`), sh = L(`upperarm01.${s}`), el = L(`lowerarm01.${s}`), wr = L(`wrist.${s}`);
    const out = side === "left" ? 1 : -1;
    push(curve([V(0.01, 0.24, sz(0.24)), V(out * 0.08, 0.14, hip.z + 0.03), V(hip.x * 0.75, 0.0, front(0.0) - 0.06), V(hip.x * 0.95 + (knee.x - hip.x) * 0.5, (hip.y + knee.y) / 2, (hip.z + knee.z) / 2 + 0.02), V(knee.x * 0.95, knee.y, knee.z - 0.03), V(foot.x * 0.92, foot.y + 0.08, foot.z)]));
    const inward = (v, d) => V(v.x - out * d, v.y, v.z + 0.02);
    push(curve([V(0.0, 0.97, mid(0.97)), V(out * 0.12, 1.03, mid(1.03)), inward(sh, 0.045).setY(sh.y - 0.06), inward(el, 0.03), inward(wr, 0.02).setY(wr.y + 0.03)]));
    push(curve([V(out * 0.02, 0.98, mid(0.98)), V(out * 0.035, 1.2, front(1.2) - 0.06), V(out * 0.045, 1.42, L("jaw").z - 0.03)]));
  }
  add("blood", "blood", "none", pts, lines, heartC);
}
console.log(`organs: ${organs.map((o) => `${o.id}(${o.p.length / 3})`).join(" ")}`);

// ---- write ----
const out = { v: 1, points, normals: pointNormals, accents, wire: { v: wireVerts, n: wireNormals, e: edges }, organs };
fs.writeFileSync(path.join(ROOT, "..", "public", "body.json"), JSON.stringify(out));
console.log(`public/body.json: ${(fs.statSync(path.join(ROOT, "..", "public", "body.json")).size / 1024).toFixed(0)} KB`);

if (process.argv.includes("--preview")) { // front + side view: skin points grey, wireframe blue, organs coloured
  const html = `<!doctype html><canvas id=c width=1200 height=900></canvas><script>
  const d=${JSON.stringify(out)}; const g=c.getContext('2d'); g.fillStyle='#f4f3fb'; g.fillRect(0,0,1200,900);
  const S=230, views=[[300,(x,y,z)=>[x,y]],[900,(x,y,z)=>[z,y]]];
  const col={lungs:'#3a7',heart:'#d33',liver:'#a52',stomach:'#c80',pancreas:'#c5a',kidneys:'#93c',intestines:'#b86',bladder:'#39c',brain:'#e59',eyes:'#06c',thyroid:'#0aa',spine:'#555',shoulder:'#777',hip:'#777',knee:'#777',bones:'#999',blood:'#c36'};
  for(const [ox,f] of views){
    g.strokeStyle='rgba(31,58,147,.18)'; g.lineWidth=.6; const w=d.wire.v;
    for(let i=0;i<d.wire.e.length;i+=2){const a=d.wire.e[i]*3,b=d.wire.e[i+1]*3; const [x1,y1]=f(w[a],w[a+1],w[a+2]), [x2,y2]=f(w[b],w[b+1],w[b+2]); g.beginPath(); g.moveTo(ox+x1*S,450-y1*S); g.lineTo(ox+x2*S,450-y2*S); g.stroke();}
    for(const o of d.organs){ g.strokeStyle=col[o.region]; g.fillStyle=col[o.region]; g.lineWidth=.7; const p=o.p;
      for(let i=0;i<o.l.length;i+=2){const a=o.l[i]*3,b=o.l[i+1]*3; const [x1,y1]=f(p[a],p[a+1],p[a+2]),[x2,y2]=f(p[b],p[b+1],p[b+2]); g.beginPath(); g.moveTo(ox+x1*S,450-y1*S); g.lineTo(ox+x2*S,450-y2*S); g.stroke();}
      for(let i=0;i<p.length;i+=3){const [x,y]=f(p[i],p[i+1],p[i+2]); g.fillRect(ox+x*S-1,450-y*S-1,2,2);} }
  }</script>`;
  fs.writeFileSync(path.join(CACHE, "preview.html"), html);
  console.log("preview: scripts/.cache/preview.html");
}
