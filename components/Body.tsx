"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SEVERITY_COLOR, type Region, type Severity } from "@/lib/medical";
import { figure, markerPositions, organCloud, plexus, rand, type V3 } from "@/lib/figure";

export { markerPositions };

// warm the geometry as soon as this chunk arrives (the home page preloads it)
if (typeof window !== "undefined") (window.requestIdleCallback ?? setTimeout)(() => figure());

export type Marker = { region: Region; side: "left" | "right" | "both"; severity: Severity };
// ---------- materials ----------
const POINT_VERT = `uniform float uSize; uniform float uPR; uniform float uAlpha; uniform float uRim; varying float vA;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.);
  float rim = 1. - abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  vA = uAlpha * mix(1., .08 + .92 * pow(rim, 2.4), uRim);
  gl_PointSize = uSize * uPR * (5. / -mv.z); gl_Position = projectionMatrix * mv; }`;
const POINT_FRAG = `uniform vec3 uColor; varying float vA;
void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(uColor, pow(1. - d * 2., 1.5) * vA); }`;
const LINE_VERT = `uniform float uAlpha; uniform float uRim; varying float vA;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.);
  float rim = 1. - abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  vA = uAlpha * mix(1., .05 + .95 * pow(rim, 2.), uRim); gl_Position = projectionMatrix * mv; }`;
const LINE_FRAG = `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); }`;

function makeMat(vert: string, frag: string, color: string, alpha: number, rim: boolean, size = 0) {
  return new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha }, uRim: { value: rim ? 1 : 0 }, uSize: { value: size }, uPR: { value: 1 } },
  });
}
function geo(pos: Float32Array, nor?: Float32Array | null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor ?? new Float32Array(pos.length).fill(1), 3));
  return g;
}

// Ink on the light page: a blueprint-like figure, organs in the site's own severity colours.
const FIGURE = "#1f3a93";

function Figure() {
  const { gl } = useThree();
  const parts = useMemo(() => {
    const { s, l } = figure();
    const pr = gl.getPixelRatio();
    const pm = makeMat(POINT_VERT, POINT_FRAG, FIGURE, 0.95, true, 2.6); pm.uniforms.uPR.value = pr;
    return { points: new THREE.Points(geo(s.pos, s.nor), pm), lines: new THREE.LineSegments(geo(l.pos, l.nor), makeMat(LINE_VERT, LINE_FRAG, "#3557c9", 0.55, true)) };
  }, [gl]);
  return <><primitive object={parts.lines} /><primitive object={parts.points} /></>;
}

function Dust() {
  const ref = useRef<THREE.Group>(null);
  const { gl } = useThree();
  const parts = useMemo(() => {
    const r = rand(11), pos: number[] = [];
    for (let i = 0; i < 260; i++) { const a = r() * Math.PI * 2, rad = 0.8 + r() * 1.1; pos.push(Math.cos(a) * rad, -1.9 + r() * 3.9, Math.sin(a) * rad * 0.7); }
    const p = new Float32Array(pos);
    const pm = makeMat(POINT_VERT, POINT_FRAG, "#5865c9", 0.3, false, 1.5); pm.uniforms.uPR.value = gl.getPixelRatio();
    return { points: new THREE.Points(geo(p), pm), lines: new THREE.LineSegments(geo(plexus(p, null, 0.42, 2).pos), makeMat(LINE_VERT, LINE_FRAG, "#5865c9", 0.04, false)) };
  }, [gl]);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y -= dt * 0.03; });
  return <group ref={ref}><primitive object={parts.lines} /><primitive object={parts.points} /></group>;
}

function Organ({ m, dim }: { m: Marker; dim: boolean }) {
  const { gl } = useThree();
  const parts = useMemo(() => {
    const c = organCloud(m.region, m.side, [...m.region + m.side].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7)), color = SEVERITY_COLOR[m.severity];
    const pm = makeMat(POINT_VERT, POINT_FRAG, color, 0.9, false, 2.8); pm.uniforms.uPR.value = gl.getPixelRatio();
    return { points: new THREE.Points(geo(c.pos), pm), lines: new THREE.LineSegments(geo(c.lines), makeMat(LINE_VERT, LINE_FRAG, color, 0.4, false)) };
  }, [m.region, m.side, m.severity, gl]);
  useFrame(() => {
    for (const o of [parts.points, parts.lines]) {
      const u = (o.material as THREE.ShaderMaterial).uniforms.uAlpha;
      u.value += ((dim ? 0.2 : o === parts.points ? 0.9 : 0.4) - u.value) * 0.15;
    }
  });
  return <><primitive object={parts.lines} /><primitive object={parts.points} /></>;
}

function Node({ at, m, selected, onSelect }: { at: V3; m: Marker; selected: boolean; onSelect: () => void }) {
  const ring = useRef<THREE.Mesh>(null);
  const color = SEVERITY_COLOR[m.severity];
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = (clock.elapsedTime * 0.7) % 1;
    ring.current.scale.setScalar(1 + t * 2.2);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t);
  });
  return (
    <group position={at}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "")}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>
      <mesh scale={selected ? 1.7 : 1} renderOrder={3}>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial color={color} depthTest={false} toneMapped={false} />
      </mesh>
      <Billboard>
        <mesh ref={ring} renderOrder={3}>
          <ringGeometry args={[0.035, 0.042, 48]} />
          <meshBasicMaterial color={color} transparent depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

export default function Body({ markers, selected, onSelect }: { markers: Marker[]; selected: Region | null; onSelect: (r: Region | null) => void }) {
  return (
    <Canvas camera={{ position: [0, -0.05, 5.7], fov: 38 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}
      onPointerMissed={() => onSelect(null)} style={{ touchAction: "pan-y" }}>
      <Dust />
      <Figure />
      {markers.map((m) => <Organ key={`${m.region}-${m.side}`} m={m} dim={!!selected && selected !== m.region} />)}
      {markers.flatMap((m) => markerPositions(m).map((at, i) => (
        <Node key={`${m.region}-${m.side}-${i}`} at={at} m={m} selected={selected === m.region} onSelect={() => onSelect(m.region)} />
      )))}
      {/* turn left/right only, no zoom: the wheel and vertical swipes keep scrolling the page */}
      <OrbitControls enablePan={false} enableZoom={false} autoRotate={!selected} autoRotateSpeed={0.7}
        minPolarAngle={Math.PI / 2} maxPolarAngle={Math.PI / 2} />
    </Canvas>
  );
}
