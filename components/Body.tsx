"use client";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Suspense, use, useMemo, useRef } from "react";
import * as THREE from "three";
import { SEVERITY_COLOR, type Region, type Severity } from "@/lib/medical";

export type Marker = { region: Region; side: "left" | "right" | "both"; severity: Severity };
type Organ = { id: string; region: Region; side: "left" | "right" | "none"; c: [number, number, number]; r: number; p: number[]; l: number[] };
type BodyData = { points: number[]; normals: number[]; accents: number[]; wire: { v: number[]; n: number[]; e: number[] }; organs: Organ[] };
type Shared = { uScale: { value: number }; uReveal: { value: number } };

// Built once by scripts/build-body.mjs (MakeHuman base mesh, CC0). Fetched once per visit; Overview preloads this module.
let request: Promise<BodyData> | undefined;
const loadBody = () => (request ??= fetch("/body.json").then((r) => r.json()));
if (typeof window !== "undefined") loadBody();

const INK = "#1f3a93", WIRE = "#3557c9", DUST = "#5865c9", ARTERY = "#c9506a";

// Alpha follows the viewing angle (outline dark, surfaces facing you faint), scaled by the normal's length. Sizes are in body units, so the
// figure looks the same on a phone and a big screen. uLate delays the wireframe in the entrance.
const VERT = `uniform float uSize; uniform float uScale; uniform float uAlpha; uniform float uRim; uniform float uReveal; uniform float uLate;
varying float vA;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.);
  float strength = min(1., length(normal)); // shortened normals mark areas that should never outline (the lower face)
  float rim = 1. - abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  vA = uAlpha * mix(1., .06 + .94 * pow(rim, 2.2) * strength, uRim) * clamp(uReveal * 2. - uLate, 0., 1.);
  gl_PointSize = uSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const POINT_FRAG = `uniform vec3 uColor; uniform float uSoft; varying float vA;
