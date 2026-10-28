"use client";
import { useT, type Level, type Strings, type Trend } from "@/lib/i18n";
import { level } from "@/lib/medical";

const ZONE = { healthy: "#2f9e6e", little: "#d18a14", far: "#d4483b" };
export const LEVEL_COLOR: Record<Level, string> = { healthy: ZONE.healthy, littleHigh: ZONE.little, littleLow: ZONE.little, high: ZONE.far, low: ZONE.far };
const TREND_COLOR: Record<Trend, string> = { better: ZONE.healthy, worse: ZONE.far, steady: "", first: "" };

export const rangeText = (t: Strings, lowIn: number | null, high: number | null, unit: string, low = lowIn || null) =>
  low !== null && high !== null ? t.range.between(low, high, unit) : high !== null ? t.range.below(high, unit) : low !== null ? t.range.above(low, unit) : t.range.none;

export const LevelWord = ({ v, low, high, className = "" }: { v: number; low: number | null; high: number | null; className?: string }) => {
  const t = useT(), l = level(v, low, high);
  return <span className={`font-medium ${className}`} style={{ color: LEVEL_COLOR[l] }}>{t.level[l]}</span>;
};

export const TrendWord = ({ trend }: { trend: Trend }) => {
  const t = useT();
  // words only: an arrow pointing down next to a number that went up is exactly the confusion we avoid
  return <span className="font-medium" style={TREND_COLOR[trend] ? { color: TREND_COLOR[trend] } : undefined}>{t.trend[trend]}</span>;
};

// Zones in words (Low · A little low · Healthy · A little high · High), each the same width so every label fits,
// with "You" placed proportionally inside its zone and earlier readings as faint dots.
// "A little" is up to 25% past the limit, the same rule as level().
export function ZoneBar({ value, low: lowIn, high, history = [], label, words = true }: {
  value: number; low: number | null; high: number | null; history?: number[]; label: string; words?: boolean;
}) {
  const t = useT();
  const low = lowIn || null; // a printed lower limit of 0 is no lower limit
  const vals = [value, ...history];
  const top = Math.max(...vals, high !== null ? high * 1.6 : (low ?? 1) * 2) * 1.02;
  const floor = Math.min(...vals, low !== null ? low * 0.5 : 0) * 0.98;
  const zones: { from: number; to: number; kind: keyof typeof ZONE; name: string; w: number }[] = [];
  if (low !== null) zones.push({ from: floor, to: low * 0.75, kind: "far", name: t.level.low, w: 1 }, { from: low * 0.75, to: low, kind: "little", name: t.level.littleLow, w: 1 });
  zones.push({ from: low ?? 0, to: high ?? top, kind: "healthy", name: t.level.healthy, w: 2.4 });
  if (high !== null) zones.push({ from: high, to: high * 1.25, kind: "little", name: t.level.littleHigh, w: 1 }, { from: high * 1.25, to: top, kind: "far", name: t.level.high, w: 1 });
  const total = zones.reduce((a, z) => a + z.w, 0);
  let acc = 0;
  const laid = zones.map((z) => { const left = (acc / total) * 100; acc += z.w; return { ...z, left, width: (z.w / total) * 100 }; });
  const pct = (v: number) => {
    const z = laid.find((z) => v <= z.to) ?? laid[laid.length - 1];
    const f = Math.min(1, Math.max(0, (v - z.from) / (z.to - z.from || 1)));
    return Math.min(97, Math.max(3, z.left + f * z.width));
  };

  return (
    <div role="img" aria-label={label} className="w-full">
      <div className="relative pt-6">
        <div className="absolute top-0 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink" style={{ left: `${pct(value)}%` }}>{t.lang === "hi" ? "आप" : "You"}</div>
        <div className="relative flex h-2.5 gap-0.5">
          {laid.map((z, i) => <div key={i} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${z.width}%`, background: ZONE[z.kind], opacity: 0.3 }} />)}
        </div>
        {history.map((h, i) => <div key={i} className="absolute top-6 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-black/30" style={{ left: `${pct(h)}%` }} />)}
        <div className="absolute top-[1.3rem] h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-white shadow" style={{ left: `${pct(value)}%`, background: LEVEL_COLOR[level(value, low, high)] }} />
      </div>
      {words && (
        <div className="mt-1.5 flex gap-0.5">
          {laid.map((z, i) => <div key={i} className="text-center font-mono text-[10px] uppercase leading-tight tracking-[0.04em] text-muted [overflow-wrap:anywhere]" style={{ width: `${z.width}%` }}>{z.name}</div>)}
        </div>
      )}
    </div>
  );
}
