"use client";
import { useMemo, useSyncExternalStore } from "react";
import { localize, textOf, type Appointment, type MedRecord, type Patient } from "./medical";
import { useLang } from "./i18n";
import { DEMO_APPOINTMENTS, DEMO_PATIENTS, DEMO_RECORDS } from "./demo";

type State = {
  activeId: string; patients: Patient[]; records: Record<string, MedRecord[]>;
  appointments?: Record<string, Appointment[]>; done?: Record<string, string[]>; // per patient
};

const KEY = "bodymap.v4"; // v4: demo follow-ups + appointments
const EMPTY: MedRecord[] = [];
const NONE: never[] = [];
export const DEFAULT_STATE: State = { activeId: DEMO_PATIENTS[0].id, patients: DEMO_PATIENTS, records: DEMO_RECORDS, appointments: DEMO_APPOINTMENTS };
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cache: State = DEFAULT_STATE;

function read(): State {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch {}
  if (raw === null) return DEFAULT_STATE; // first visit: demo family
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try { cache = JSON.parse(raw); } catch { cache = DEFAULT_STATE; }
  }
  return cache;
}

function write(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); }
  catch { // quota: drop uploaded thumbnails, keep the data
    const records = Object.fromEntries(Object.entries(s.records).map(([k, rs]) => [k, rs.map((r) => (r.image?.startsWith("data:") ? { ...r, image: undefined } : r))]));
    try { localStorage.setItem(KEY, JSON.stringify({ ...s, records })); } catch {}
  }
  listeners.forEach((l) => l());
}
const update = (fn: (s: State) => State) => write(fn(read()));

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l();
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
};

export const useAppState = () => useSyncExternalStore(subscribe, read, () => DEFAULT_STATE);
export function useRecords() { const s = useAppState(); return s.records[s.activeId] ?? EMPTY; }
export function usePatient() { const s = useAppState(); return s.patients.find((p) => p.id === s.activeId) ?? s.patients[0]; }

const withActive = (s: State, fn: (rs: MedRecord[]) => MedRecord[]) => ({ ...s, records: { ...s.records, [s.activeId]: fn(s.records[s.activeId] ?? []) } });
export const addRecord = (r: MedRecord) => update((s) => withActive(s, (rs) => [...rs, r]));
export const removeRecord = (id: string) => update((s) => withActive(s, (rs) => rs.filter((r) => r.id !== id)));
// Attach data to a record wherever it lives (the patient may have switched since).
export const patchRecord = (id: string, patch: Partial<MedRecord>) =>
  update((s) => ({ ...s, records: Object.fromEntries(Object.entries(s.records).map(([k, rs]) => [k, rs.map((r) => (r.id === id ? { ...r, ...patch } : r))])) }));
export function useAppointments(): Appointment[] { const s = useAppState(); return s.appointments?.[s.activeId] ?? NONE; }
export function useDone(): string[] { const s = useAppState(); return s.done?.[s.activeId] ?? NONE; }
export const addAppointment = (a: Omit<Appointment, "id">) =>
  update((s) => ({ ...s, appointments: { ...s.appointments, [s.activeId]: [...(s.appointments?.[s.activeId] ?? []), { ...a, id: crypto.randomUUID() }] } }));
export const removeAppointment = (id: string) =>
  update((s) => ({ ...s, appointments: { ...s.appointments, [s.activeId]: (s.appointments?.[s.activeId] ?? []).filter((a) => a.id !== id) } }));
export const markDone = (key: string) =>
  update((s) => ({ ...s, done: { ...s.done, [s.activeId]: [...(s.done?.[s.activeId] ?? []), key] } }));
export const setActivePatient = (id: string) => update((s) => ({ ...s, activeId: id }));
export function addPatient(p: Omit<Patient, "id">) {
  const id = crypto.randomUUID();
  update((s) => ({ ...s, patients: [...s.patients, { ...p, id }], activeId: id, records: { ...s.records, [id]: [] } }));
}
export const resetDemo = () => write(DEFAULT_STATE);

// The active patient's records with text in the chosen language.
export function useLocalRecords() {
  const records = useRecords();
  const lang = useLang();
  return useMemo(() => records.map((r) => localize(r, lang)), [records, lang]);
}
export function useConditions() {
  const p = usePatient();
  return useLang() === "hi" && p.conditionsHi ? p.conditionsHi : p.conditions;
}

// Hindi for a record is fetched once in the background and stored with it. Failures retry on the next view in Hindi.
const inflight = new Set<string>();
export async function translateRecord(r: MedRecord) {
  if (r.hi || inflight.has(r.id)) return;
  inflight.add(r.id);
  try {
    const res = await fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(textOf(r)) });
    if (res.ok) patchRecord(r.id, { hi: await res.json() });
  } catch {} finally { inflight.delete(r.id); }
}
