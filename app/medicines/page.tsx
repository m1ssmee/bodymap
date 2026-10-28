"use client";
import Speak from "@/components/Speak";
import MedMix from "@/components/MedMix";
import { useT } from "@/lib/i18n";
import { currentMedicines } from "@/lib/medical";
import { useLocalRecords } from "@/lib/store";

const SLOTS = ["morning", "afternoon", "night"] as const;

export default function Medicines() {
  const t = useT(), m = t.meds;
  const records = useLocalRecords();
  const meds = currentMedicines(records);
  const rx = records.filter((r) => r.kind === "prescription").sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="space-y-10 pt-4 md:pt-10">
      <div>
        <div className="label">{m.label}{rx && ` · ${m.updated(t.date(rx.date))}`}</div>
        <h1 className="mt-4 text-[2.4rem] font-medium leading-[1.05] tracking-[-0.04em] sm:text-6xl">{m.title}</h1>
        <p className="mt-4 max-w-lg text-muted">{m.note}</p>
      </div>
      {meds.length === 0 && <p className="text-muted">{m.none}</p>}
      {meds.length > 0 && (
        <div className="panel grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {SLOTS.map((slot) => {
            const list = meds.filter((x) => x[slot]);
            const spoken = m.spoken(m.slots[slot], list.map((x) => m.spokenItem(x.name, x.dose, m.food[x.food], x.purpose)).join(" "));
            return (
              <section key={slot} className="p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xl font-medium tracking-tight">{m.slots[slot]} <span className="font-mono text-[0.75rem] text-muted">{m.times[slot]}</span></h2>
                  <Speak text={spoken} />
                </div>
                <div className="mt-3 divide-y divide-line">
                  {list.length === 0 && <p className="py-3 text-muted">{m.nothing}</p>}
                  {list.map((x) => (
                    <div key={x.name} className="py-3.5">
                      <div className="font-medium">{x.name}</div>
                      <div className="text-[0.85rem] text-muted">{x.generic}</div>
                      <div className="mt-1.5 font-mono text-[0.75rem]">{x.dose} · {m.food[x.food]}</div>
                      <div className="font-mono text-[0.75rem] text-muted">{x.purpose}</div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {meds.length > 0 && <MedMix meds={meds} />}
      {rx && rx.advice.length > 0 && (
        <section>
          <h2 className="label mb-3">{m.advice}</h2>
          <ol className="panel divide-y divide-line">
            {rx.advice.map((a, i) => <li key={i} className="flex gap-4 px-5 py-3.5"><span className="font-mono text-[0.75rem] text-muted">0{i + 1}</span>{a}</li>)}
          </ol>
        </section>
      )}
    </div>
  );
}
