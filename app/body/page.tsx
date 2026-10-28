"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Arrow, Dot, Sev, Thumb } from "@/components/Bits";
import RecordView from "@/components/RecordView";
import Speak from "@/components/Speak";
import { useT } from "@/lib/i18n";
import { REGIONS, regionSummary, type Lab, type Region } from "@/lib/medical";
import { removeRecord, useConditions, useLocalRecords, usePatient } from "@/lib/store";

const Body = dynamic(() => import("@/components/Body"), { ssr: false, loading: () => null });

export default function BodyPage() {
  const t = useT();
  const patient = usePatient();
  const conditions = useConditions();
  const records = useLocalRecords();
  const [region, setRegion] = useState<Region | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);

  useEffect(() => { // ?region=liver or ?record=<id> from the link that brought us here
    const q = new URLSearchParams(location.search);
    const r = q.get("region");
    /* eslint-disable react-hooks/set-state-in-effect */
    if (r && (REGIONS as readonly string[]).includes(r)) setRegion(r as Region);
    if (q.get("record")) setRecordId(q.get("record"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);
  const record = sorted.find((r) => r.id === recordId) ?? null;
  const visible = useMemo(() => (record ? [record] : sorted), [record, sorted]);
  const regions = useMemo(() => regionSummary(visible), [visible]);
  const markers = regions.map(({ region, side, severity }) => ({ region, side, severity }));
  const hits = regions.filter((r) => r.region === region).flatMap((r) => r.hits);

  const previous = useMemo(() => {
    if (!record) return undefined;
    const prev = new Map<string, Lab & { date: string }>();
    for (const r of [...sorted].reverse()) if (r.date < record.date) for (const l of r.labs) prev.set(l.name, { ...l, date: r.date });
    return prev;
  }, [record, sorted]);

  const pick = (id: string | null) => { setRecordId(id); setRegion(null); };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="relative h-[60vh] min-h-[440px] min-w-0 lg:h-[calc(100vh-13rem)]">
          <Body markers={markers} selected={region} onSelect={setRegion} />
          <div className="pointer-events-none absolute left-0 top-0">
            <div className="label">{record ? `${t.kind[record.kind]} · ${t.date(record.date)}` : t.body.allRecords}</div>
            <div className="mt-1 text-xl font-medium tracking-tight">{record ? record.title : patient.name}</div>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 flex flex-col gap-1.5">
            {(["attention", "watch", "normal"] as const).map((s) => <Sev key={s} s={s} />)}
          </div>
          <div className="label pointer-events-none absolute bottom-0 right-0 hidden sm:block">{t.body.hint}</div>
        </div>

        <aside className="panel min-w-0 p-6 lg:h-[calc(100vh-13rem)] lg:overflow-y-auto">
          {region ? (
            <div className="space-y-5">
              <button onClick={() => setRegion(null)} className="label min-h-11 hover:text-ink">{t.body.back}</button>
              <h1 className="text-4xl font-medium tracking-[-0.03em]">{t.region[region]}</h1>
              <Speak text={hits.map((h) => `${h.title}. ${h.explanation}`).join(" ")} />
              <div className="divide-y divide-line">
                {hits.map((h, i) => (
                  <div key={i} className="py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><span className="font-medium">{h.title}</span><Sev s={h.severity} /></div>
                    <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{h.explanation}</p>
                    <button onClick={() => pick(h.record.id)} className="group mt-2 inline-flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.1em] text-muted hover:text-ink">
                      {h.record.title} · {t.date(h.record.date)} <Arrow />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : record ? (
            <div className="space-y-5">
              <div className="flex justify-between">
                <button onClick={() => pick(null)} className="label min-h-11 hover:text-ink">{t.body.backAll}</button>
                <button onClick={() => { if (confirm(t.body.confirmRemove)) { removeRecord(record.id); pick(null); } }} className="label min-h-11 hover:text-[#d4483b]">{t.body.remove}</button>
              </div>
              <RecordView r={record} previous={previous} showPending />
            </div>
          ) : (
            <div>
              <div className="label">{t.body.overview}</div>
              <h1 className="mt-2 text-4xl font-medium tracking-[-0.03em]">{patient.name}</h1>
              <p className="mt-1 text-muted">{patient.age} · {conditions.join(" · ") || t.body.noConditions}</p>
              <div className="mt-6 divide-y divide-line">
                {regions.length === 0 && <p className="py-4 text-muted">{t.body.noFindings}</p>}
                {regions.map((r) => (
                  <button key={r.region + r.side} onClick={() => setRegion(r.region)} className="group flex w-full items-center gap-4 py-3.5 text-left">
                    <Dot s={r.severity} />
                    <span className="w-24 shrink-0 font-medium sm:w-28">{t.region[r.region]}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{r.latest.title}</span>
                    <Arrow />
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        <button onClick={() => pick(null)} className={`shrink-0 rounded-lg border px-4 py-2.5 text-left ${!record ? "border-ink bg-white" : "border-line bg-white/60 hover:bg-white"}`}>
          <div className="font-medium">{t.body.allRecords}</div><div className="label">{t.body.total(records.length)}</div>
        </button>
        {sorted.map((r) => (
          <button key={r.id} onClick={() => pick(r.id)}
            className={`flex shrink-0 items-center gap-3 rounded-lg border p-2 pr-4 text-left ${record?.id === r.id ? "border-ink bg-white" : "border-line bg-white/60 hover:bg-white"}`}>
            <Thumb src={r.image} kind={r.kind} size={40} />
            <div><div className="text-[0.9rem] font-medium">{t.kind[r.kind]}</div><div className="label">{t.date(r.date)}</div></div>
          </button>
        ))}
      </div>
    </div>
  );
}
