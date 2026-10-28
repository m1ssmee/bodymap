"use client";
import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Arrow, Dot, Sev } from "@/components/Bits";
import Upcoming from "@/components/Upcoming";
import { useT } from "@/lib/i18n";
import { currentMedicines, regionSummary } from "@/lib/medical";
import { useConditions, useLocalRecords, usePatient } from "@/lib/store";
import { useSwipeNav } from "@/components/useSwipeNav";

const noop = () => () => {};
const useClock = () => useSyncExternalStore(noop, () => new Date().getHours() * 1000 + Math.floor(Date.now() / 86_400_000) % 1000, () => -1);

export default function Overview() {
  const t = useT();
  const patient = usePatient();
  const conditions = useConditions();
  const records = useLocalRecords();
  const clock = useClock(); // -1 while prerendering
  useEffect(() => { import("@/components/Body"); }, []); // warm the 3D page so it opens instantly
  const { ref } = useSwipeNav<HTMLDivElement>({ dir: "down", href: "/", flag: "drop", threshold: 260 }); // pull down at the top: back to the landing

  const hour = clock < 0 ? -1 : Math.floor(clock / 1000);
  const o = t.overview;
  const greeting = hour < 0 ? o.hello : hour < 12 ? o.morning : hour < 17 ? o.afternoon : o.evening;
  const quote = o.quotes[clock < 0 ? 0 : (clock % 1000) % o.quotes.length];

  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);
  const regions = useMemo(() => regionSummary(records), [records]);
  const concerns = regions.filter((r) => r.severity !== "normal");
  const meds = currentMedicines(records);
  const lastReport = sorted.find((r) => r.kind !== "prescription");

  const stats = [
    [o.lastReport, lastReport ? t.date(lastReport.date) : "—"],
    [o.flagged, o.areas(concerns.length)],
    [o.dailyMeds, String(meds.length)],
    [o.records, String(records.length)],
  ];

  return (
    <div ref={ref} className="rise-in space-y-14 pt-4 md:pt-10">
      <section className="grid gap-10 md:grid-cols-[1fr_320px] md:items-end">
        <div>
          <div className="label">{o.today}</div>
          <h1 className="mt-4 text-[2.6rem] font-medium leading-[1.02] tracking-[-0.045em] sm:text-7xl">
            {greeting},<br />{patient.name.split(" ")[0]}.
          </h1>
          <p className="mt-6 max-w-lg font-mono text-[0.85rem] leading-relaxed text-muted">“{quote}”</p>
          <div className="mt-9 flex flex-wrap items-center gap-6">
            <Link href="/upload" className="group inline-flex items-center gap-3 rounded-full bg-ink px-6 py-3.5 font-medium text-white transition hover:bg-black">
              {o.upload} <Arrow />
            </Link>
            <Link href="/body" className="group inline-flex items-center gap-2 font-medium">{o.seeBody} <Arrow /></Link>
          </div>
        </div>
        <dl className="panel divide-y divide-line px-5">
          {stats.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between py-3.5">
              <dt className="label">{k}</dt><dd className="num font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Upcoming />

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">{o.attention}</h2>
          <span className="label">{conditions.join(" · ")}</span>
        </div>
        <div className="panel divide-y divide-line">
          {concerns.length === 0 && <p className="px-5 py-6 text-muted">{records.length ? o.nothingFlagged : o.noRecords}</p>}
          {concerns.map((c) => (
            <Link key={c.region + c.side} href={`/body?region=${c.region}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-white">
              <Dot s={c.severity} />
              <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[180px_1fr] sm:gap-4">
                <div className="font-medium">{t.region[c.region]}{c.side !== "both" ? ` (${t.side[c.side]})` : ""}</div>
                <div className="truncate text-muted">{c.latest.title}</div>
              </div>
              <span className="hidden sm:block"><Sev s={c.severity} /></span>
              <Arrow />
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
