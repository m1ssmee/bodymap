"use client";
import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Speak from "@/components/Speak";
import { useLang, useT } from "@/lib/i18n";
import { localToday, upcoming } from "@/lib/medical";
import { buildPassages, retrieve, type Hit, type Passage, type QueryTerm } from "@/lib/retrieve";
import { useAppointments, useConditions, useDone, useLocalRecords, usePatient } from "@/lib/store";

type Turn = { id: string; q: string; terms: QueryTerm[]; hits: Hit[]; answer?: string; cites?: Passage[]; error?: string };

// The browser's speech recogniser (Chrome, Edge, Safari); absent in most Android WebViews, where the mic is hidden.
type Recogniser = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const getRecogniser = () => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => Recogniser; webkitSpeechRecognition?: new () => Recogniser };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
const noop = () => () => {};

export default function Ask() {
  const t = useT(), a = t.ask, lang = useLang();
  const records = useLocalRecords(), patient = usePatient(), conditions = useConditions();
  const appts = useAppointments(), done = useDone();
  const today = useSyncExternalStore(noop, localToday, () => "");
  const passages = useMemo(
    () => buildPassages(records, { patient, conditions, t, upcoming: today ? upcoming(records, appts, patient.conditions, done, today) : [] }),
    [records, patient, conditions, t, appts, done, today]);

  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const canListen = useSyncExternalStore(noop, () => !!getRecogniser(), () => false);
  const rec = useRef<Recogniser | null>(null);

  async function ask(question: string) {
    question = question.trim();
    if (!question || busy) return;
    const { terms, hits } = retrieve(question, passages);
    const id = crypto.randomUUID(); // not the list index: the voice callback can run with a stale list
    setTurns((ts) => [...ts, { id, q: question, terms, hits }]);
    setQ(""); setBusy(true);
    const patch = (p: Partial<Turn>) => setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, ...p } : x)));
    try {
      const res = await fetch("/api/ask", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, lang, passages: hits.map(({ passage: { id, text, date } }) => ({ id, text: text.slice(0, 1200), date })) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const byId = new Map(hits.map((h) => [h.passage.id, h.passage]));
      const cites = (json.citations as string[]).map((c) => byId.get(c)!).filter((p, k, all) => all.findIndex((x) => x.href === p.href) === k); // one chip per page
      patch({ answer: json.answer, cites });
    } catch (e) {
      patch({ error: e instanceof Error && e.message ? e.message : a.failed });
    } finally { setBusy(false); }
  }

  function listen() {
    if (listening) return rec.current?.stop();
    const R = getRecogniser();
    if (!R) return;
    const r = new R();
    r.lang = t.voice; r.interimResults = false;
    r.onresult = (e) => { const text = e.results[0]?.[0]?.transcript ?? ""; setQ(text); if (text) ask(text); };
    r.onend = r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  return (
    <div className="space-y-10 pt-4 md:pt-10">
      <div>
        <div className="label">{a.label}</div>
        <h1 className="mt-4 text-[2.4rem] font-medium leading-[1.08] tracking-[-0.04em] sm:text-6xl">{a.title[0]}<br />{a.title[1]}</h1>
        <p className="mt-4 max-w-xl text-muted">{a.intro}</p>
      </div>

      {records.length === 0 ? <p className="text-muted">{a.noRecords}</p> : (
        <div className="max-w-3xl space-y-8">
          {turns.map((turn) => (
            <section key={turn.id} className="space-y-3">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-ink px-4 py-2.5 text-white">{turn.q}</p>
              <div className="panel space-y-4 p-5">
                {turn.answer ? <p className="text-[1.1rem] leading-relaxed">{turn.answer}</p>
                  : turn.error ? <p className="text-[#d4483b]">{turn.error}</p>
                  : <p className="font-mono text-[0.8rem] text-muted">{a.thinking}</p>}
                {turn.answer && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Speak text={turn.answer} />
                    {turn.cites?.map((p) => (
                      <Link key={p.id} href={p.href} className="rounded-full border border-line bg-white/70 px-3 py-1.5 text-[0.85rem] hover:bg-white">
                        <span className="text-muted">{a.sources}: </span>{p.label}
                      </Link>
                    ))}
                  </div>
                )}
                <details className="text-[0.85rem]">
                  <summary className="cursor-pointer font-mono text-[0.75rem] text-muted">{a.how}</summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="label mb-1.5">{a.searched}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {turn.terms.map((x) => (
                          <span key={x.term} title={x.from ? `${a.added} “${x.from}”` : undefined}
                            className={`rounded px-1.5 py-0.5 font-mono text-[0.75rem] ${x.from ? "border border-dashed border-line text-muted" : "bg-black/[0.06]"}`}>
                            {x.term}{x.from && <span className="opacity-60"> ← {x.from}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ol className="space-y-1.5">
                      {turn.hits.map((h) => (
                        <li key={h.passage.id} className="flex gap-3">
                          <span className="num w-12 shrink-0 font-mono text-[0.75rem] text-muted">{h.score.toFixed(2)}</span>
                          <span className="min-w-0 text-muted">{h.passage.text}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </details>
              </div>
            </section>
          ))}

          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {a.suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)} className="min-h-11 rounded-full border border-line bg-white/70 px-4 text-[0.95rem] hover:bg-white">{s}</button>
              ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder={listening ? a.listening : a.placeholder} aria-label={a.placeholder}
              className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-white px-5 text-[1.05rem] outline-none focus:border-ink" />
            {canListen && (
              <button type="button" onClick={listen} aria-label={a.speak} aria-pressed={listening}
                className={`grid size-12 shrink-0 place-items-center rounded-full border transition ${listening ? "border-[#d4483b] bg-[#d4483b] text-white" : "border-line bg-white hover:border-ink"}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
              </button>
            )}
            <button disabled={busy || !q.trim()} className="min-h-12 shrink-0 rounded-full bg-ink px-6 font-medium text-white transition hover:bg-black disabled:opacity-40">{a.send}</button>
          </form>
          <p className="font-mono text-[0.75rem] leading-relaxed text-muted">{a.note}</p>
        </div>
      )}
    </div>
  );
}
