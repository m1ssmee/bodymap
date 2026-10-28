"use client";
import { useSyncExternalStore } from "react";
import { SEVERITY_RANK, type Medicine, type Severity } from "./medical";

// "Do your medicines mix well?": a reviewed list of well-known cautions for medicines common in older Indians,
// matched by name/generic. Medicines the list does not know are checked once by Gemini (/api/interactions).
type T = { en: string; hi: string };
type Med = Medicine & { date?: string };
const SLOTS = ["morning", "afternoon", "night"] as const;

const CLASSES = {
  metformin: /metformin|glycomet|glucophage/,
  lowSugar: /glimepiride|gliclazide|glipizide|insulin|amaryl/, // can push sugar too low
  diabetes: /metformin|glycomet|glucophage|glimepiride|gliclazide|glipizide|insulin|amaryl/,
  raas: /sartan|pril\b|telma|losar/, // ARBs and ACE inhibitors (BP)
  statin: /statin|atorva|rosuva/,
  thyroid: /levothyrox|thyroxine|thyronorm|eltroxin/,
  iron: /ferrous|ferric|iron|orofer|livogen/,
  calcium: /calcium|shelcal/,
  painkiller: /ibuprofen|diclofenac|aceclofenac|naproxen|etoricoxib|combiflam|voveran|brufen|zerodol/,
  antiplatelet: /aspirin|ecosprin|clopidogrel|clopilet/,
  aspirin: /aspirin|ecosprin/,
  clopidogrel: /clopidogrel|clopilet/,
  warfarin: /warfarin|acenocoumarol|acitrom/,
  ppi: /prazole/,
  omeprazole: /\bomeprazole|esomeprazole/,
  spironolactone: /spironolactone|aldactone/,
  vitamins: /cholecalciferol|vitamin d|uprise|cobalamin|b12|methylcobal|folic|multivitamin/, // known, no common cautions
};
type Cls = keyof typeof CLASSES;

type Rule = { level: Severity; drugs: Cls[]; other?: T; what: T; todo: T; apart?: boolean; not?: Cls[] };

const ALCOHOL = { en: "alcohol", hi: "शराब" };
const PAINKILLERS = { en: "painkillers", hi: "दर्द की गोलियाँ" };
const R = (level: Severity, drugs: Cls[], what: T, todo: T, o: Partial<Rule> = {}): Rule => ({ level, drugs, what, todo, ...o });
const APART4 = { en: "Keep them at least 4 hours apart.", hi: "दोनों के बीच कम से कम 4 घंटे का फ़ासला रखें।" };

