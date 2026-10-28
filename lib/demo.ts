import { level, type Appointment, type HiText, type Lab, type MedRecord, type Patient, type Region } from "./medical";

// Fictional family. Live demo uploads for Ramesh (not preloaded): blood report 24 Oct 2026 + handwritten prescription.
export const DEMO_PATIENTS: Patient[] = [
  { id: "ramesh", name: "Ramesh Iyer", age: 68, sex: "M", conditions: ["Type 2 diabetes", "High blood pressure"], conditionsHi: ["टाइप 2 डायबिटीज़", "हाई BP"] },
  { id: "lakshmi", name: "Lakshmi Iyer", age: 63, sex: "F", conditions: ["Hypothyroidism"], conditionsHi: ["धीमा थायरॉइड"] },
];

// Plain words for the demo patients' tests, written by hand. Uploaded reports get these from the reader.
type Words = { plain: string; about: string; ok: string; off: string };
const DESC: Record<string, { region: Region; en: Words; hi: Words }> = {
  "HbA1c": { region: "pancreas",
    en: { plain: "Average blood sugar", about: "Your sugar level over the last 3 months, like a report card.", ok: "Keep up your walks and regular meals to keep it here.", off: "A 20–30 minute walk after meals and fewer sweets and white rice help bring this down. Ask your doctor about this." },
    hi: { plain: "औसत शुगर", about: "पिछले 3 महीनों की आपकी शुगर, एक रिपोर्ट कार्ड की तरह।", ok: "रोज़ टहलना और समय पर खाना जारी रखें, ताकि यह ऐसे ही बना रहे।", off: "खाने के बाद 20–30 मिनट टहलें और मिठाई व सफ़ेद चावल कम करें। इस बारे में डॉक्टर से पूछें।" } },
  "Fasting Glucose": { region: "pancreas",
    en: { plain: "Morning sugar", about: "Your blood sugar in the morning, before eating.", ok: "Keep dinner light and early to keep it steady.", off: "Eat dinner early and light, and walk after it. Take your sugar medicine as prescribed." },
    hi: { plain: "सुबह की शुगर", about: "सुबह खाली पेट आपकी शुगर।", ok: "रात का खाना हल्का और जल्दी खाते रहें।", off: "रात का खाना जल्दी और हल्का खाएँ, उसके बाद टहलें। शुगर की दवा डॉक्टर के बताए अनुसार लें।" } },
  "SGPT (ALT)": { region: "liver",
    en: { plain: "Liver stress signal", about: "Rises when the liver is irritated, often by extra fat in it.", ok: "Home-cooked food and less fried food keep your liver happy.", off: "Cut down fried and outside food and avoid alcohol. Ask your doctor about this." },
    hi: { plain: "लिवर का तनाव संकेत", about: "जब लिवर परेशान होता है, अक्सर उसमें चर्बी से, तब यह बढ़ता है।", ok: "घर का खाना और कम तला खाना लिवर के लिए अच्छा है।", off: "तला हुआ और बाहर का खाना कम करें, शराब से बचें। इस बारे में डॉक्टर से पूछें।" } },
  "SGOT (AST)": { region: "liver",
    en: { plain: "Second liver signal", about: "Another sign of liver strain, read together with the first.", ok: "Home-cooked food and less fried food keep your liver happy.", off: "Cut down fried and outside food and avoid alcohol. Ask your doctor about this." },
    hi: { plain: "लिवर का दूसरा संकेत", about: "लिवर पर दबाव का एक और संकेत, पहले वाले के साथ देखा जाता है।", ok: "घर का खाना और कम तला खाना लिवर के लिए अच्छा है।", off: "तला हुआ और बाहर का खाना कम करें, शराब से बचें। इस बारे में डॉक्टर से पूछें।" } },
  "Creatinine": { region: "kidneys",
    en: { plain: "Kidney cleaning test", about: "A waste your kidneys clean out. If it builds up, they are cleaning less well.", ok: "Drink enough water through the day to keep your kidneys working well.", off: "Drink enough water and avoid painkillers without asking your doctor." },
    hi: { plain: "किडनी सफ़ाई जाँच", about: "एक गंदगी जिसे किडनी साफ़ करती है। बढ़े तो मतलब किडनी कम साफ़ कर रही है।", ok: "दिन भर पर्याप्त पानी पीते रहें, ताकि किडनी ठीक काम करे।", off: "पर्याप्त पानी पिएँ और डॉक्टर से पूछे बिना दर्द की गोलियाँ न लें।" } },
  "LDL Cholesterol": { region: "heart",
    en: { plain: "Bad cholesterol", about: "Sticks to the inside of blood vessels, like grease in a pipe.", ok: "Keep oily food low to keep your blood vessels clear.", off: "Less ghee, butter and fried snacks, more vegetables and dal. Take your cholesterol tablet every night." },
    hi: { plain: "ख़राब कोलेस्ट्रॉल", about: "नसों के अंदर चिपकता है, जैसे पाइप में चिकनाई।", ok: "तेल वाला खाना कम रखें, ताकि नसें साफ़ रहें।", off: "घी, मक्खन और तले नमकीन कम करें, सब्ज़ी और दाल ज़्यादा खाएँ। कोलेस्ट्रॉल की गोली रोज़ रात लें।" } },
  "Triglycerides": { region: "heart",
    en: { plain: "Blood fat", about: "Fat in your blood that rises with sweets, rice and oily food.", ok: "Keep sweets and oily food low.", off: "Cut down sweets, sugary tea and large rice portions. Walk daily." },
    hi: { plain: "खून में चर्बी", about: "खून में चर्बी, जो मिठाई, चावल और तेल वाले खाने से बढ़ती है।", ok: "मिठाई और तेल वाला खाना कम रखें।", off: "मिठाई, मीठी चाय और ज़्यादा चावल कम करें। रोज़ टहलें।" } },
  "Hemoglobin": { region: "blood",
    en: { plain: "Oxygen carrier", about: "Carries oxygen around your body. When it is low you feel tired.", ok: "Iron-rich food like dal and greens keeps this healthy.", off: "Eat iron-rich food like spinach, dal, jaggery and dates. Ask your doctor about this." },
    hi: { plain: "ऑक्सीजन ले जाने वाला", about: "शरीर में ऑक्सीजन पहुँचाता है। कम हो तो थकान होती है।", ok: "दाल और हरी सब्ज़ियाँ इसे ठीक रखती हैं।", off: "आयरन वाला खाना खाएँ, जैसे पालक, दाल, गुड़ और खजूर। इस बारे में डॉक्टर से पूछें।" } },
  "Vitamin D": { region: "bones",
    en: { plain: "Sunshine vitamin", about: "Keeps bones strong. Most people in India are low.", ok: "A little morning sun each day keeps it here.", off: "Sit in morning sunlight for 15–20 minutes and take the vitamin D your doctor prescribed." },
    hi: { plain: "धूप वाला विटामिन", about: "हड्डियाँ मज़बूत रखता है। भारत में ज़्यादातर लोगों में यह कम होता है।", ok: "रोज़ सुबह थोड़ी धूप इसे ठीक रखती है।", off: "सुबह 15–20 मिनट धूप में बैठें और डॉक्टर का बताया विटामिन D लें।" } },
  "TSH": { region: "thyroid",
    en: { plain: "Thyroid signal", about: "The brain's call to your thyroid. A high call means the thyroid is slow.", ok: "Keep taking your thyroid tablet at the same time every morning.", off: "Take your thyroid tablet every morning on an empty stomach, 30 minutes before tea or food. Ask your doctor about this." },
    hi: { plain: "थायरॉइड संकेत", about: "दिमाग़ थायरॉइड को काम करने के लिए कहता है। संकेत ज़्यादा हो तो थायरॉइड धीमा है।", ok: "थायरॉइड की गोली रोज़ सुबह एक ही समय पर लेते रहें।", off: "थायरॉइड की गोली रोज़ सुबह खाली पेट, चाय या खाने से 30 मिनट पहले लें। इस बारे में डॉक्टर से पूछें।" } },
  "Vitamin B12": { region: "blood",
    en: { plain: "Nerve vitamin (B12)", about: "Keeps nerves and blood healthy. When low it can cause tingling and tiredness.", ok: "Milk and curd every day keep this healthy.", off: "Milk, curd and paneer help. Take the B12 your doctor prescribed." },
    hi: { plain: "नसों का विटामिन (B12)", about: "नसें और खून स्वस्थ रखता है। कम हो तो झनझनाहट और थकान हो सकती है।", ok: "रोज़ दूध और दही इसे ठीक रखते हैं।", off: "दूध, दही और पनीर मदद करते हैं। डॉक्टर का बताया B12 लें।" } },
  "Calcium": { region: "bones",
    en: { plain: "Bone mineral", about: "Builds your bones and keeps them strong.", ok: "Milk, curd and a little sun keep your bones strong.", off: "Milk, curd and ragi help. Ask your doctor about this." },
    hi: { plain: "हड्डियों का खनिज", about: "हड्डियाँ बनाता है और उन्हें मज़बूत रखता है।", ok: "दूध, दही और थोड़ी धूप हड्डियाँ मज़बूत रखते हैं।", off: "दूध, दही और रागी मदद करते हैं। इस बारे में डॉक्टर से पूछें।" } },
};
const words = (l: Lab, lang: "en" | "hi") => {
  const w = DESC[l.name][lang];
  return { plain: w.plain, about: w.about, tip: level(l.value, l.low, l.high) === "healthy" ? w.ok : w.off };
};
const lab = (name: string, value: number, unit: string, low: number | null, high: number | null): Lab => {
  const l: Lab = { name, value, unit, low, high, flag: low !== null && value < low ? "low" : high !== null && value > high ? "high" : "normal" };
  return { ...l, ...words(l, "en"), region: DESC[name].region };
};

