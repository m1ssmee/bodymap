"use client";
import { useSyncExternalStore } from "react";
import type { Kind, Region, Severity } from "./medical";

export type Lang = "en" | "hi";
export type Level = "healthy" | "littleHigh" | "high" | "littleLow" | "low";
export type Trend = "better" | "worse" | "steady" | "first";

// ---- language store (remembered on this device) ----
const KEY = "bodymap.lang";
const listeners = new Set<() => void>();
const read = (): Lang => { try { return localStorage.getItem(KEY) === "hi" ? "hi" : "en"; } catch { return "en"; } };
const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l();
  addEventListener("storage", onStorage);
  return () => { listeners.delete(l); removeEventListener("storage", onStorage); };
};
export const useLang = () => useSyncExternalStore(subscribe, read, () => "en" as Lang);
export function setLang(l: Lang) { try { localStorage.setItem(KEY, l); } catch {} listeners.forEach((f) => f()); }
export const useT = () => S[useLang()];

const date = (locale: string) => (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
const parts = (locale: string) => (d: string) => {
  const x = new Date(d + "T00:00:00");
  return { day: String(x.getDate()), month: x.toLocaleDateString(locale, { month: "short" }), weekday: x.toLocaleDateString(locale, { weekday: "short" }) };
};

const EN = {
  lang: "en" as Lang, voice: "en-IN",
  date: date("en-IN"), parts: parts("en-IN"),
  nav: { overview: "Overview", body: "My Body", bodyShort: "Body", records: "Records", medicines: "Medicines", trends: "Trends", upload: "Upload" },
  footer: "BodyMap explains records. It does not diagnose. Confirm with your doctor. Records stay on this device.",
  credits: "Demo patients are fictional. Scans: Wikimedia Commons, CC BY-SA 4.0 (Ptrump16, Ciernik M, Cerevisae).",
  patients: { title: "Patients", active: "Active", add: "Add a family member", name: "Name", age: "Age", female: "Female", male: "Male", addBtn: "Add" },
  landing: { caption: ["Your records,", "explained."], explore: "Explore", swipe: "Swipe up" },
  listen: "Listen", stop: "Stop",
  overview: {
    today: "Today", hello: "Hello", morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening",
    upload: "Upload a record", seeBody: "See my body",
    lastReport: "Last report", flagged: "Flagged", dailyMeds: "Daily medicines", records: "Records",
    areas: (n: number) => (n ? `${n} ${n === 1 ? "area" : "areas"}` : "None"),
    attention: "Needs attention", add: "+ Add",
    nothingFlagged: "Nothing flagged in your records.",
    noRecords: "No records yet. Upload a report and anything worth watching shows up here.",
    nothingHere: "Nothing here yet.",
    quotes: [
      "Be patient with your body. It has carried you this far.",
      "Small numbers, moved slowly, change a life.",
      "You don't have to understand medicine. Only yourself.",
      "Health isn't a finish line. It's a direction.",
      "Every walk counts. Every check-up counts. You count.",
      "We hope today is kind to you.",
      "The greatest wealth is health. — Virgil",
    ],
  },
  body: {
    allRecords: "All records", overview: "Overview", back: "← Overview", backAll: "← All records", remove: "Remove",
    confirmRemove: "Remove this record?", hint: "Drag to turn · Tap a node", total: (n: number) => `${n} total`,
    noFindings: "No findings yet. Upload a report to see it on your body.", noConditions: "No conditions noted",
    findings: (n: number) => (n === 1 ? "1 finding" : `${n} findings`),
  },
  record: {
    findings: "Findings", results: "Results", medicines: "Medicines", advice: "Doctor's advice", ask: "Ask at your next visit",
    healthy: "Healthy", since: (n: string, d: string) => `${n} since ${d}`, translating: "Hindi version on the way…",
  },
  meds: {
    label: "Medicines", updated: (d: string) => `updated ${d}`, title: "Today's plan.",
    note: "From your latest prescriptions. Never stop or change a medicine without asking your doctor.",
    none: "No prescriptions yet. Upload one to see your daily plan.", nothing: "Nothing to take.",
    slots: { morning: "Morning", afternoon: "Afternoon", night: "Night" }, times: { morning: "8 AM", afternoon: "2 PM", night: "8 PM" },
    food: { before: "before food", after: "after food", any: "with or without food" }, advice: "Doctor's advice",
    spoken: (slot: string, list: string) => `${slot}. ${list || "No medicines."}`,
    spokenItem: (name: string, dose: string, food: string, purpose: string) => `${name}, ${dose}, ${food}, for ${purpose}.`,
    mix: {
      title: "Do your medicines mix well?",
      level: { attention: "Ask your doctor", watch: "Be careful", normal: "Good to know" } as Record<Severity, string>,
      none: "No known problems between your medicines.", checking: "Checking your medicines…",
      failed: (names: string) => `Couldn't check ${names} right now. Ask your pharmacist about them.`,
      ai: "Checked by AI · confirm with your pharmacist",
      apart: "Your timing already keeps these apart.",
      together: "In your plan they are taken at the same time. Ask your doctor or pharmacist how to space them.",
      footer: "Tell your doctor about every medicine you take, including shop and ayurvedic medicines. Never stop a medicine on your own.",
    },
  },
  trends: {
    label: "Trends", title: ["Your health", "numbers, simply."],
    intro: "What each test means, whether it is getting better or worse, and what helps.",
    changed: "What's changed", todo: "What you can do", empty: "Upload a blood report to see your numbers here.",
    goodNews: "Good news:", allGood: "All your numbers are in the healthy range. Keep it up.",
    isLevel: (plain: string, level: string, trend: string) => `${plain} is ${level.toLowerCase()} and ${trend.toLowerCase()}.`,
    improving: (plain: string) => `${plain} is getting better.`,
    healthyIs: (range: string) => `healthy is ${range}`, helps: "What helps", lastTests: (n: number) => (n === 1 ? "1 test" : `${n} tests`),
  },
  range: { between: (a: number, b: number, u: string) => `${a} to ${b} ${u}`, below: (b: number, u: string) => `below ${b} ${u}`, above: (a: number, u: string) => `above ${a} ${u}`, none: "not printed" },
  upload: {
    label: "Upload", title: "Add a record.", intro: "Prescription, blood report, X-ray, MRI, CT or ultrasound. A photo or a PDF.",
    photo: "Take a photo", photoSub: "Use your phone camera", file: "Choose a file", fileSub: "JPG, PNG or PDF",
    sample: "Or try a sample", samples: ["Blood report (Oct 2026)", "Handwritten prescription"],
    privacy: "Only the image is sent to be read. Your records stay on this device.",
    reading: "Reading your document", time: "20 to 40 seconds",
    check: "Check before saving", match: "Does this match your paper?", titleField: "Title", dateField: "Date",
    save: "Looks right, save", discard: "Discard", pdfTooBig: "PDF is larger than 4 MB. Try a photo of the page instead.", failed: "Something went wrong.",
  },
  upcoming: {
    title: "Upcoming", add: "+ Add appointment", what: "Doctor or purpose", when: "Date", time: "Time", place: "Place (optional)",
    save: "Save", cancel: "Cancel", none: "Nothing scheduled. Add an appointment, or upload a prescription and its follow-ups appear here.",
    overdue: (n: number) => (n === 1 ? "1 day overdue" : `${n} days overdue`), today: "Today", tomorrow: "Tomorrow",
    inDays: (n: number) => `In ${n} days`, done: "Done", remove: "Remove",
    appointment: "Appointment", followup: (doc: string, d: string) => `Asked by ${doc}, ${d}`,
    routine: (months: number) => (months === 12 ? "Routine check, once a year" : `Routine check, every ${months} months`),
    lastDone: (d: string) => `last done ${d}`, notOnRecord: "not on record yet",
    lab: { "HbA1c": "Average blood sugar test (HbA1c)", "TSH": "Thyroid test (TSH)", "LDL Cholesterol": "Cholesterol test (lipid profile)", "Creatinine": "Kidney test (creatinine)" } as Record<string, string>,
  },
  records: {
    label: "Records", title: "All your records.", intro: "Every prescription, test and scan, newest first. Tap one to see it on your body.",
    filters: { all: "All", prescription: "Prescriptions", blood: "Blood tests", scan: "Scans" }, add: "+ Add a record",
    empty: "No records yet. Upload a prescription or report to start.", none: "Nothing of this kind yet.",
  },
  region: {
    brain: "Brain", eyes: "Eyes", thyroid: "Thyroid", lungs: "Lungs", heart: "Heart", liver: "Liver", stomach: "Stomach",
    pancreas: "Pancreas / sugar", kidneys: "Kidneys", intestines: "Intestines", bladder: "Bladder", spine: "Spine",
    shoulder: "Shoulder", hip: "Hip", knee: "Knee", bones: "Bones", blood: "Blood", general: "General",
  } as Record<Region, string>,
  group: { pancreas: "Sugar", liver: "Liver", kidneys: "Kidneys", heart: "Heart & cholesterol", blood: "Blood", thyroid: "Thyroid", bones: "Bones & vitamins", other: "Other tests" } as Record<string, string>,
  side: { left: "left", right: "right" },
  kind: { prescription: "Prescription", blood: "Blood report", xray: "X-ray", mri: "MRI", ct: "CT scan", ultrasound: "Ultrasound", other: "Medical record" } as Record<Kind, string>,
  sev: { normal: "Normal", watch: "Keep an eye", attention: "Talk to doctor" } as Record<Severity, string>,
  level: { healthy: "Healthy", littleHigh: "A little high", high: "High", littleLow: "A little low", low: "Low" } as Record<Level, string>,
  trend: { better: "Getting better", worse: "Getting worse", steady: "Steady", first: "First reading" } as Record<Trend, string>,
};

const HI: typeof EN = {
  lang: "hi", voice: "hi-IN",
  date: date("hi-IN"), parts: parts("hi-IN"),
  nav: { overview: "सारांश", body: "मेरा शरीर", bodyShort: "शरीर", records: "रिपोर्ट", medicines: "दवाइयाँ", trends: "जाँच", upload: "अपलोड" },
  footer: "BodyMap आपकी रिपोर्ट समझाता है, बीमारी तय नहीं करता। अपने डॉक्टर से ज़रूर पूछें। आपकी रिपोर्ट इसी फ़ोन में रहती हैं।",
  credits: "डेमो मरीज़ काल्पनिक हैं। स्कैन: Wikimedia Commons, CC BY-SA 4.0 (Ptrump16, Ciernik M, Cerevisae)।",
  patients: { title: "मरीज़", active: "चालू", add: "परिवार का सदस्य जोड़ें", name: "नाम", age: "उम्र", female: "महिला", male: "पुरुष", addBtn: "जोड़ें" },
  landing: { caption: ["आपकी रिपोर्ट,", "आसान भाषा में।"], explore: "शुरू करें", swipe: "ऊपर स्वाइप करें" },
  listen: "सुनें", stop: "रोकें",
  overview: {
    today: "आज", hello: "नमस्ते", morning: "सुप्रभात", afternoon: "नमस्ते", evening: "शुभ संध्या",
    upload: "रिपोर्ट जोड़ें", seeBody: "मेरा शरीर देखें",
    lastReport: "पिछली रिपोर्ट", flagged: "ध्यान देने लायक", dailyMeds: "रोज़ की दवाइयाँ", records: "रिपोर्ट",
    areas: (n: number) => (n ? `${n} जगह` : "कोई नहीं"),
    attention: "ध्यान देने की ज़रूरत", add: "+ जोड़ें",
    nothingFlagged: "आपकी रिपोर्ट में कुछ भी चिंता वाला नहीं है।",
    noRecords: "अभी कोई रिपोर्ट नहीं है। रिपोर्ट जोड़ें, ध्यान देने वाली बातें यहाँ दिखेंगी।",
    nothingHere: "अभी यहाँ कुछ नहीं है।",
    quotes: [
      "अपने शरीर के साथ धीरज रखें। इसने आपको यहाँ तक पहुँचाया है।",
      "छोटे-छोटे बदलाव, धीरे-धीरे, ज़िंदगी बदल देते हैं।",
      "दवा समझना ज़रूरी नहीं। बस ख़ुद को समझिए।",
      "सेहत कोई मंज़िल नहीं, एक दिशा है।",
      "हर सैर मायने रखती है। हर जाँच मायने रखती है। आप मायने रखते हैं।",
      "आशा है, आज का दिन आपके लिए अच्छा हो।",
      "सबसे बड़ा धन, सेहत है। — वर्जिल",
    ],
  },
  body: {
    allRecords: "सारी रिपोर्ट", overview: "सारांश", back: "← सारांश", backAll: "← सारी रिपोर्ट", remove: "हटाएँ",
    confirmRemove: "यह रिपोर्ट हटा दें?", hint: "घुमाने के लिए खींचें · किसी बिंदु को छुएँ", total: (n: number) => `कुल ${n}`,
    noFindings: "अभी कोई जानकारी नहीं। रिपोर्ट जोड़ें, वह आपके शरीर पर दिखेगी।", noConditions: "कोई बीमारी दर्ज नहीं",
    findings: (n: number) => (n === 1 ? "1 बात" : `${n} बातें`),
  },
  record: {
    findings: "क्या मिला", results: "जाँच के नतीजे", medicines: "दवाइयाँ", advice: "डॉक्टर की सलाह", ask: "अगली बार डॉक्टर से पूछें",
    healthy: "सही स्तर", since: (n: string, d: string) => `${d} से ${n}`, translating: "हिंदी अनुवाद आ रहा है…",
  },
  meds: {
    label: "दवाइयाँ", updated: (d: string) => `${d} को बदला गया`, title: "आज की दवाइयाँ।",
    note: "आपके नए पर्चों से। डॉक्टर से पूछे बिना कोई दवा बंद या कम-ज़्यादा न करें।",
    none: "अभी कोई पर्चा नहीं है। पर्चा जोड़ें, रोज़ की दवाइयाँ यहाँ दिखेंगी।", nothing: "कुछ नहीं लेना है।",
    slots: { morning: "सुबह", afternoon: "दोपहर", night: "रात" }, times: { morning: "8 बजे", afternoon: "2 बजे", night: "8 बजे" },
    food: { before: "खाने से पहले", after: "खाने के बाद", any: "खाने से पहले या बाद" }, advice: "डॉक्टर की सलाह",
    spoken: (slot: string, list: string) => `${slot}। ${list || "कोई दवा नहीं।"}`,
    spokenItem: (name: string, dose: string, food: string, purpose: string) => `${name}, ${dose}, ${food}, ${purpose} के लिए।`,
    mix: {
      title: "क्या आपकी दवाइयाँ साथ में ठीक हैं?",
      level: { attention: "डॉक्टर से पूछें", watch: "सावधान रहें", normal: "जानने लायक" },
      none: "आपकी दवाइयों के बीच कोई जानी-मानी दिक़्क़त नहीं है।", checking: "आपकी दवाइयाँ जाँची जा रही हैं…",
      failed: (names: string) => `${names} की जाँच अभी नहीं हो पाई। फ़ार्मासिस्ट से इनके बारे में पूछें।`,
      ai: "AI से जाँचा गया · फ़ार्मासिस्ट से पक्का करें",
      apart: "आपकी योजना में इनके बीच पहले से फ़ासला है।",
      together: "आपकी योजना में दोनों एक ही समय पर हैं। डॉक्टर या फ़ार्मासिस्ट से पूछें कि फ़ासला कैसे रखें।",
      footer: "आप जो भी दवा लेते हैं, डॉक्टर को बताएँ, दुकान से ली गई और आयुर्वेदिक दवाइयाँ भी। कोई भी दवा अपने आप बंद न करें।",
    },
  },
  trends: {
    label: "जाँच", title: ["आपकी सेहत के आँकड़े,", "आसान भाषा में।"],
    intro: "हर जाँच का मतलब, वह सुधर रही है या बिगड़ रही है, और क्या करने से मदद मिलती है।",
    changed: "क्या बदला", todo: "आप क्या कर सकते हैं", empty: "खून की जाँच की रिपोर्ट जोड़ें, आपके आँकड़े यहाँ दिखेंगे।",
    goodNews: "अच्छी ख़बर:", allGood: "आपके सारे आँकड़े सही स्तर पर हैं। ऐसे ही बनाए रखें।",
    isLevel: (plain: string, level: string, trend: string) => `${plain}: ${level}, और ${trend}।`,
    improving: (plain: string) => `${plain} सुधर रहा है।`,
    healthyIs: (range: string) => `सही स्तर ${range}`, helps: "क्या मदद करता है", lastTests: (n: number) => `${n} जाँचें`,
  },
  range: { between: (a: number, b: number, u: string) => `${a} से ${b} ${u}`, below: (b: number, u: string) => `${b} ${u} से कम`, above: (a: number, u: string) => `${a} ${u} से ज़्यादा`, none: "छपा नहीं है" },
  upload: {
    label: "अपलोड", title: "रिपोर्ट जोड़ें।", intro: "पर्चा, खून की जाँच, एक्स-रे, एमआरआई, सीटी या अल्ट्रासाउंड। फ़ोटो या PDF।",
    photo: "फ़ोटो लें", photoSub: "फ़ोन के कैमरे से", file: "फ़ाइल चुनें", fileSub: "JPG, PNG या PDF",
    sample: "या नमूना आज़माएँ", samples: ["खून की जाँच (अक्टूबर 2026)", "हाथ से लिखा पर्चा"],
    privacy: "सिर्फ़ फ़ोटो पढ़ने के लिए भेजी जाती है। आपकी रिपोर्ट इसी फ़ोन में रहती हैं।",
    reading: "आपकी रिपोर्ट पढ़ी जा रही है", time: "20 से 40 सेकंड",
    check: "सेव करने से पहले जाँचें", match: "क्या यह आपके कागज़ से मेल खाता है?", titleField: "शीर्षक", dateField: "तारीख़",
    save: "सही है, सेव करें", discard: "रद्द करें", pdfTooBig: "PDF 4 MB से बड़ी है। पन्ने की फ़ोटो लेकर कोशिश करें।", failed: "कुछ गड़बड़ हो गई।",
  },
  upcoming: {
    title: "आने वाली तारीख़ें", add: "+ अपॉइंटमेंट जोड़ें", what: "डॉक्टर या काम", when: "तारीख़", time: "समय", place: "जगह (ज़रूरी नहीं)",
    save: "सेव करें", cancel: "रद्द करें", none: "अभी कुछ तय नहीं है। अपॉइंटमेंट जोड़ें, या पर्चा अपलोड करें, उसमें लिखी अगली जाँचें यहाँ दिखेंगी।",
    overdue: (n: number) => `${n} दिन से बाकी`, today: "आज", tomorrow: "कल",
    inDays: (n: number) => `${n} दिन में`, done: "हो गया", remove: "हटाएँ",
    appointment: "अपॉइंटमेंट", followup: (doc: string, d: string) => `${doc} ने कहा था, ${d}`,
    routine: (months: number) => (months === 12 ? "नियमित जाँच, साल में एक बार" : `नियमित जाँच, हर ${months} महीने`),
    lastDone: (d: string) => `पिछली बार ${d}`, notOnRecord: "अभी रिकॉर्ड में नहीं",
    lab: { "HbA1c": "औसत शुगर की जाँच (HbA1c)", "TSH": "थायरॉइड की जाँच (TSH)", "LDL Cholesterol": "कोलेस्ट्रॉल की जाँच (लिपिड प्रोफ़ाइल)", "Creatinine": "किडनी की जाँच (क्रिएटिनिन)" },
  },
  records: {
    label: "रिपोर्ट", title: "आपकी सारी रिपोर्ट।", intro: "हर पर्चा, जाँच और स्कैन, नई सबसे पहले। किसी को छुएँ, वह आपके शरीर पर दिखेगी।",
    filters: { all: "सभी", prescription: "पर्चे", blood: "खून की जाँच", scan: "स्कैन" }, add: "+ रिपोर्ट जोड़ें",
    empty: "अभी कोई रिपोर्ट नहीं है। शुरू करने के लिए पर्चा या रिपोर्ट अपलोड करें।", none: "इस तरह की कोई रिपोर्ट अभी नहीं है।",
  },
  region: {
    brain: "दिमाग", eyes: "आँखें", thyroid: "थायरॉइड", lungs: "फेफड़े", heart: "दिल", liver: "लिवर", stomach: "पेट",
    pancreas: "शुगर (अग्न्याशय)", kidneys: "किडनी", intestines: "आँतें", bladder: "मूत्राशय", spine: "रीढ़",
    shoulder: "कंधा", hip: "कूल्हा", knee: "घुटना", bones: "हड्डियाँ", blood: "खून", general: "सामान्य",
  },
  group: { pancreas: "शुगर", liver: "लिवर", kidneys: "किडनी", heart: "दिल और कोलेस्ट्रॉल", blood: "खून", thyroid: "थायरॉइड", bones: "हड्डियाँ और विटामिन", other: "अन्य जाँचें" },
  side: { left: "बायाँ", right: "दायाँ" },
  kind: { prescription: "पर्चा", blood: "खून की जाँच", xray: "एक्स-रे", mri: "एमआरआई", ct: "सीटी स्कैन", ultrasound: "अल्ट्रासाउंड", other: "मेडिकल रिपोर्ट" },
  sev: { normal: "सामान्य", watch: "ध्यान रखें", attention: "डॉक्टर से बात करें" },
  level: { healthy: "सही स्तर पर", littleHigh: "थोड़ा ज़्यादा", high: "ज़्यादा", littleLow: "थोड़ा कम", low: "कम" },
  trend: { better: "सुधर रहा है", worse: "बिगड़ रहा है", steady: "स्थिर है", first: "पहली जाँच" },
};

export const S = { en: EN, hi: HI };
export type Strings = typeof EN;
