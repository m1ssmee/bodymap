import type { Lang, Level, Trend } from "./i18n";

export const REGIONS = [
  "brain", "eyes", "thyroid", "lungs", "heart", "liver", "stomach", "pancreas",
  "kidneys", "intestines", "bladder", "spine", "shoulder", "hip", "knee", "bones", "blood", "general",
] as const;
export type Region = (typeof REGIONS)[number];


export const KINDS = ["prescription", "blood", "xray", "mri", "ct", "ultrasound", "other"] as const;
export type Kind = (typeof KINDS)[number];

export type Severity = "normal" | "watch" | "attention";
export type Side = "left" | "right" | "both" | "none";

export type Finding = {
  title: string; explanation: string; severity: Severity; region: Region; side: Side; quote: string;
};
export type Medicine = {
  name: string; generic: string; dose: string; morning: boolean; afternoon: boolean; night: boolean;
  food: "before" | "after" | "any"; purpose: string; duration: string;
};
export type Lab = {
  name: string; value: number; unit: string; low: number | null; high: number | null; flag: "low" | "normal" | "high";
  plain?: string; about?: string; tip?: string; region?: Region; // plain-language words, written when the report is read
};
// Hindi for a record's own text, aligned by index with the English arrays. Names, numbers and units stay as printed.
export type HiText = {
  title: string; summary: string;
  findings: { title: string; explanation: string }[];
  labs: { plain: string; about: string; tip: string }[];
  medicines: { dose: string; purpose: string; duration: string }[];
  advice: string[]; questions: string[];
  followUps?: { title: string }[];
};
export type MedRecord = {
  id: string; kind: Kind; title: string; date: string; doctor: string; facility: string; summary: string;
  findings: Finding[]; medicines: Medicine[]; labs: Lab[]; advice: string[]; questions: string[];
  image?: string; // thumbnail data URL or /public path
  followUps?: FollowUp[]; // visits/tests the document asks for, dated by the reader
  hi?: HiText;
};
export type FollowUp = { title: string; date: string };
export type Appointment = { id: string; title: string; date: string; time?: string; place?: string };

export type Patient = { id: string; name: string; age: number; sex: "M" | "F"; conditions: string[]; conditionsHi?: string[] };

export const SEVERITY_COLOR: Record<Severity, string> = { normal: "#2f9e6e", watch: "#d18a14", attention: "#d4483b" };
export const SEVERITY_RANK: Record<Severity, number> = { normal: 0, watch: 1, attention: 2 };