// Hand-written Hindi for each demo record (labs come from the table above).
const HI: Record<string, Omit<HiText, "labs">> = {
  "demo-blood-1": { title: "खून की जाँच", summary: "आपकी शुगर लक्ष्य से थोड़ी ज़्यादा थी और विटामिन D कम था। लिवर और किडनी की जाँच सामान्य थी।",
    findings: [
      { title: "शुगर थोड़ी ज़्यादा", explanation: "आपकी 3 महीने की औसत शुगर (HbA1c) 6.6% है। सही स्तर से थोड़ी ऊपर, डायबिटीज़ में आम बात है।" },
      { title: "विटामिन D कम", explanation: "विटामिन D हड्डियों को मज़बूत रखता है। आपका कम है, जो भारत में बहुत आम है।" },
      { title: "लिवर की जाँच सामान्य", explanation: "आपके लिवर का एंज़ाइम (SGPT) सही स्तर पर है।" }],
    medicines: [], advice: [],
    questions: ["क्या मेरी शुगर ठीक काबू में है, या इलाज बदलना चाहिए?", "क्या मुझे विटामिन D की गोलियाँ लेनी चाहिए?", "मुझे HbA1c की जाँच कितनी बार करानी चाहिए?"] },
  "demo-xray": { title: "छाती का एक्स-रे", summary: "आपका छाती का एक्स-रे सामान्य है। दिल का आकार ठीक है और दोनों फेफड़े साफ़ हैं।",
    findings: [
      { title: "दिल का आकार सामान्य", explanation: "दिल बड़ा नहीं है। लंबे समय से BP वाले व्यक्ति के लिए यह अच्छी ख़बर है।" },
      { title: "फेफड़े साफ़", explanation: "आपके फेफड़ों में कोई संक्रमण, पानी या धब्बा नहीं है।" }],
    medicines: [], advice: [],
    questions: ["छाती का एक्स-रे कितने समय बाद फिर कराना चाहिए?", "क्या BP के कारण मुझे ECG या इको करानी चाहिए?", "क्या मुझे साँस फूलने या पैरों में सूजन पर ध्यान देना चाहिए?"] },
  "demo-blood-2": { title: "खून की जाँच", summary: "अक्टूबर से शुगर बढ़ी है। लिवर का एंज़ाइम अब सामान्य से थोड़ा ऊपर है। विटामिन D सुधरा है पर अभी भी कम है।",
    findings: [
      { title: "शुगर बढ़ रही है", explanation: "HbA1c 6.6% से बढ़कर 7.1% हो गया। डायबिटीज़ को थोड़ा और काबू करने की ज़रूरत है।" },
      { title: "लिवर एंज़ाइम थोड़ा ज़्यादा", explanation: "SGPT 41 है, सीमा 40 है। अक्सर लिवर में चर्बी से जुड़ा होता है। ध्यान रखने लायक।" },
      { title: "ख़राब कोलेस्ट्रॉल ज़्यादा", explanation: "LDL (ख़राब कोलेस्ट्रॉल) 136 है। डायबिटीज़ वालों के लिए डॉक्टर इसे 100 से कम चाहते हैं।" },
      { title: "किडनी सामान्य", explanation: "क्रिएटिनिन सामान्य है, यानी किडनी ठीक से सफ़ाई कर रही है।" }],
    medicines: [], advice: [],
    questions: ["मेरी शुगर बढ़ गई है। क्या दवा बढ़ानी होगी?", "क्या मेरी लिवर की जाँच चिंता की बात है?", "क्या मुझे कोलेस्ट्रॉल की गोली शुरू करनी चाहिए?"] },
  "demo-rx": { title: "पर्चा — Dr. Anita Rao", summary: "शुगर, BP और कोलेस्ट्रॉल के लिए रोज़ की तीन दवाइयाँ, और हफ़्ते में एक बार विटामिन D का पाउच। 6 महीने बाद खून की जाँच के साथ दोबारा मिलें।",
    findings: [],
    medicines: [
      { dose: "500 mg, 1 गोली", purpose: "शुगर काबू में रखती है", duration: "6 महीने" },
      { dose: "40 mg, 1 गोली", purpose: "BP कम करती है", duration: "6 महीने" },
      { dose: "10 mg, 1 गोली", purpose: "कोलेस्ट्रॉल कम करती है", duration: "6 महीने" },
      { dose: "1 पाउच दूध में, हर रविवार", purpose: "हड्डियों के लिए विटामिन D", duration: "8 हफ़्ते" }],
    advice: ["मिठाई, मीठी चाय और ज़्यादा सफ़ेद चावल से बचें।", "रोज़ 30 मिनट टहलें।", "हफ़्ते में दो बार घर पर शुगर जाँचें।", "6 महीने बाद HbA1c और लिवर की जाँच के साथ आएँ।"],
    questions: ["अगर खाना छूट जाए तो क्या Metformin ले सकता हूँ?", "क्या मुझे घर पर BP भी जाँचना चाहिए?", "किन साइड इफ़ेक्ट पर ध्यान देना चाहिए?"],
    followUps: [{ title: "Dr. Anita Rao से दोबारा मिलें — HbA1c और लिवर की जाँच साथ लाएँ" }] },
  "demo-mri": { title: "दाएँ घुटने का MRI", summary: "दाएँ घुटने में उम्र के साथ होने वाली घिसावट: अंदर के गद्दे (मेनिस्कस) में छोटी दरार और कार्टिलेज का थोड़ा पतला होना, साथ में थोड़ा पानी।",
    findings: [
      { title: "घुटने के गद्दे में छोटी दरार", explanation: "मेनिस्कस घुटने में रबर जैसा गद्दा है। आपके अंदर की तरफ़ घिसावट से छोटी दरार है। 60 के बाद बहुत आम है और अक्सर ऑपरेशन नहीं, व्यायाम से ठीक होता है।" },
      { title: "कार्टिलेज की शुरुआती घिसावट", explanation: "घुटने की कटोरी के पीछे की चिकनी परत थोड़ी पतली हुई है (शुरुआती गठिया)।" }],
    medicines: [], advice: [],
    questions: ["क्या फ़िज़ियोथेरेपी से मदद मिलेगी, या ऑपरेशन करना होगा?", "मेरे घुटने के लिए कौन से व्यायाम सुरक्षित हैं?", "क्या रोज़ 30 मिनट टहलना ठीक है?"] },
  "demo-usg": { title: "पेट का अल्ट्रासाउंड", summary: "लिवर में थोड़ी चर्बी (ग्रेड 1 फैटी लिवर)। किडनी, पित्ताशय और बाकी अंग सामान्य दिखते हैं।",
    findings: [
      { title: "हल्का फैटी लिवर", explanation: "लिवर में थोड़ी ज़्यादा चर्बी जमा है। डायबिटीज़ में यह आम है और खान-पान, टहलने और शुगर काबू करने से अक्सर सुधर जाता है।" },
      { title: "किडनी स्वस्थ", explanation: "दोनों किडनी सामान्य आकार की हैं और पथरी नहीं है।" }],
    medicines: [], advice: [],
    questions: ["लिवर की चर्बी कैसे कम करूँ?", "क्या बाद में फिर अल्ट्रासाउंड कराना होगा?", "क्या मेरी डायबिटीज़ की दवा लिवर के लिए सुरक्षित है?"] },
  "demo-l-blood": { title: "थायरॉइड और खून की जाँच", summary: "आपका थायरॉइड धीमा काम कर रहा है, और खून व विटामिन B12 थोड़े कम हैं। कैल्शियम सामान्य है।",
    findings: [
      { title: "थायरॉइड धीमा", explanation: "TSH 7.8 है, यानी आपका थायरॉइड धीरे काम कर रहा है। इससे थकान और वज़न बढ़ सकता है। रोज़ की एक गोली से इलाज होता है।" },
      { title: "हल्की ख़ून की कमी", explanation: "हीमोग्लोबिन थोड़ा कम है, इसलिए खून थोड़ी कम ऑक्सीजन ले जाता है। अक्सर आयरन या B12 की कमी से।" },
      { title: "विटामिन B12 कम", explanation: "B12 नसों और खून को स्वस्थ रखता है। आपका थोड़ा कम है।" },
      { title: "कैल्शियम सामान्य", explanation: "हड्डियों के लिए कैल्शियम सही स्तर पर है।" }],
    medicines: [], advice: [],
    questions: ["थायरॉइड की गोली कब तक लेनी होगी?", "क्या मुझे आयरन की गोली भी लेनी चाहिए?", "TSH की जाँच दोबारा कब करानी है?"] },
  "demo-l-rx": { title: "पर्चा — Dr. Meera Nair", summary: "खाली पेट रोज़ थायरॉइड की एक गोली, साथ में B12 और आयरन। छह हफ़्ते बाद थायरॉइड की जाँच दोबारा कराएँ।",
    findings: [],
    medicines: [
      { dose: "50 mcg, 1 गोली", purpose: "थायरॉइड हार्मोन", duration: "लंबे समय तक" },
      { dose: "1 गोली", purpose: "खून के लिए आयरन", duration: "3 महीने" },
      { dose: "1500 mcg, 1 गोली", purpose: "विटामिन B12", duration: "3 महीने" }],
    advice: ["थायरॉइड की गोली नाश्ते से 30 मिनट पहले सादे पानी से लें।", "थायरॉइड की गोली के 4 घंटे के अंदर आयरन न लें।", "6 हफ़्ते बाद TSH की जाँच कराएँ।"],
    questions: ["अगर किसी सुबह थायरॉइड की गोली भूल जाऊँ तो क्या करूँ?", "क्या इसे चाय के साथ ले सकती हूँ?", "क्या जल्दी थकान कम होगी?"],
    followUps: [{ title: "थायरॉइड (TSH) की जाँच दोबारा कराएँ" }] },
};
const withHi = (rs: MedRecord[]) => rs.map((r) => ({ ...r, hi: { ...HI[r.id], labs: r.labs.map((l) => words(l, "hi")) } }));

