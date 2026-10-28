"use client";
import { LevelWord, TrendWord, ZoneBar, rangeText } from "@/components/Charts";
import Speak from "@/components/Speak";
import { useT } from "@/lib/i18n";
import { distance, labSeries, level, trend } from "@/lib/medical";
import { useLocalRecords } from "@/lib/store";

const GROUPS = ["pancreas", "liver", "kidneys", "heart", "blood", "thyroid", "bones"];

export default function Trends() {
  const t = useT();
  const items = [...labSeries(useLocalRecords()).entries()].map(([name, pts]) => {
    const last = pts[pts.length - 1], prev = pts[pts.length - 2];
    return {
      name, pts, last, plain: last.plain || name,
      group: last.region && GROUPS.includes(last.region) ? last.region : "other",
      level: level(last.value, last.low, last.high), trend: trend(prev, last), dist: distance(last.value, last.low, last.high),
    };
  });

  const worse = items.filter((i) => i.trend === "worse").sort((a, b) => b.dist - a.dist).slice(0, 2);
  const better = items.filter((i) => i.trend === "better").sort((a, b) => a.dist - b.dist).slice(0, 1);
  const changed = [
    ...worse.map((i) => t.trends.isLevel(i.plain, t.level[i.level], t.trend[i.trend])),
    ...better.map((i) => `${t.trends.goodNews} ${t.trends.improving(i.plain)}`),
  ];
  if (items.length && items.every((i) => i.level === "healthy")) changed.push(t.trends.allGood);
  const tips = [...new Set(items.filter((i) => i.level !== "healthy" && i.last.tip)
    .sort((a, b) => Number(b.trend === "worse") - Number(a.trend === "worse") || b.dist - a.dist).map((i) => i.last.tip!))].slice(0, 3);

  const groups = [...GROUPS, "other"].map((g) => ({ g, list: items.filter((i) => i.group === g).sort((a, b) => b.dist - a.dist) }))
    .filter((x) => x.list.length).sort((a, b) => b.list[0].dist - a.list[0].dist);

  return (
    <div className="space-y-12 pt-4 md:pt-10">
      <div>
        <div className="label">{t.trends.label}</div>
        <h1 className="mt-4 text-[2.4rem] font-medium leading-[1.08] tracking-[-0.04em] sm:text-6xl">{t.trends.title[0]}<br />{t.trends.title[1]}</h1>
        <p className="mt-4 max-w-xl text-muted">{t.trends.intro}</p>
      </div>

      {items.length === 0 && <p className="text-muted">{t.trends.empty}</p>}

      {changed.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="panel p-6">
            <div className="flex items-center justify-between"><h2 className="label">{t.trends.changed}</h2><Speak text={changed.join(" ")} /></div>
            <ul className="mt-3 space-y-3 text-[1.1rem] leading-snug">{changed.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </section>
          {tips.length > 0 && (
            <section className="panel p-6">
              <div className="flex items-center justify-between"><h2 className="label">{t.trends.todo}</h2><Speak text={tips.join(" ")} /></div>
              <ol className="mt-3 space-y-3 text-[1.05rem] leading-snug">{tips.map((tip, i) => <li key={i} className="flex gap-3"><span className="font-mono text-[0.8rem] text-muted">0{i + 1}</span>{tip}</li>)}</ol>
            </section>
          )}
        </div>
      )}

      {groups.map(({ g, list }) => (
        <section key={g}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-2xl font-medium tracking-tight">{t.group[g]}</h2>
            <span className="label">{t.trends.lastTests(list.length)}</span>
          </div>
          <div className="panel divide-y divide-line">
            {list.map((i) => {
              const l = i.last;
              const spoken = `${i.plain}. ${t.level[i.level]}, ${t.trend[i.trend]}. ${l.about ?? ""} ${l.tip ? `${t.trends.helps}: ${l.tip}` : ""}`;
              return (
                <article key={i.name} className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-xl font-medium leading-tight">{i.plain}</h3>
                      {i.plain !== i.name && <div className="mt-0.5 font-mono text-[0.72rem] text-muted">{i.name}</div>}
                    </div>
                    <div className="shrink-0 text-right text-[1.05rem]">
                      <LevelWord v={l.value} low={l.low} high={l.high} />
                      <div className="text-[0.9rem]"><TrendWord trend={i.trend} /></div>
                    </div>
                  </div>
                  {l.about && <p className="mt-2 max-w-2xl text-muted">{l.about}</p>}
                  <div className="mt-5 max-w-2xl">
                    <ZoneBar value={l.value} low={l.low} high={l.high} history={i.pts.slice(0, -1).map((p) => p.value)}
                      label={`${i.plain}: ${t.level[i.level]}, ${t.trend[i.trend]}`} />
                  </div>
                  {l.tip && <p className="mt-4 max-w-2xl"><span className="label mr-2">{t.trends.helps}</span>{l.tip}</p>}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4">
                    <span className="num font-mono text-[0.75rem] text-muted">{l.value} {l.unit} · {t.trends.healthyIs(rangeText(t, l.low, l.high, l.unit))} · {t.date(l.date)}</span>
                    <Speak text={spoken} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
