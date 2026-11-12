"use client";
import { useSyncExternalStore } from "react";
import { useLang, useT, type Strings } from "@/lib/i18n";
import { level, trend, type Lab, type MedRecord } from "@/lib/medical";
import { native } from "@/lib/native";
import { Sev } from "./Bits";
import { LevelWord, TrendWord, ZoneBar, rangeText } from "./Charts";
import Speak, { PILL } from "./Speak";

const sub = "text-muted";
const rule = "divide-y divide-line";

export default function RecordView({ r, previous, showPending, share }: {
  r: Omit<MedRecord, "id">; previous?: Map<string, Lab & { date: string }>; showPending?: boolean; share?: boolean;
}) {
  const t = useT(), lang = useLang();
  const spoken = [r.summary, ...r.findings.map((f) => `${f.title}. ${f.explanation}`)].join(" ");
  const food = (f: "before" | "after" | "any") => t.meds.food[f];
  return (
    <div className="space-y-8">
      <div>
        <div className="label">{t.kind[r.kind]} · {t.date(r.date)}</div>
        <h2 className="mt-2 text-2xl font-medium tracking-tight">{r.title}</h2>
        {(r.doctor || r.facility) && <div className={`mt-1 text-[0.9rem] ${sub}`}>{[r.doctor, r.facility].filter(Boolean).join(" · ")}</div>}
        {showPending && lang === "hi" && !r.hi && <div className="mt-2 font-mono text-[0.75rem] opacity-60">{t.record.translating}</div>}
        <p className="mt-4 leading-relaxed">{r.summary}</p>
        <div className="mt-2 flex flex-wrap gap-3"><Speak text={spoken} />{share && <Share r={r} />}</div>
      </div>

      {r.findings.length > 0 && (
        <section>
          <h3 className="label mb-2">{t.record.findings}</h3>
          <div className={rule}>
            {r.findings.map((f, i) => (
              <div key={i} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><span className="font-medium">{f.title}</span><Sev s={f.severity} /></div>
                <p className={`mt-1 text-[0.95rem] leading-relaxed ${sub}`}>{f.explanation}</p>
                {f.quote && <p className="mt-2 font-mono text-[0.75rem] opacity-50">“{f.quote}”</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {r.labs.length > 0 && (
        <section>
          <h3 className="label mb-2">{t.record.results}</h3>
          <div className={rule}>
            {r.labs.map((l) => {
              const prev = previous?.get(l.name);
              const plain = l.plain || l.name;
              return (
                <div key={l.name} className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[1.05rem] font-medium">{plain}</div>
                      <div className={`font-mono text-[0.72rem] ${sub}`}>{plain !== l.name && `${l.name} · `}{t.trends.healthyIs(rangeText(t, l.low, l.high, l.unit))}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <LevelWord v={l.value} low={l.low} high={l.high} />
                      <div className={`num text-[0.85rem] ${sub}`}>{l.value} {l.unit}</div>
                    </div>
                  </div>
                  {l.about && <p className={`text-[0.92rem] leading-relaxed ${sub}`}>{l.about}</p>}
                  <ZoneBar value={l.value} low={l.low} high={l.high} history={prev ? [prev.value] : []} words={false}
                    label={`${plain}: ${t.level[level(l.value, l.low, l.high)]}`} />
                  {prev && <div className="text-[0.85rem]"><TrendWord trend={trend(prev, l)} /> <span className={sub}>· {prev.value} {l.unit}, {t.date(prev.date)}</span></div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {r.medicines.length > 0 && (
        <section>
          <h3 className="label mb-2">{t.record.medicines}</h3>
          <div className={rule}>
            {r.medicines.map((m, i) => (
              <div key={i} className="py-3.5">
                <div className="font-medium">{m.name} <span className={`font-normal ${sub}`}>· {m.generic}</span></div>
                <div className={`text-[0.9rem] ${sub}`}>{m.dose} · {[m.morning && t.meds.slots.morning, m.afternoon && t.meds.slots.afternoon, m.night && t.meds.slots.night].filter(Boolean).join(", ")} · {food(m.food)}</div>
                <div className="mt-0.5 font-mono text-[0.72rem] opacity-60">{m.purpose}{m.duration && ` · ${m.duration}`}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {r.advice.length > 0 && (
        <section>
          <h3 className="label mb-2">{t.record.advice}</h3>
          <ul className={`space-y-1.5 ${sub}`}>{r.advice.map((a, i) => <li key={i}>— {a}</li>)}</ul>
        </section>
      )}

      {r.questions.length > 0 && (
        <section>
          <h3 className="label mb-2">{t.record.ask}</h3>
          <ol className="space-y-1.5">{r.questions.map((q, i) => <li key={i} className="flex gap-3"><span className="font-mono text-[0.75rem] opacity-40">0{i + 1}</span>{q}</li>)}</ol>
        </section>
      )}
    </div>
  );
}

// The record as plain text for WhatsApp or the doctor, in the language on screen.
function summary(r: Omit<MedRecord, "id">, t: Strings) {
  const off = r.labs.filter((l) => level(l.value, l.low, l.high) !== "healthy");
  return [
    `${r.title} · ${t.date(r.date)}`, [r.doctor, r.facility].filter(Boolean).join(" · "), "", r.summary,
    ...(r.findings.length ? ["", `${t.record.findings}:`, ...r.findings.map((f) => `• ${f.title}${f.severity === "normal" ? "" : ` (${t.sev[f.severity]})`}`)] : []),
    ...(off.length ? ["", `${t.share.tests}:`, ...off.map((l) => `• ${l.plain || l.name}: ${l.value} ${l.unit} (${t.level[level(l.value, l.low, l.high)]})`)] : []),
    ...(r.medicines.length ? ["", `${t.share.meds}:`, ...r.medicines.map((m) => `• ${m.name}, ${m.dose}`)] : []),
    "", t.share.footer,
  ].join("\n");
}

const noop = () => () => {};

// Android's share sheet in the app; the browser's own share where it has one (phones); hidden otherwise.
function Share({ r }: { r: Omit<MedRecord, "id"> }) {
  const t = useT();
  const can = useSyncExternalStore(noop, () => !!native("Share") || typeof navigator.share === "function", () => false);
  if (!can) return null;
  const go = () => {
    const text = summary(r, t), app = native("Share");
    (app ? app.share({ title: r.title, text, dialogTitle: t.share.dialog }) : navigator.share({ title: r.title, text })).catch(() => {}); // closing the sheet rejects
  };
  return (
    <button onClick={go} className={PILL}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" className="app:size-5 app:text-sage"><circle cx="3.5" cy="7" r="1.6" /><circle cx="10.5" cy="3" r="1.6" /><circle cx="10.5" cy="11" r="1.6" /><path d="m4.9 6.2 4.2-2.4M4.9 7.8l4.2 2.4" /></svg>
      {t.share.button}
    </button>
  );
}