// Current medicines: a doctor's newest prescription replaces their older ones; different doctors' lists combine,
// and the newest entry wins per active ingredient.
const doctor = (r: MedRecord) => r.doctor.toLowerCase().replace(/^dr\.?\s*/, "").split(/[,(]/)[0].trim();

export function currentMedicines(records: MedRecord[]) {
  const key = (m: Medicine) => (m.generic || m.name).toLowerCase().replace(/^(tab|cap|syp|inj)\.?\s+/, "").replace(/[^a-z]/g, "");
  const latest = new Map<string, MedRecord>();
  for (const r of [...records].sort((a, b) => a.date.localeCompare(b.date))) if (r.medicines.length) latest.set(doctor(r), r);
  const out = new Map<string, Medicine & { date: string }>();
  for (const r of [...latest.values()].sort((a, b) => a.date.localeCompare(b.date)))
    for (const m of r.medicines) out.set(key(m), { ...m, date: r.date });
  return [...out.values()];
}

// Lab series by name across records, oldest first.
export function labSeries(records: MedRecord[]) {
  const s = new Map<string, (Lab & { date: string; recordId: string })[]>();
  for (const r of [...records].sort((a, b) => a.date.localeCompare(b.date)))
    for (const l of r.labs) s.set(l.name, [...(s.get(l.name) ?? []), { ...l, date: r.date, recordId: r.id }]);
  return s;
}

export type Hit = Finding & { record: MedRecord };
export type RegionSummary = { region: Region; side: "left" | "right" | "both"; severity: Severity; latest: Hit; hits: Hit[] };

// One entry per organ/side: severity = worst finding on the most recent date that mentions it.
export function regionSummary(records: MedRecord[]): RegionSummary[] {
  const groups = new Map<string, Hit[]>();
  for (const r of records) for (const f of r.findings) {
    if (f.region === "general") continue;
    const side = f.side === "left" || f.side === "right" ? f.side : "both";
    const k = `${f.region}|${side}`;
    groups.set(k, [...(groups.get(k) ?? []), { ...f, record: r }]);
  }
  return [...groups.entries()].map(([k, hits]) => {
    const [region, side] = k.split("|") as [Region, RegionSummary["side"]];
    hits.sort((a, b) => b.record.date.localeCompare(a.record.date) || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
    const latestDate = hits[0].record.date;
    const severity = hits.filter((h) => h.record.date === latestDate).reduce<Severity>((s, h) => (SEVERITY_RANK[h.severity] > SEVERITY_RANK[s] ? h.severity : s), "normal");
    return { region, side, severity, latest: hits[0], hits };
  }).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.latest.record.date.localeCompare(a.latest.record.date));
}

// ---- plain-language reading of a number ----
// How far outside the healthy range, as a fraction of the limit (0 when inside).
export const distance = (v: number, low: number | null, high: number | null) =>
  high !== null && v > high ? (v - high) / high : low !== null && v < low ? (low - v) / low : 0;

// Up to 25% past the limit is "a little"; beyond is plainly high/low.
export function level(v: number, low: number | null, high: number | null): Level {
  const d = distance(v, low, high);
  if (!d) return "healthy";
  const up = high !== null && v > high;
  return d <= 0.25 ? (up ? "littleHigh" : "littleLow") : up ? "high" : "low";
}

// Better/worse means closer to/further from healthy, never just up/down.
export function trend(prev: Pick<Lab, "value" | "low" | "high"> | undefined, cur: Pick<Lab, "value" | "low" | "high">): Trend {
  if (!prev) return "first";
  const a = distance(prev.value, prev.low, prev.high), b = distance(cur.value, cur.low, cur.high);
  return Math.abs(a - b) < 0.02 ? "steady" : b < a ? "better" : "worse";
}

// The record's text in the chosen language; English stays in place until a Hindi version exists.
export function localize(r: MedRecord, lang: Lang): MedRecord {
  const h = r.hi;
  if (lang === "en" || !h) return r;
  return {
    ...r, title: h.title, summary: h.summary, advice: h.advice, questions: h.questions,
    findings: r.findings.map((f, i) => ({ ...f, ...h.findings[i] })),
    labs: r.labs.map((l, i) => ({ ...l, ...h.labs[i] })),
    medicines: r.medicines.map((m, i) => ({ ...m, ...h.medicines[i] })),
    followUps: r.followUps?.map((f, i) => ({ ...f, ...h.followUps?.[i] })),
  };
}

// What gets sent for translation: only the record's own words, in order.
export const textOf = (r: MedRecord): HiText => ({
  title: r.title, summary: r.summary, advice: r.advice, questions: r.questions,
  findings: r.findings.map(({ title, explanation }) => ({ title, explanation })),
  labs: r.labs.map((l) => ({ plain: l.plain ?? l.name, about: l.about ?? "", tip: l.tip ?? "" })),
  medicines: r.medicines.map(({ dose, purpose, duration }) => ({ dose, purpose, duration })),
  followUps: (r.followUps ?? []).map(({ title }) => ({ title })),
});

// ---- what's coming up: appointments, doctors' follow-ups, routine checkups ----
export type UpcomingItem =
  | { kind: "appointment"; key: string; date: string; title: string; time?: string; place?: string; id: string }
  | { kind: "followup"; key: string; date: string; title: string; doctor: string; from: string }
  | { kind: "routine"; key: string; date: string; lab: string; months: number; last?: string };

// General schedules for common long-term conditions. A rule applies when the test is already in the records,
// or the patient's conditions mention it; the next date counts from the last test.
const ROUTINE = [
  { lab: "HbA1c", months: 3, when: /diabet|sugar|शुगर|डायबि/i },
  { lab: "TSH", months: 6, when: /thyroid|थायरॉइड/i },
  { lab: "LDL Cholesterol", months: 12, when: /diabet|pressure|\bBP\b|cholesterol/i },
  { lab: "Creatinine", months: 12, when: /diabet|pressure|\bBP\b|kidney/i },
];

// Calendar dates (YYYY-MM-DD) are done in UTC so time zones never shift them by a day.
export const addMonths = (d: string, n: number) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString().slice(0, 10);
};
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86_400_000);
export const localToday = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the user's own time zone

export function upcoming(records: MedRecord[], appointments: Appointment[], conditions: string[], done: string[], today: string): UpcomingItem[] {
  const items: UpcomingItem[] = appointments.map((a) => ({ kind: "appointment" as const, key: `a:${a.id}`, ...a }));

  // a doctor's newest visit replaces their older follow-ups (all records from that day count)
  const lastVisit = new Map<string, string>();
  for (const r of records) if ((lastVisit.get(doctor(r)) ?? "") < r.date) lastVisit.set(doctor(r), r.date);
  for (const r of records) if (r.date === lastVisit.get(doctor(r))) for (const f of r.followUps ?? [])
    items.push({ kind: "followup", key: `f:${r.id}:${f.date}`, date: f.date, title: f.title, doctor: r.doctor, from: r.date });

  const series = labSeries(records);
  for (const rule of ROUTINE) {
    const last = series.get(rule.lab)?.at(-1)?.date;
    if (!last && !conditions.some((c) => rule.when.test(c))) continue;
    const date = last ? addMonths(last, rule.months) : today;
    // a doctor already asked for this test around then: don't list it twice
    if (items.some((i) => i.kind === "followup" && i.title.includes(rule.lab.split(" ")[0]) && Math.abs(daysBetween(i.date, date)) < 120)) continue;
    items.push({ kind: "routine", key: `r:${rule.lab}:${date}`, date, lab: rule.lab, months: rule.months, last });
  }
  return items.filter((i) => !done.includes(i.key)).sort((a, b) => a.date.localeCompare(b.date));
}
