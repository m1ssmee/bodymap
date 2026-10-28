"use client";
import { useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n";
import { daysBetween, localToday, upcoming, type UpcomingItem } from "@/lib/medical";
import { addAppointment, markDone, removeAppointment, useAppointments, useDone, useLocalRecords, usePatient } from "@/lib/store";

const noop = () => () => {};
const useToday = () => useSyncExternalStore(noop, localToday, () => ""); // "" while prerendering

export default function Upcoming() {
  const t = useT(), u = t.upcoming;
  const records = useLocalRecords(), appts = useAppointments(), done = useDone(), patient = usePatient();
  const today = useToday();
  const [adding, setAdding] = useState(false);
  const items = today ? upcoming(records, appts, patient.conditions, done, today) : [];

  const title = (i: UpcomingItem) => (i.kind === "routine" ? u.lab[i.lab] ?? i.lab : i.title);
  const detail = (i: UpcomingItem) =>
    i.kind === "appointment" ? [u.appointment, i.time, i.place].filter(Boolean).join(" · ")
    : i.kind === "followup" ? u.followup(i.doctor, t.date(i.from))
    : `${u.routine(i.months)} · ${i.last ? u.lastDone(t.date(i.last)) : u.notOnRecord}`;
  const status = (date: string) => {
    const n = daysBetween(today, date);
    if (n < 0) return { text: u.overdue(-n), color: "#d4483b" };
    if (n === 0) return { text: u.today, color: "#d18a14" };
    if (n === 1) return { text: u.tomorrow, color: "#d18a14" };
    if (n <= 7) return { text: u.inDays(n), color: "#d18a14" };
    return { text: n <= 45 ? u.inDays(n) : t.date(date), color: "" };
  };

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    addAppointment({ title: String(f.get("title")).trim(), date: String(f.get("date")), time: String(f.get("time") || "") || undefined, place: String(f.get("place")).trim() || undefined });
    setAdding(false);
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="label">{u.title}</h2>
        {!adding && <button onClick={() => setAdding(true)} className="label min-h-11 hover:text-ink">{u.add}</button>}
      </div>
      <div className="panel divide-y divide-line">
        {adding && (
          <form onSubmit={save} className="grid gap-3 p-5 sm:grid-cols-[1fr_170px_120px]">
            <label className="sm:col-span-3"><span className="label">{u.what}</span><input name="title" required autoFocus className="field mt-1.5" /></label>
            <label><span className="label">{u.when}</span><input name="date" type="date" required min={today} defaultValue={today} className="field mt-1.5" /></label>
            <label><span className="label">{u.time}</span><input name="time" type="time" className="field mt-1.5" /></label>
            <label className="sm:col-span-1"><span className="label">{u.place}</span><input name="place" className="field mt-1.5" /></label>
            <div className="flex gap-3 sm:col-span-3">
              <button className="min-h-11 rounded-full bg-ink px-6 font-medium text-white">{u.save}</button>
              <button type="button" onClick={() => setAdding(false)} className="min-h-11 px-4 text-muted hover:text-ink">{u.cancel}</button>
            </div>
          </form>
        )}
        {today && items.length === 0 && !adding && <p className="px-5 py-6 text-muted">{u.none}</p>}
        {items.map((i) => {
          const p = t.parts(i.date), s = status(i.date);
          return (
            <div key={i.key} className="flex items-center gap-4 px-5 py-4">
              <div className="w-12 shrink-0 text-center leading-tight">
                <div className="label">{p.weekday}</div>
                <div className="num text-2xl font-medium">{p.day}</div>
                <div className="text-[0.8rem] text-muted">{p.month}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{title(i)}</div>
                <div className="text-[0.85rem] text-muted">{detail(i)}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[0.9rem] font-medium" style={s.color ? { color: s.color } : undefined}>{s.text}</span>
                <button onClick={() => (i.kind === "appointment" ? removeAppointment(i.id) : markDone(i.key))}
                  className="label min-h-9 hover:text-ink">{u.done}</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
