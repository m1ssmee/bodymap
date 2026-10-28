// Constellation figure: a smooth signed-distance body sampled into points, plus organ volumes. Pure maths, no three.js.
import type { Region } from "./medical";

export type V3 = [number, number, number];
type Side = "left" | "right" | "both";

export function rand(seed: number) { // mulberry32: same figure on every load
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hyp = Math.hypot;
function capsule(x: number, y: number, z: number, a: V3, b: V3, ra: number, rb: number) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], px = x - a[0], py = y - a[1], pz = z - a[2];
  const h = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz)));
  return hyp(px - bx * h, py - by * h, pz - bz * h) - (ra + (rb - ra) * h);
}
function ellipsoid(x: number, y: number, z: number, c: V3, r: V3) {
  const u = (x - c[0]) / r[0], v = (y - c[1]) / r[1], w = (z - c[2]) / r[2];
  const k0 = hyp(u, v, w), k1 = hyp(u / r[0], v / r[1], w / r[2]);
  return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
}
const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

// Viewer's +x is the patient's LEFT. Limbs are defined once and mirrored via |x|.
function body(x: number, y: number, z: number) {
  const ax = Math.abs(x);
  let d = ellipsoid(x, y, z, [0, 1.56, 0.01], [0.155, 0.2, 0.18]);
  d = smin(d, capsule(x, y, z, [0, 1.42, -0.01], [0, 1.2, -0.01], 0.072, 0.08), 0.06);
  d = smin(d, ellipsoid(x, y, z, [0, 0.94, 0], [0.36, 0.3, 0.19]), 0.1);
  d = smin(d, ellipsoid(x, y, z, [0, 0.52, 0.01], [0.25, 0.3, 0.16]), 0.12);
  d = smin(d, ellipsoid(x, y, z, [0, 0.13, 0], [0.27, 0.19, 0.17]), 0.1);
  d = smin(d, capsule(ax, y, z, [0.1, 1.14, -0.01], [0.4, 1.08, -0.01], 0.085, 0.095), 0.08);
  d = smin(d, capsule(ax, y, z, [0.42, 1.04, 0], [0.52, 0.56, 0], 0.085, 0.06), 0.05);
  d = smin(d, capsule(ax, y, z, [0.52, 0.56, 0], [0.58, 0.1, 0.04], 0.058, 0.042), 0.03);
  d = smin(d, ellipsoid(ax, y, z, [0.6, -0.05, 0.05], [0.04, 0.095, 0.025]), 0.03);
  d = smin(d, capsule(ax, y, z, [0.16, 0.05, 0], [0.165, -0.8, 0.02], 0.135, 0.08), 0.08);
  d = smin(d, capsule(ax, y, z, [0.165, -0.85, 0.02], [0.15, -1.62, -0.01], 0.075, 0.048), 0.05);
  d = smin(d, ellipsoid(ax, y, z, [0.165, -1.08, -0.035], [0.07, 0.17, 0.07]), 0.06);
  d = smin(d, capsule(ax, y, z, [0.15, -1.71, -0.03], [0.16, -1.75, 0.14], 0.045, 0.035), 0.04);
  return d;
}

function surfacePoints(n: number) {
  const r = rand(7), pos: number[] = [], nor: number[] = [], e = 0.002;
  const grad = (x: number, y: number, z: number): V3 => {
    const gx = body(x + e, y, z) - body(x - e, y, z), gy = body(x, y + e, z) - body(x, y - e, z), gz = body(x, y, z + e) - body(x, y, z - e);
    const l = hyp(gx, gy, gz) || 1; return [gx / l, gy / l, gz / l];
  };
  for (let guard = 0; pos.length < n * 3 && guard < n * 300; guard++) {
    let x = -0.72 + r() * 1.44, y = -1.82 + r() * 3.64, z = -0.26 + r() * 0.52;
    let d = body(x, y, z);
    if (Math.abs(d) > 0.03) continue; // thin shell = roughly even spread over the skin
    for (let i = 0; i < 4; i++) { const g = grad(x, y, z); x -= g[0] * d; y -= g[1] * d; z -= g[2] * d; d = body(x, y, z); }
    const g = grad(x, y, z);
    pos.push(x, y, z); nor.push(...g);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor) };
}