export const RULES: Rule[] = [
  R("attention", ["painkiller", "raas"],
    { en: "Together they can raise your BP and harm your kidneys.", hi: "दोनों साथ लेने से BP बढ़ सकता है और गुर्दों को नुक़सान हो सकता है।" },
    { en: "Ask your doctor before taking this painkiller regularly.", hi: "यह दर्द की गोली रोज़ लेने से पहले डॉक्टर से पूछें।" }),
  R("attention", ["raas"],
    { en: "Shop painkillers like Combiflam, Brufen or Voveran can raise BP and harm the kidneys with this tablet.", hi: "Combiflam, Brufen या Voveran जैसी दर्द की गोलियाँ इस दवा के साथ BP बढ़ा सकती हैं और गुर्दों को नुक़सान पहुँचा सकती हैं।" },
    { en: "Ask your doctor before taking any painkiller, even for knee or back pain.", hi: "घुटने या कमर के दर्द के लिए भी कोई दर्द की गोली लेने से पहले डॉक्टर से पूछें।" },
    { other: PAINKILLERS, not: ["painkiller"] }),
  R("attention", ["warfarin", "painkiller"],
    { en: "Together they raise the risk of serious bleeding.", hi: "दोनों साथ लेने से ज़्यादा ख़ून बहने का ख़तरा बढ़ता है।" },
    { en: "Ask your doctor about this painkiller straight away.", hi: "इस दर्द की गोली के बारे में तुरंत डॉक्टर से पूछें।" }),
  R("attention", ["warfarin", "antiplatelet"],
    { en: "Together they raise the risk of bleeding.", hi: "दोनों साथ लेने से ख़ून बहने का ख़तरा बढ़ता है।" },
    { en: "Check with your doctor that you should take both. Report black stools or easy bruising.", hi: "डॉक्टर से पक्का करें कि दोनों लेनी हैं। काला मल आए या आसानी से नील पड़ें तो बताएँ।" }),
  R("attention", ["antiplatelet", "painkiller"],
    { en: "Together they can cause bleeding in the stomach.", hi: "दोनों साथ लेने से पेट में ख़ून बह सकता है।" },
    { en: "Ask your doctor before taking this painkiller.", hi: "यह दर्द की गोली लेने से पहले डॉक्टर से पूछें।" }),
  R("attention", ["warfarin"],
    { en: "Shop painkillers like Combiflam or Voveran can cause serious bleeding with this tablet.", hi: "Combiflam या Voveran जैसी दर्द की गोलियाँ इस दवा के साथ ज़्यादा ख़ून बहा सकती हैं।" },
    { en: "Ask your doctor before taking any painkiller.", hi: "कोई भी दर्द की गोली लेने से पहले डॉक्टर से पूछें।" },
    { other: PAINKILLERS, not: ["painkiller"] }),
  R("watch", ["antiplatelet"],
    { en: "Shop painkillers like Combiflam or Voveran can cause stomach bleeding with this tablet.", hi: "Combiflam या Voveran जैसी दर्द की गोलियाँ इस दवा के साथ पेट में ख़ून बहा सकती हैं।" },
    { en: "Ask your doctor or pharmacist which painkiller is safe for you.", hi: "डॉक्टर या फ़ार्मासिस्ट से पूछें कि कौन-सी दर्द की गोली आपके लिए ठीक है।" },
    { other: PAINKILLERS, not: ["painkiller", "warfarin"] }),
  R("watch", ["aspirin", "clopidogrel"],
    { en: "Together they make bleeding easier. Doctors often give both on purpose.", hi: "दोनों साथ लेने से ख़ून आसानी से बहता है। डॉक्टर अक्सर जान-बूझकर दोनों देते हैं।" },
    { en: "Tell your doctor about black stools or bruises that appear easily.", hi: "काला मल आए या आसानी से नील पड़ें तो डॉक्टर को बताएँ।" }),
  R("watch", ["clopidogrel", "omeprazole"],
    { en: "Omeprazole can make clopidogrel work less well.", hi: "Omeprazole से clopidogrel का असर कम हो सकता है।" },
    { en: "Ask your doctor whether a different acidity tablet would suit you better.", hi: "डॉक्टर से पूछें कि क्या एसिडिटी की कोई दूसरी गोली बेहतर रहेगी।" }),
  R("watch", ["thyroid", "iron"],
    { en: "Iron stops your body from taking in the thyroid tablet.", hi: "आयरन की गोली थायरॉइड की गोली का असर कम कर देती है।" }, APART4, { apart: true }),
  R("watch", ["thyroid", "calcium"],
    { en: "Calcium stops your body from taking in the thyroid tablet.", hi: "कैल्शियम की गोली थायरॉइड की गोली का असर कम कर देती है।" }, APART4, { apart: true }),
  R("watch", ["thyroid"],
    { en: "Tea, coffee, milk or breakfast too soon after it weakens the thyroid tablet.", hi: "थायरॉइड की गोली के तुरंत बाद चाय, कॉफ़ी, दूध या नाश्ता लेने से उसका असर कम होता है।" },
    { en: "Take it with plain water and wait 30 to 60 minutes before tea or breakfast.", hi: "इसे सादे पानी से लें और चाय या नाश्ते से पहले 30 से 60 मिनट रुकें।" },
    { other: { en: "tea, coffee or milk", hi: "चाय, कॉफ़ी या दूध" } }),
  R("watch", ["raas", "spironolactone"],
    { en: "Together they can raise the potassium in your blood.", hi: "दोनों साथ लेने से ख़ून में पोटैशियम बढ़ सकता है।" },
    { en: "Get the potassium blood test your doctor asks for on time.", hi: "डॉक्टर जो पोटैशियम की जाँच कहें, वह समय पर करवाएँ।" }),
  R("watch", ["diabetes"],
    { en: "Alcohol with this medicine can drop your sugar and strain your liver.", hi: "इस दवा के साथ शराब पीने से शुगर गिर सकती है और लिवर पर ज़ोर पड़ता है।" },
    { en: "Best to avoid alcohol. Ask your doctor if any amount is safe.", hi: "शराब से बचें। डॉक्टर से पूछें कि क्या थोड़ी भी ठीक है।" },
    { other: ALCOHOL }),
  R("watch", ["lowSugar"],
    { en: "Skipping or delaying a meal with this medicine can drop your sugar too low.", hi: "इस दवा के साथ खाना छोड़ने या देर से खाने पर शुगर बहुत गिर सकती है।" },
    { en: "Eat on time and keep sugar or glucose biscuits handy.", hi: "समय पर खाएँ और पास में चीनी या ग्लूकोज़ बिस्किट रखें।" },
    { other: { en: "missed meals", hi: "खाना छोड़ना" } }),
  R("normal", ["thyroid", "ppi"],
    { en: "Acidity tablets can make the thyroid tablet work a little less.", hi: "एसिडिटी की गोली से थायरॉइड की गोली का असर थोड़ा कम हो सकता है।" },
    { en: "Tell your doctor, who may check your TSH sooner.", hi: "डॉक्टर को बताएँ, वे TSH की जाँच जल्दी करवा सकते हैं।" }),
  R("normal", ["iron", "calcium"],
    { en: "Calcium lowers the iron your body takes in.", hi: "कैल्शियम से शरीर में आयरन कम पहुँचता है।" },
    { en: "Keep them at least 2 hours apart.", hi: "दोनों के बीच कम से कम 2 घंटे का फ़ासला रखें।" }, { apart: true }),
  R("normal", ["iron"],
    { en: "Tea, coffee and milk lower the iron your body takes in.", hi: "चाय, कॉफ़ी और दूध से शरीर में आयरन कम पहुँचता है।" },
    { en: "Take it with water or lemon water, not tea or milk.", hi: "इसे पानी या नींबू पानी से लें, चाय या दूध से नहीं।" },
    { other: { en: "tea or milk", hi: "चाय या दूध" } }),
  R("normal", ["metformin"],
    { en: "Taken for years, it can lower vitamin B12.", hi: "सालों तक लेने से विटामिन B12 कम हो सकता है।" },
    { en: "Ask for a B12 blood test once a year.", hi: "साल में एक बार B12 की जाँच करवाने को कहें।" },
    { other: { en: "years of use", hi: "सालों तक लेना" } }),
  R("normal", ["raas"],
    { en: "Low-sodium salt has potassium, and this tablet already raises potassium.", hi: "कम सोडियम वाले नमक में पोटैशियम होता है, और यह दवा पहले से पोटैशियम बढ़ाती है।" },
    { en: "Ask your doctor before switching to it.", hi: "उसे इस्तेमाल करने से पहले डॉक्टर से पूछें।" },
    { other: { en: "low-sodium salt", hi: "कम सोडियम वाला नमक" } }),
];