const RAMESH: MedRecord[] = [
  {
    id: "demo-blood-1", kind: "blood", title: "Blood report", date: "2025-10-18", doctor: "Dr. Anita Rao", facility: "Sunrise Diagnostics, Bengaluru",
    summary: "Your sugar control was slightly above target and vitamin D was low. Liver and kidney tests were normal.",
    labs: [lab("HbA1c", 6.6, "%", 4, 5.6), lab("Fasting Glucose", 112, "mg/dL", 70, 100), lab("SGPT (ALT)", 30, "U/L", 0, 40), lab("Creatinine", 0.9, "mg/dL", 0.7, 1.3), lab("LDL Cholesterol", 124, "mg/dL", 0, 100), lab("Triglycerides", 160, "mg/dL", 0, 150), lab("Hemoglobin", 13.8, "g/dL", 13, 17), lab("Vitamin D", 18, "ng/mL", 30, 100)],
    findings: [
      { title: "Sugar slightly high", explanation: "Your 3-month average sugar (HbA1c) is 6.6%. A little above the healthy range, common with diabetes.", severity: "watch", region: "pancreas", side: "none", quote: "HbA1c 6.6 %" },
      { title: "Low vitamin D", explanation: "Vitamin D helps keep bones strong. Yours is low, which is very common in India.", severity: "watch", region: "bones", side: "none", quote: "25-OH Vitamin D 18 ng/mL" },
      { title: "Liver tests normal", explanation: "Your liver enzyme (SGPT) is in the healthy range.", severity: "normal", region: "liver", side: "none", quote: "SGPT 30 U/L" },
    ],
    medicines: [], advice: [], image: "/demo/01-blood-oct25.png",
    questions: ["Is my sugar control good enough, or should we change my plan?", "Do I need vitamin D tablets?", "How often should I test my HbA1c?"],
  },
  {
    id: "demo-xray", kind: "xray", title: "Chest X-ray", date: "2026-02-10", doctor: "Dr. S. Menon (Radiologist)", facility: "City Imaging Centre",
    summary: "Your chest X-ray is normal. The heart is a normal size and both lungs are clear.",
    findings: [
      { title: "Heart size normal", explanation: "The heart is not enlarged. Good news for someone with long-standing high blood pressure.", severity: "normal", region: "heart", side: "none", quote: "Cardiac size within normal limits (CTR 0.46)" },
      { title: "Lungs clear", explanation: "No infection, fluid or patches in your lungs.", severity: "normal", region: "lungs", side: "both", quote: "Both lung fields are clear" },
    ],
    medicines: [], labs: [], advice: [], image: "/demo/04-cxr.jpg",
    questions: ["How often should I repeat a chest X-ray?", "Do I need an ECG or echo for my heart with my BP?", "Should I watch for breathlessness or swelling in my feet?"],
  },
  {
    id: "demo-blood-2", kind: "blood", title: "Blood report", date: "2026-04-20", doctor: "Dr. Anita Rao", facility: "Sunrise Diagnostics, Bengaluru",
    summary: "Sugar has gone up since October. Your liver enzyme is now just above normal. Vitamin D has improved but is still low.",
    labs: [lab("HbA1c", 7.1, "%", 4, 5.6), lab("Fasting Glucose", 128, "mg/dL", 70, 100), lab("SGPT (ALT)", 41, "U/L", 0, 40), lab("Creatinine", 1.0, "mg/dL", 0.7, 1.3), lab("LDL Cholesterol", 136, "mg/dL", 0, 100), lab("Triglycerides", 178, "mg/dL", 0, 150), lab("Hemoglobin", 13.5, "g/dL", 13, 17), lab("Vitamin D", 24, "ng/mL", 30, 100)],
    findings: [
      { title: "Sugar going up", explanation: "HbA1c rose from 6.6% to 7.1%. Your diabetes needs a little more control.", severity: "attention", region: "pancreas", side: "none", quote: "HbA1c 7.1 %" },
      { title: "Liver enzyme just above normal", explanation: "SGPT is 41, the limit is 40. Often linked to fat in the liver. Worth watching.", severity: "watch", region: "liver", side: "none", quote: "SGPT 41 U/L" },
      { title: "Bad cholesterol high", explanation: "LDL ('bad' cholesterol) is 136. For people with diabetes doctors like it below 100.", severity: "watch", region: "heart", side: "none", quote: "LDL 136 mg/dL" },
      { title: "Kidneys normal", explanation: "Creatinine is normal, so your kidneys are filtering well.", severity: "normal", region: "kidneys", side: "both", quote: "Creatinine 1.0 mg/dL" },
    ],
    medicines: [], advice: [], image: "/demo/02-blood-apr26.png",
    questions: ["My sugar went up. Do I need a higher dose?", "Is my liver test something to worry about?", "Should I start a cholesterol tablet?"],
  },
  {
    id: "demo-rx", kind: "prescription", title: "Prescription — Dr. Anita Rao", date: "2026-04-20", doctor: "Dr. Anita Rao, MD", facility: "Rao Diabetes & Heart Clinic",
    summary: "Three daily medicines for sugar, blood pressure and cholesterol, plus a weekly vitamin D sachet. Review after 6 months with a blood test.",
    findings: [],
    medicines: [
      { name: "Tab. Glycomet 500", generic: "Metformin", dose: "500 mg, 1 tablet", morning: true, afternoon: false, night: true, food: "after", purpose: "Controls blood sugar", duration: "6 months" },
      { name: "Tab. Telma 40", generic: "Telmisartan", dose: "40 mg, 1 tablet", morning: true, afternoon: false, night: false, food: "any", purpose: "Lowers blood pressure", duration: "6 months" },
      { name: "Tab. Atorva 10", generic: "Atorvastatin", dose: "10 mg, 1 tablet", morning: false, afternoon: false, night: true, food: "after", purpose: "Lowers cholesterol", duration: "6 months" },
      { name: "Uprise-D3 60K", generic: "Cholecalciferol (Vitamin D3)", dose: "1 sachet in milk, every Sunday", morning: true, afternoon: false, night: false, food: "after", purpose: "Vitamin D for bones", duration: "8 weeks" },
    ],
    labs: [], image: "/demo/03-rx.png",
    advice: ["Avoid sweets, sugary tea and white rice in large amounts.", "Walk 30 minutes every day.", "Check sugar at home twice a week.", "Come back in 6 months with HbA1c and liver test."],
    questions: ["Can I take Metformin if I miss a meal?", "Should I check my BP at home too?", "Any side effects I should watch for?"],
    followUps: [{ title: "Review with Dr. Anita Rao — bring HbA1c and liver test", date: "2026-10-20" }],
  },
  {
    id: "demo-mri", kind: "mri", title: "Right knee MRI", date: "2026-06-05", doctor: "Dr. R. Kulkarni (Radiologist)", facility: "Apex MRI & Diagnostics",
    summary: "Age-related wear in the right knee: a small tear in the inner cushion (meniscus) and early cartilage thinning, with a little fluid.",
    findings: [
      { title: "Small tear in knee cushion", explanation: "The meniscus is a rubbery cushion in the knee. Yours has a small wear-and-tear split on the inner side. Very common after 60 and usually treated with exercises, not surgery.", severity: "attention", region: "knee", side: "right", quote: "Horizontal degenerative tear in the body of the medial meniscus" },
      { title: "Early cartilage wear", explanation: "The smooth lining behind the kneecap is slightly thinned (early arthritis).", severity: "watch", region: "knee", side: "right", quote: "Grade II chondromalacia patellae" },
    ],
    medicines: [], labs: [], advice: [], image: "/demo/05-knee-mri.jpg",
    questions: ["Will physiotherapy help, or do I need surgery?", "Which exercises are safe for my knee?", "Is it okay to keep walking 30 minutes a day?"],
  },
  {
    id: "demo-usg", kind: "ultrasound", title: "Abdomen ultrasound", date: "2026-08-12", doctor: "Dr. P. Shah (Radiologist)", facility: "City Imaging Centre",
    summary: "Mild fat in the liver (grade 1 fatty liver). Kidneys, gallbladder and other organs look normal.",
    findings: [
      { title: "Mild fatty liver", explanation: "There is a little extra fat stored in the liver. This is common with diabetes and usually improves with diet, walking and good sugar control.", severity: "watch", region: "liver", side: "none", quote: "Liver normal in size with mildly increased echotexture — Grade I fatty liver" },
      { title: "Kidneys look healthy", explanation: "Both kidneys are normal in size with no stones.", severity: "normal", region: "kidneys", side: "both", quote: "Both kidneys normal in size and echotexture. No calculi." },
    ],
    medicines: [], labs: [], advice: [], image: "/demo/06-usg.jpg",
    questions: ["How can I reduce the fat in my liver?", "Do I need another ultrasound later?", "Is my diabetes medicine safe for my liver?"],
  },
];

