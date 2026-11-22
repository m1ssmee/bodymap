// Retrieval for "Ask": the patient's records are split into short passages, and a question is matched to them
// with BM25 (Robertson & Zaragoza, 2009) after tokenising, stop-word removal, light stemming and query expansion
// with a small English/Hindi medical synonym map. The top passages go to the LLM, which answers only from them (RAG).
import type { Strings } from "./i18n";
import { currentMedicines, labSeries, level, trend, type MedRecord, type Patient, type UpcomingItem } from "./medical";

export type Passage = { id: string; text: string; date: string; href: string; label: string };
export type Hit = { passage: Passage; score: number; matched: string[] };
export type QueryTerm = { term: string; weight: number; from?: string }; // from = the word it was expanded from

// ---- 1. preprocessing ----
const WORD = new RegExp("[\\p{L}\\p{M}\\p{N}]+", "gu"); // letters, Devanagari vowel signs, digits
const NUKTA = /़/g; // ज़ and ज are one word to a reader: drop the dot

const STOP = new Set([
  // English
  "a", "an", "the", "is", "are", "am", "was", "were", "be", "been", "do", "does", "did", "i", "me", "my", "mine", "we", "our",
  "you", "your", "it", "its", "this", "that", "these", "those", "of", "in", "on", "at", "to", "for", "from", "with", "and", "or",
  "what", "which", "who", "how", "why", "there", "any", "have", "has", "had", "can", "could", "should", "would", "will", "shall",
  "about", "tell", "please", "much", "many", "so", "if", "than", "then", "as", "by", "getting", "get", "go", "going", "ok", "okay",
  // Hindi (nukta already removed)
  "है", "हैं", "था", "थी", "थे", "हो", "का", "की", "के", "में", "से", "को", "ने", "पर", "और", "या", "यह", "वह", "ये", "वो",
  "क्या", "कैसा", "कैसी", "कैसे", "मेरा", "मेरी", "मेरे", "मुझे", "मैं", "हम", "आप", "तो", "भी", "ही", "कुछ", "बताओ", "बताइए",
  "बताएं", "बताएँ", "रहा", "रही", "रहे", "कोई", "किस", "कौन", "कौनसी", "कौनसा", "लिए", "लिये", "अब", "जी",
]);