void main(){ float d = length(gl_PointCoord - .5) * 2.; if (d > 1.) discard;
  gl_FragColor = vec4(uColor, vA * mix(1. - smoothstep(.55, 1., d), pow(1. - d, 2.), uSoft)); }`;
const LINE_FRAG = `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); }`;

function mat(shared: Shared, kind: "points" | "lines", color: string, alpha: number, o: { rim?: boolean; size?: number; soft?: boolean; late?: number } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: kind === "points" ? POINT_FRAG : LINE_FRAG, transparent: true, depthWrite: false,
    uniforms: {
      ...shared, uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha }, uRim: { value: o.rim ? 1 : 0 },
      uSize: { value: o.size ?? 0 }, uSoft: { value: o.soft ? 1 : 0 }, uLate: { value: o.late ?? 0 },
    },
  });
}
function geo(pos: ArrayLike<number>, nor?: ArrayLike<number>) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor ?? new Float32Array(pos.length).fill(1), 3)); // shaders always read a normal
  return g;
}
const gather = (v: number[], idx: number[]) => idx.flatMap((k) => [v[k * 3], v[k * 3 + 1], v[k * 3 + 2]]); // index pairs -> line vertices
// Only the invisible organ targets take pointer input; skipping the 6k points and 7k lines keeps taps precise and cheap.
const inert = <T extends THREE.Object3D>(o: T) => { o.raycast = () => {}; return o; };

function Skin({ d, shared }: { d: BodyData; shared: Shared }) {
  const objects = useMemo(() => [
    new THREE.LineSegments(geo(gather(d.wire.v, d.wire.e), gather(d.wire.n, d.wire.e)), mat(shared, "lines", WIRE, 0.8, { rim: true, late: 0.6 })),
    new THREE.Points(geo(d.points, d.normals), mat(shared, "points", INK, 0.95, { rim: true, size: 0.011 })),
    new THREE.Points(geo(gather(d.points, d.accents), gather(d.normals, d.accents)), mat(shared, "points", INK, 0.9, { rim: true, size: 0.026, soft: true })),
  ].map(inert), [d, shared]);
  return <>{objects.map((o, i) => <primitive key={i} object={o} />)}</>;
}

function Dust({ shared }: { shared: Shared }) {
  const ref = useRef<THREE.Group>(null);
  const points = useMemo(() => {
    let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const p: number[] = [];
    for (let i = 0; i < 200; i++) { const a = rnd() * Math.PI * 2, r = 0.75 + rnd() * 0.8; p.push(Math.cos(a) * r, -1.8 + rnd() * 3.7, Math.sin(a) * r * 0.6); }
    return inert(new THREE.Points(geo(p), mat(shared, "points", DUST, 0.28, { size: 0.014, soft: true })));
  }, [shared]);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y -= dt * 0.025; });
  return <group ref={ref}><primitive object={points} /></group>;
}

// One organ as it is drawn: points, constellation lines and (when flagged) a soft halo. Alpha eases toward its target.
function OrganView({ o, color, base, shared, factor }: { o: Organ; color: string; base: number; shared: Shared; factor: (o: Organ) => number }) {
  const parts = useMemo(() => {
    const halo = base >= 1 ? inert(new THREE.Points(geo(o.c), mat(shared, "points", color, 0, { size: o.r * 2.6, soft: true }))) : null;
    return {
      points: inert(new THREE.Points(geo(o.p), mat(shared, "points", color, 0, { size: o.region === "blood" && base < 1 ? 0.008 : 0.016 }))),
      lines: inert(new THREE.LineSegments(geo(gather(o.p, o.l)), mat(shared, "lines", color, 0, { late: 0.6 }))),
      halo, targets: [0.9, 0.45, 0.16],
    };
  }, [o, color, base, shared]);
  useFrame((_, dt) => {
    const f = factor(o) * base;
    [parts.points, parts.lines, parts.halo].forEach((obj, i) => {
      if (!obj) return;
      const u = (obj.material as THREE.ShaderMaterial).uniforms.uAlpha;
      u.value += (parts.targets[i] * f - u.value) * Math.min(1, dt * 8);
    });
  });
  return <>{parts.halo && <primitive object={parts.halo} />}<primitive object={parts.lines} /><primitive object={parts.points} /></>;
}

type Spin = { angle: number; dragging: boolean; x0: number; a0: number };

function Figure({ markers, selected, onSelect, spin, caption }: {
  markers: Marker[]; selected: Region | null; onSelect: (r: Region | null) => void; spin: React.RefObject<Spin>; caption: React.RefObject<HTMLDivElement | null>;
}) {
  const d = use(loadBody());
  const group = useRef<THREE.Group>(null);
  const hovered = useRef<string | null>(null);
  const shared = useMemo<Shared>(() => ({ uScale: { value: 1 }, uReveal: { value: 0 } }), []);
  const { camera, size, gl } = useThree();

  // which organs are drawn: only those with findings, plus the arteries, always faint unless blood is flagged
  const shown = useMemo(() => {
    const out: { o: Organ; color: string; base: number; hit: boolean }[] = [];
    for (const o of d.organs) {
      const m = markers.find((m) => m.region === o.region && (m.side === "both" || o.side === "none" || o.side === m.side));
      if (m) out.push({ o, color: SEVERITY_COLOR[m.severity], base: m.severity === "normal" ? 0.6 : 1, hit: true });
      else if (o.region === "blood") out.push({ o, color: ARTERY, base: 0.22, hit: false });
    }
    return out;
  }, [d, markers]);

  const factor = (o: Organ) => (selected && o.region !== selected ? 0.3 : hovered.current === o.id ? 1.25 : 1);
  const selectedOrgan = selected ? shown.find((s) => s.o.region === selected && s.hit) : undefined;
  const v = useMemo(() => new THREE.Vector3(), []);

  /* eslint-disable react-hooks/immutability -- three.js uniforms, scratch vectors and refs are meant to change every frame */
  useFrame(({ clock }, dt) => {
    shared.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2)));
    shared.uReveal.value = Math.min(1, shared.uReveal.value + dt / 0.9);
    const s = spin.current;
    if (!s.dragging) { // idle sway; hold the front while an organ is selected; ease back after a drag
      const target = selected ? 0 : Math.sin(clock.elapsedTime * 0.35) * 0.21;
      s.angle += (target - s.angle) * Math.min(1, dt * 1.6);
    }
    if (group.current) group.current.rotation.y = s.angle;
    const el = caption.current;
    if (!el || !group.current) return;
    if (!selectedOrgan) { el.style.opacity = "0"; return; }
    v.set(...selectedOrgan.o.c).applyMatrix4(group.current.matrixWorld).project(camera);
    const x = (v.x * 0.5 + 0.5) * size.width, y = (-v.y * 0.5 + 0.5) * size.height;
    el.style.opacity = "1";
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.color = selectedOrgan.color;
    // label on the outer side of the organ; on narrow screens, the side with more room and a shorter leader line
    const row = el.firstElementChild as HTMLElement, chip = row.lastElementChild as HTMLElement, lead = row.children[1] as HTMLElement;
    const room = { left: x - 8, right: size.width - x - 8 };
    const outer = x > size.width / 2 ? "right" : "left";
    const side = room[outer] >= chip.offsetWidth + 56 ? outer : room.left > room.right ? "left" : "right";
    el.dataset.side = side;
    lead.style.width = `${Math.max(12, Math.min(56, room[side] - chip.offsetWidth))}px`;
  });
  /* eslint-enable react-hooks/immutability */

  // overlapping organs: the smallest one under the pointer wins (the heart, not the lungs around it)
  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.intersections.map((i) => i.object.userData as { id?: string; region?: Region; r: number }).filter((u) => u.region).sort((a, b) => a.r - b.r)[0];

  return (
    <group ref={group}
      onPointerMove={(e) => { const h = pick(e); hovered.current = h?.id ?? null; document.body.style.cursor = h ? "pointer" : ""; }}
      onPointerOut={() => { hovered.current = null; document.body.style.cursor = ""; }}
      onClick={(e) => { if (e.delta > 6) return; const h = pick(e); if (h?.region) { e.stopPropagation(); onSelect(h.region); } }}>
      <Skin d={d} shared={shared} />
      {shown.map((s) => <OrganView key={s.o.id} o={s.o} color={s.color} base={s.base} shared={shared} factor={factor} />)}
      {shown.filter((s) => s.hit).map((s) => (
        <mesh key={`hit-${s.o.id}`} position={s.o.c} userData={{ id: s.o.id, region: s.o.region, r: s.o.r }}>
          <sphereGeometry args={[s.o.r * 0.9, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function Body({ markers, selected, onSelect, caption }: {
  markers: Marker[]; selected: Region | null; onSelect: (r: Region | null) => void; caption?: string;
}) {
  const spin = useRef<Spin>({ angle: 0, dragging: false, x0: 0, a0: 0 });
  const captionEl = useRef<HTMLDivElement>(null);
  const end = () => { spin.current.dragging = false; };
  return (
    <div className="body-stage relative h-full w-full" style={{ touchAction: "pan-y" }}
      onPointerDown={(e) => { Object.assign(spin.current, { dragging: true, x0: e.clientX, a0: spin.current.angle }); }}
      onPointerMove={(e) => { const s = spin.current; if (s.dragging) s.angle = s.a0 + (e.clientX - s.x0) * 0.01; }}
      onPointerUp={end} onPointerCancel={end} onPointerLeave={end}>
      {/* drag turns the body left/right; vertical swipes and the wheel keep scrolling the page */}
      <Canvas camera={{ position: [0, 0, 6.1], fov: 38 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }} onPointerMissed={() => onSelect(null)}>
        <Suspense fallback={null}>
          <Dust shared={useMemo(() => ({ uScale: { value: 1600 }, uReveal: { value: 1 } }), [])} />
          <Figure markers={markers} selected={selected} onSelect={onSelect} spin={spin} caption={captionEl} />
        </Suspense>
      </Canvas>
      <div ref={captionEl} className="organ-caption" data-side="right" aria-hidden>
        <div><span className="organ-dot" /><span className="organ-lead" /><span className="organ-chip">{caption}</span></div>
      </div>
    </div>
  );
}
