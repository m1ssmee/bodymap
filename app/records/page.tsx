"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Arrow, Thumb } from "@/components/Bits";
import { useT } from "@/lib/i18n";
import type { Kind } from "@/lib/medical";
import { useLocalRecords } from "@/lib/store";

const FILTERS: { key: "all" | "prescription" | "blood" | "scan"; kinds?: Kind[] }[] = [
  { key: "all" }, { key: "prescription", kinds: ["prescription"] }, { key: "blood", kinds: ["blood"] },
  { key: "scan", kinds: ["xray", "mri", "ct", "ultrasound", "other"] },
];

export default function Records() {
  const t = useT(), p = t.records;
  const records = useLocalRecords();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const kinds = FILTERS.find((f) => f.key === filter)?.kinds;
  const years = useMemo(() => {
    const shown = records.filter((r) => !kinds || kinds.includes(r.kind)).sort((a, b) => b.date.localeCompare(a.date));
    return [...new Set(shown.map((r) => r.date.slice(0, 4)))].map((y) => ({ y, list: shown.filter((r) => r.date.startsWith(y)) }));
  }, [records, kinds]);

  return (
    <div className="space-y-10 pt-4 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="label">{p.label}</div>
          <h1 className="mt-4 text-[2.4rem] font-medium leading-[1.05] tracking-[-0.04em] sm:text-6xl">{p.title}</h1>
          <p className="mt-4 max-w-lg text-muted">{p.intro}</p>
        </div>
        <Link href="/upload" className="rounded-full bg-ink px-6 py-3.5 font-medium text-white transition hover:bg-black">{p.add}</Link>
      </div>

      {records.length === 0 ? <p className="text-muted">{p.empty}</p> : (
        <>
          <div role="group" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
                className={`min-h-11 rounded-full border px-4 text-[0.9rem] font-medium transition ${filter === f.key ? "border-ink bg-ink text-white" : "border-line bg-white/70 hover:bg-white"}`}>
                {p.filters[f.key]}
              </button>
            ))}
          </div>
          {years.length === 0 && <p className="text-muted">{p.none}</p>}
          {years.map(({ y, list }) => (
            <section key={y}>
              <h2 className="label mb-3">{y}</h2>
              <div className="panel divide-y divide-line">
                {list.map((r) => (
                  <Link key={r.id} href={`/body?record=${r.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-white">
                    <Thumb src={r.image} kind={r.kind} size={52} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="truncate text-[0.85rem] text-muted">{t.kind[r.kind]}{r.doctor && ` · ${r.doctor}`}{r.facility && ` · ${r.facility}`}</div>
                    </div>
                    <span className="num hidden text-[0.9rem] text-muted sm:block">{t.date(r.date)}</span>
                    <Arrow />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