// English suffix stripping, a few Porter-style rules; other scripts pass through unchanged.
export function stem(w: string) {
  if (!/^[a-z]+$/.test(w) || w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && /(ch|sh|x|s)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

export const tokenize = (text: string) =>
  (text.normalize("NFC").toLowerCase().replace(NUKTA, "").match(WORD) ?? [])
    .filter((w) => !STOP.has(w) && (w.length > 1 || /\d/.test(w))) // drops the "s" of "what's" / "doctor's"
    .map(stem);

// ---- 2. query expansion: everyday words (both languages) -> the words records actually use ----
const SYNONYMS: [string, string][] = [
  ["sugar शुगर शक्कर मधुमेह डायबिटीज diabetes diabetic", "hba1c glucose sugar metformin glimepiride pancreas diabetes"],
  ["bp pressure रक्तचाप बीपी hypertension", "bp pressure hypertension telmisartan amlodipine"],
  ["liver लिवर जिगर fatty", "liver sgpt sgot alt ast bilirubin"],
  ["kidney गुर्दा गुर्दे किडनी urine पेशाब", "kidney creatinine urea egfr"],
  ["cholesterol कोलेस्ट्रॉल fat heart दिल", "cholesterol ldl hdl triglycerides atorvastatin heart"],
  ["thyroid थायरॉइड थायराइड", "thyroid tsh levothyroxine"],
  ["vitamin विटामिन bone हड्डी हड्डियाँ sunshine धूप", "vitamin cholecalciferol calcium bones"],
  ["blood खून anaemia anemia hemoglobin haemoglobin", "blood haemoglobin hemoglobin"],
  ["medicine tablet pill दवा दवाई दवाइयाँ दवाएँ गोली गोलियाँ", "medicine current"],
  ["when next कब अगली अगला checkup appointment visit", "followup appointment checkup review repeat upcoming"],
  ["knee घुटना घुटने joint", "knee"],
  ["back कमर spine", "spine"],
  ["chest lung lungs फेफड़े सांस साँस breathing", "lungs chest xray"],
  ["stomach पेट belly abdomen", "stomach abdomen ultrasound"],
  ["better improving worse trend सुधर बिगड़", "trend"],
  ["food eat खाना खाने", "food"],
  ["doctor डॉक्टर", "doctor advice"],
];
const EXPAND = new Map<string, string[]>();
for (const [from, to] of SYNONYMS) {
  const targets = tokenize(to);
  for (const w of tokenize(from)) EXPAND.set(w, [...new Set([...(EXPAND.get(w) ?? []), ...targets])]);
}

// Words typed by the user weigh 1; words added by expansion weigh 0.6, so a direct match still ranks first.
export function queryTerms(question: string): QueryTerm[] {
  const out = new Map<string, QueryTerm>();
  for (const w of tokenize(question)) {
    out.set(w, { term: w, weight: 1 });
    for (const e of EXPAND.get(w) ?? []) if (!out.has(e)) out.set(e, { term: e, weight: 0.6, from: w });
  }
  return [...out.values()];
}

// ---- 3. chunking: one passage per fact, each starting with an English type word that expansion can hit ----
type Extras = { patient: Patient; conditions: string[]; upcoming: UpcomingItem[]; t: Strings };

export function buildPassages(records: MedRecord[], { patient, conditions, upcoming, t }: Extras): Passage[] {
  const ps: Passage[] = [];
  const range = (low: number | null, high: number | null, unit: string) =>
    low !== null && high !== null ? t.range.between(low, high, unit) : high !== null ? t.range.below(high, unit) : low !== null ? t.range.above(low, unit) : t.range.none;

  ps.push({ id: "patient", date: "", href: "/overview", label: patient.name,
    text: `Patient: ${patient.name}, ${patient.age}. Conditions: ${conditions.join(", ") || "none noted"}.` });

  for (const r of records) {
    const href = `/body?record=${r.id}`, label = `${r.title} · ${t.date(r.date)}`;
    const add = (k: string, text: string) => ps.push({ id: `${r.id}:${k}`, text, date: r.date, href, label });
    add("s", `Record: ${r.title} (${t.kind[r.kind]}), ${r.date}. ${[r.doctor, r.facility].filter(Boolean).join(", ")}. ${r.summary}`);
    r.findings.forEach((f, i) => add(`f${i}`, `Finding (${f.region}, ${t.sev[f.severity]}): ${f.title}. ${f.explanation} "${f.quote}"`));
    r.labs.forEach((l, i) => add(`l${i}`,
      `Test result: ${l.name} (${l.plain ?? ""}, ${l.region ?? ""}) = ${l.value} ${l.unit}, ${t.level[level(l.value, l.low, l.high)]}. Healthy: ${range(l.low, l.high, l.unit)}. ${l.about ?? ""}`));
    r.medicines.forEach((m, i) => add(`m${i}`,
      `Medicine: ${m.name} (${m.generic}), ${m.dose}, ${[m.morning && "morning", m.afternoon && "afternoon", m.night && "night"].filter(Boolean).join(", ")}, ${m.food} food. For: ${m.purpose}. ${m.duration}`));
    r.advice.forEach((a, i) => add(`a${i}`, `Doctor's advice: ${a}`));
  }

  // derived passages: a whole lab history (for "is it getting better?") and today's medicine list
  for (const [name, pts] of labSeries(records)) {
    if (pts.length < 2) continue;
    const last = pts[pts.length - 1];
    ps.push({ id: `trend:${name}`, date: last.date, href: "/trends", label: `${t.nav.trends} · ${last.plain || name}`,
      text: `Trend over time for ${name} (${last.plain ?? ""}, ${last.region ?? ""}): ${pts.map((p) => `${p.value} ${p.unit} on ${p.date}`).join(" → ")}. Now ${t.level[level(last.value, last.low, last.high)]}, ${t.trend[trend(pts[pts.length - 2], last)]}.` });
  }
  const meds = currentMedicines(records);
  if (meds.length) ps.push({ id: "current-medicines", date: "", href: "/medicines", label: t.nav.medicines,
    text: `Current medicines taken now: ${meds.map((m) => `${m.name} (${m.generic}) ${m.dose} for ${m.purpose}`).join("; ")}.` });

  for (const u of upcoming.slice(0, 6)) {
    const what = u.kind === "routine" ? `routine ${u.lab} test (every ${u.months} months)` : u.title;
    ps.push({ id: `next:${u.key}`, date: u.date, href: "/overview", label: `${t.upcoming.title} · ${t.date(u.date)}`,
      text: `Upcoming ${u.kind === "appointment" ? "appointment" : "follow-up checkup"} on ${u.date}: ${what}${u.kind === "followup" ? `, asked by ${u.doctor}` : ""}.` });
  }
  return ps;
}

// ---- 4. BM25 ----
const K1 = 1.5, B = 0.75;

export function bm25(passages: Passage[], terms: QueryTerm[]): Hit[] {
  const docs = passages.map((p) => tokenize(p.text));
  const N = docs.length, avgdl = docs.reduce((s, d) => s + d.length, 0) / (N || 1);
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1);
  return passages.map((passage, i) => {
    const d = docs[i];
    const tf = new Map<string, number>();
    for (const w of d) tf.set(w, (tf.get(w) ?? 0) + 1);
    let score = 0;
    const matched: string[] = [];
    for (const { term, weight } of terms) {
      const f = tf.get(term);
      if (!f) continue;
      const n = df.get(term)!;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += weight * idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * d.length / avgdl));
      matched.push(term);
    }
    return { passage, score, matched };
  }).sort((a, b) => b.score - a.score);
}

// Top-k passages for a question. With no word in common, fall back to the overview passages so general
// questions ("how am I doing?") still get context.
export function retrieve(question: string, passages: Passage[], k = 8) {
  const terms = queryTerms(question);
  const ranked = bm25(passages, terms);
  let hits = ranked.filter((h) => h.score > 0).slice(0, k);
  if (!hits.length) {
    const general = new Set(["patient", "current-medicines"]);
    hits = ranked.filter((h) => general.has(h.passage.id) || h.passage.id.endsWith(":s"))
      .sort((a, b) => +general.has(b.passage.id) - +general.has(a.passage.id) || b.passage.date.localeCompare(a.passage.date)).slice(0, k); // patient + medicines first: they have no date
  }
  return { terms, hits };
}