export type Caution = { level: Severity; title: T; what: T; todo: T; timing?: "apart" | "together"; ai?: boolean };

const text = (m: Med) => `${m.name} ${m.generic}`.toLowerCase();
const is = (m: Med, c: Cls) => CLASSES[c].test(text(m));
export const shortName = (m: Med) => m.name.replace(/^(tab|cap|syp|inj)\.?\s+/i, "").replace(/\s+[\d.]+\s*(mg|mcg|k)?$/i, "");
export const unlisted = (meds: Med[]) => meds.filter((m) => !(Object.keys(CLASSES) as Cls[]).some((c) => is(m, c)));

export function reviewedCautions(meds: Med[]): Caution[] {
  const out: Caution[] = [];
  for (const r of RULES) {
    const groups = r.drugs.map((c) => meds.filter((m) => is(m, c)));
    if (groups.some((g) => !g.length) || r.not?.some((c) => meds.some((m) => is(m, c)))) continue;
    const names = [...new Set(groups.flat().map(shortName))].join(" + ");
    const title = { en: r.other ? `${names} + ${r.other.en}` : names, hi: r.other ? `${names} + ${r.other.hi}` : names };
    // slots are 6+ hours apart, so different slots already keep any "apart" pair far enough apart
    const shared = r.apart && groups[0].some((a) => groups[1].some((b) => a !== b && SLOTS.some((s) => a[s] && b[s])));
    out.push({ level: r.level, title, what: r.what, todo: r.todo, timing: r.apart ? (shared ? "together" : "apart") : undefined });
  }
  return out;
}

export const byLevel = (a: Caution, b: Caution) => SEVERITY_RANK[b.level] - SEVERITY_RANK[a.level];

// ---- AI results for unlisted medicines, saved per medicine list on this device ----
const KEY = "bodymap.mix";
const listeners = new Set<() => void>();
let raw: string | null = null;
let saved: Record<string, Caution[]> = {};
const NONE: Record<string, Caution[]> = {};
const snapshot = () => {
  try { const r = localStorage.getItem(KEY); if (r !== raw) { raw = r; saved = r ? JSON.parse(r) : {}; } } catch {}
  return saved;
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useSavedChecks = () => useSyncExternalStore(subscribe, snapshot, () => NONE);
export const listKey = (meds: Med[]) => meds.map((m) => `${m.name}|${m.generic}`.toLowerCase()).sort().join(";");

const inflight = new Map<string, Promise<boolean>>();
export function checkWithAI(meds: Med[]): Promise<boolean> {
  const key = listKey(meds);
  if (!inflight.has(key)) {
    const body = {
      medicines: meds.map((m) => ({ name: m.name, generic: m.generic, when: SLOTS.filter((s) => m[s]).join(", "), food: m.food })),
      unlisted: unlisted(meds).map((m) => m.name),
    };
    inflight.set(key, fetch("/api/interactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(async (res) => {
        if (!res.ok) return false;
        const { cautions } = (await res.json()) as { cautions: Caution[] };
        try { localStorage.setItem(KEY, JSON.stringify({ ...snapshot(), [key]: cautions.map((c) => ({ ...c, ai: true })) })); } catch {}
        listeners.forEach((l) => l());
        return true;
      })
      .catch(() => false)
      .finally(() => { inflight.delete(key); }));
  }
  return inflight.get(key)!;
}