// Join each point to a few near neighbours: the "constellation" lines.
export function plexus(pos: Float32Array, nor: Float32Array | null, maxDist: number, maxPer: number) {
  const n = pos.length / 3, grid = new Map<string, number[]>(), deg = new Uint8Array(n), lp: number[] = [], ln: number[] = [];
  const key = (i: number, dx = 0, dy = 0, dz = 0) => `${Math.floor(pos[i * 3] / maxDist) + dx},${Math.floor(pos[i * 3 + 1] / maxDist) + dy},${Math.floor(pos[i * 3 + 2] / maxDist) + dz}`;
  for (let i = 0; i < n; i++) { const k = key(i); grid.set(k, [...(grid.get(k) ?? []), i]); }
  for (let i = 0; i < n; i++) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const j of grid.get(key(i, dx, dy, dz)) ?? []) {
        if (j <= i || deg[i] >= maxPer || deg[j] >= maxPer) continue;
        if (hyp(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]) > maxDist) continue;
        deg[i]++; deg[j]++;
        lp.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
        if (nor) ln.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2], nor[j * 3], nor[j * 3 + 1], nor[j * 3 + 2]);
      }
    }
  }
  return { pos: new Float32Array(lp), nor: nor ? new Float32Array(ln) : null };
}

// Rough organ volumes (x for paired organs is the patient's left side, mirrored as needed).
const ORGANS: Partial<Record<Region, { c: V3; r: V3; paired?: boolean }[]>> = {
  brain: [{ c: [0, 1.6, -0.01], r: [0.12, 0.1, 0.13] }],
  eyes: [{ c: [0.065, 1.57, 0.15], r: [0.022, 0.018, 0.018], paired: true }],
  thyroid: [{ c: [0, 1.25, 0.05], r: [0.05, 0.025, 0.025] }],
  lungs: [{ c: [0.14, 0.96, 0], r: [0.1, 0.18, 0.11], paired: true }],
  heart: [{ c: [0.05, 0.85, 0.06], r: [0.075, 0.085, 0.065] }],
  liver: [{ c: [-0.1, 0.62, 0.04], r: [0.15, 0.075, 0.1] }],
  stomach: [{ c: [0.11, 0.56, 0.07], r: [0.085, 0.065, 0.055] }],
  pancreas: [{ c: [0.03, 0.48, 0], r: [0.12, 0.03, 0.035] }],
  kidneys: [{ c: [0.12, 0.43, -0.08], r: [0.04, 0.07, 0.04], paired: true }],
  intestines: [{ c: [0, 0.26, 0.06], r: [0.18, 0.13, 0.09] }],
  bladder: [{ c: [0, 0.02, 0.08], r: [0.06, 0.05, 0.05] }],
  spine: [{ c: [0, 0.65, -0.13], r: [0.025, 0.55, 0.025] }],
  shoulder: [{ c: [0.43, 1.06, 0], r: [0.07, 0.07, 0.07], paired: true }],
  hip: [{ c: [0.18, -0.06, 0], r: [0.07, 0.07, 0.07], paired: true }],
  knee: [{ c: [0.165, -0.83, 0.02], r: [0.075, 0.08, 0.075], paired: true }],
  bones: [{ c: [0.165, -0.4, 0], r: [0.03, 0.34, 0.03], paired: true }],
  blood: [{ c: [0, 0.6, -0.04], r: [0.03, 0.42, 0.03] }, { c: [0.53, 0.5, 0.05], r: [0.025, 0.2, 0.025] }],
};

export function organCloud(region: Region, side: Side, seed: number) {
  const r = rand(seed), pos: number[] = [];
  for (const o of ORGANS[region] ?? []) {
    const xs = !o.paired ? [o.c[0]] : side === "left" ? [Math.abs(o.c[0])] : side === "right" ? [-Math.abs(o.c[0])] : [Math.abs(o.c[0]), -Math.abs(o.c[0])];
    const count = Math.max(36, Math.min(150, Math.round(o.r[0] * o.r[1] * o.r[2] * 220000)));
    for (const cx of xs) for (let i = 0; i < count; ) {
      const u = r() * 2 - 1, v = r() * 2 - 1, w = r() * 2 - 1;
      if (u * u + v * v + w * w > 1) continue;
      pos.push(cx + u * o.r[0], o.c[1] + v * o.r[1], o.c[2] + w * o.r[2]); i++;
    }
  }
  const p = new Float32Array(pos);
  return { pos: p, lines: plexus(p, null, 0.05, 3).pos };
}

export function markerPositions(m: { region: Region; side: Side }): V3[] {
  const o = ORGANS[m.region]?.[m.region === "blood" ? 1 : 0];
  if (!o) return [];
  const [x, y, z] = o.c, front = z + o.r[2] * 0.6;
  if (!o.paired) return [[x, y, front]];
  if (m.side === "left") return [[Math.abs(x), y, front]];
  if (m.side === "right") return [[-Math.abs(x), y, front]];
  return [[Math.abs(x), y, front], [-Math.abs(x), y, front]];
}


// Built once per page load and shared; the home page warms it in the background.
let cached: { s: ReturnType<typeof surfacePoints>; l: ReturnType<typeof plexus> } | null = null;
export function figure() {
  if (!cached) { const s = surfacePoints(5200); cached = { s, l: plexus(s.pos, s.nor, 0.07, 4) }; }
  return cached;
}