const LAKSHMI: MedRecord[] = [
  {
    id: "demo-l-blood", kind: "blood", title: "Thyroid & blood count", date: "2026-09-02", doctor: "Dr. Meera Nair", facility: "Sunrise Diagnostics, Bengaluru",
    summary: "Your thyroid is underactive and your blood count and vitamin B12 are a little low. Calcium is normal.",
    labs: [lab("TSH", 7.8, "µIU/mL", 0.4, 4.5), lab("Hemoglobin", 11.2, "g/dL", 12, 15), lab("Vitamin B12", 180, "pg/mL", 200, 900), lab("Calcium", 9.4, "mg/dL", 8.6, 10.3)],
    findings: [
      { title: "Thyroid underactive", explanation: "TSH is high at 7.8, which means your thyroid gland is working slowly. This can cause tiredness and weight gain. It is treated with a daily tablet.", severity: "attention", region: "thyroid", side: "none", quote: "TSH 7.8 µIU/mL" },
      { title: "Mild anaemia", explanation: "Hemoglobin is slightly low, so your blood carries a little less oxygen. Often linked to low iron or B12.", severity: "watch", region: "blood", side: "none", quote: "Hemoglobin 11.2 g/dL" },
      { title: "Low vitamin B12", explanation: "B12 keeps nerves and blood healthy. Yours is a little low.", severity: "watch", region: "blood", side: "none", quote: "Vitamin B12 180 pg/mL" },
      { title: "Calcium normal", explanation: "Calcium for your bones is in the healthy range.", severity: "normal", region: "bones", side: "none", quote: "Calcium 9.4 mg/dL" },
    ],
    medicines: [], advice: [],
    questions: ["How long will I need thyroid tablets?", "Should I take an iron tablet too?", "When should I recheck my TSH?"],
  },
  {
    id: "demo-l-rx", kind: "prescription", title: "Prescription — Dr. Meera Nair", date: "2026-09-05", doctor: "Dr. Meera Nair, MD", facility: "Nair Family Clinic",
    summary: "A daily thyroid tablet on an empty stomach, plus B12 and iron. Recheck thyroid in six weeks.",
    findings: [],
    medicines: [
      { name: "Tab. Thyronorm 50", generic: "Levothyroxine", dose: "50 mcg, 1 tablet", morning: true, afternoon: false, night: false, food: "before", purpose: "Thyroid hormone", duration: "Long term" },
      { name: "Tab. Orofer XT", generic: "Ferrous ascorbate + folic acid", dose: "1 tablet", morning: false, afternoon: true, night: false, food: "after", purpose: "Iron for blood", duration: "3 months" },
      { name: "Tab. Methylcobal 1500", generic: "Methylcobalamin (Vitamin B12)", dose: "1500 mcg, 1 tablet", morning: false, afternoon: false, night: true, food: "after", purpose: "Vitamin B12", duration: "3 months" },
    ],
    labs: [],
    advice: ["Take the thyroid tablet 30 minutes before breakfast with plain water.", "Do not take iron within 4 hours of the thyroid tablet.", "Recheck TSH after 6 weeks."],
    questions: ["What if I forget the thyroid tablet one morning?", "Can I take it with tea?", "Will I feel less tired soon?"],
    followUps: [{ title: "Recheck thyroid (TSH)", date: "2026-10-17" }],
  },
];

export const DEMO_APPOINTMENTS: Record<string, Appointment[]> = {
  ramesh: [{ id: "demo-appt-physio", title: "Physiotherapy — right knee", date: "2026-11-03", time: "10:30", place: "Apex Physio, Jayanagar" }],
  lakshmi: [{ id: "demo-appt-eye", title: "Eye check-up", date: "2026-11-12", time: "16:00", place: "Nair Family Clinic" }],
};

export const DEMO_RECORDS: Record<string, MedRecord[]> = { ramesh: withHi(RAMESH), lakshmi: withHi(LAKSHMI) };
