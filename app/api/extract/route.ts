import { askGemini } from "@/lib/gemini";
import { KINDS, REGIONS, type MedRecord } from "@/lib/medical";

export const maxDuration = 60;

const MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const str = { type: "string" };
const bool = { type: "boolean" };
const SCHEMA = {
  type: "object",
  properties: {
    isMedical: bool,
    kind: { type: "string", enum: [...KINDS] },
    title: str, date: { type: "string", description: "YYYY-MM-DD, or empty if not printed" },
    doctor: str, facility: str, summary: str,
    findings: { type: "array", items: { type: "object", properties: {
      title: str, explanation: str, quote: str,
      severity: { type: "string", enum: ["normal", "watch", "attention"] },
      region: { type: "string", enum: [...REGIONS] },
      side: { type: "string", enum: ["left", "right", "both", "none"] },
    }, required: ["title", "explanation", "severity", "region", "side", "quote"] } },
    medicines: { type: "array", items: { type: "object", properties: {
      name: str, generic: str, dose: str, purpose: str, duration: str,
      morning: bool, afternoon: bool, night: bool,
      food: { type: "string", enum: ["before", "after", "any"] },
    }, required: ["name", "generic", "dose", "morning", "afternoon", "night", "food", "purpose", "duration"] } },
    labs: { type: "array", items: { type: "object", properties: {
      name: str, unit: str, value: { type: "number" },
      low: { type: ["number", "null"] }, high: { type: ["number", "null"] },
      flag: { type: "string", enum: ["low", "normal", "high"] },
      plain: str, about: str, tip: str,
      region: { type: "string", enum: [...REGIONS] },
    }, required: ["name", "value", "unit", "low", "high", "flag", "plain", "about", "tip", "region"] } },
    advice: { type: "array", items: str },
    questions: { type: "array", items: str },
    followUps: { type: "array", items: { type: "object", properties: { title: str, date: { type: "string", description: "YYYY-MM-DD" } }, required: ["title", "date"] } },
  },
  required: ["isMedical", "kind", "title", "date", "doctor", "facility", "summary", "findings", "medicines", "labs", "advice", "questions", "followUps"],
};

const PROMPT = `You read Indian medical documents (prescriptions, blood reports, X-ray/MRI/CT/ultrasound reports or images) for a patient aged 60+ with no medical training.
Write every explanation in short, warm, plain English a 70-year-old understands. No jargon without explaining it. Never suggest changing or stopping a medicine.

Rules:
- isMedical=false if the document is not medical; then leave arrays empty.
- date: dates on Indian documents are written DD/MM/YYYY (05/06/2026 is 5 June 2026). Return YYYY-MM-DD.
- title: e.g. "Blood report", "Knee MRI", "Prescription — Dr. <name>".
- summary: 2-3 sentences, what this document says overall.
- findings: one per meaningful result (abnormal or reassuringly normal). region = the body part it concerns. For blood tests map: HbA1c/glucose->pancreas, SGPT/SGOT/bilirubin->liver, creatinine/urea/eGFR->kidneys, cholesterol/triglycerides->heart, TSH/T3/T4->thyroid, vitamin D/calcium->bones, hemoglobin/WBC/platelets/B12->blood. side = which side for paired organs/joints (patient's own left/right), else "none". quote = exact text from the document that supports it. severity: normal (in range), watch (slightly outside the range), attention (clearly abnormal: e.g. a lab value more than 1.5x its upper limit, HbA1c 7.5% or above, or a scan finding that needs treatment).
- If the input is a raw scan image with no written report, describe only what is clearly visible, prefix each finding title with "Preliminary:", and never give a diagnosis.
- medicines: only real drugs. Diet/lifestyle instructions go in advice, never in medicines. Decode Indian dosing like 1-0-1 (morning-afternoon-night), BD, OD, HS, SOS, AC (before food), PC (after food). generic = active ingredient. purpose = what it is usually for, in 5 words. Do not repeat a medicine.
- labs: every numeric test result from a lab report (leave empty for prescriptions). Use these canonical names when they match: HbA1c, Fasting Glucose, Post-meal Glucose, Hemoglobin, WBC, Platelets, Creatinine, Urea, eGFR, Uric Acid, SGPT (ALT), SGOT (AST), Bilirubin, Total Cholesterol, LDL Cholesterol, HDL Cholesterol, Triglycerides, TSH, Vitamin D, Vitamin B12, Calcium, Sodium, Potassium. Otherwise use the printed name. low/high = the reference range printed on the report (null if absent).
- For every lab also write, for an older reader with no medical background:
  plain = an everyday name of 2-4 words (e.g. HbA1c -> "Average blood sugar", SGPT -> "Liver stress signal", Creatinine -> "Kidney cleaning test", LDL -> "Bad cholesterol", TSH -> "Thyroid signal", Vitamin D -> "Sunshine vitamin").
  about = one sentence of at most 12 words on what it shows, with an everyday comparison where it helps (e.g. "Your sugar level over the last 3 months, like a report card.").
  tip = at most 18 words: one practical everyday habit that helps with THIS result (food, walking, sleep, water, sunlight, taking prescribed medicines regularly). Never suggest starting, stopping or changing a medicine and never give doses. If the value is far outside the range, end with "Ask your doctor about this." If it is healthy, say how to keep it there.
  region = the body part it concerns, using the same mapping as findings.
- questions: 3 short questions the patient should ask their doctor at the next visit, based on this document.
- advice: doctor's instructions written on the document, rewritten plainly.
- followUps: every follow-up visit or repeat test the document asks for ("Review after 6 months", "Repeat HbA1c + LFT after 3 months", "Recheck TSH in 6 weeks"). title = a short plain instruction; date = the document's date plus that interval, as YYYY-MM-DD. Empty if the document asks for none.`;

export async function POST(req: Request) {
  const { mimeType, data } = (await req.json().catch(() => ({}))) as { mimeType?: string; data?: string };
  if (!mimeType || !MIMES.includes(mimeType) || typeof data !== "string")
    return Response.json({ error: "Upload a JPG, PNG, WEBP or PDF." }, { status: 400 });
  if (data.length > 5_500_000) return Response.json({ error: "File is too large. Try a smaller photo or PDF." }, { status: 413 });

  const input = [
    { type: mimeType === "application/pdf" ? "document" : "image", data, mime_type: mimeType },
    { type: "text", text: PROMPT },
  ];
  const res = await askGemini(input, SCHEMA);
  if (!res.ok) return Response.json({ error: res.error }, { status: res.status });
  const r = res.data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- model output, validated below
  if (!r.isMedical) return Response.json({ error: "This does not look like a medical document." }, { status: 422 });
  const record: Omit<MedRecord, "id"> = {
    kind: KINDS.includes(r.kind) ? r.kind : "other", title: r.title || "Medical record",
    date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : new Date().toISOString().slice(0, 10),
    doctor: r.doctor ?? "", facility: r.facility ?? "", summary: r.summary ?? "",
    findings: (r.findings ?? []).filter((f: { region: string }) => (REGIONS as readonly string[]).includes(f.region)),
    medicines: r.medicines ?? [],
    // values a doctor jots on a prescription have no reference range; only lab reports feed trends
    labs: r.kind === "prescription" ? [] : (r.labs ?? []).filter((l: { value: unknown }) => typeof l.value === "number"),
    advice: r.advice ?? [], questions: r.questions ?? [],
    followUps: (r.followUps ?? []).filter((f: { title?: string; date?: string }) => f.title && /^\d{4}-\d{2}-\d{2}$/.test(f.date ?? "")),
  };
  return Response.json(gradeFromRanges(record));
}

// Lab severity comes from the printed reference range, not the model's judgement: a finding that cites a lab
// more than 1.5x past its limit is "attention", any out-of-range lab is at least "watch". Only ever raises severity.
function gradeFromRanges(r: Omit<MedRecord, "id">) {
  const rank = { normal: 0, watch: 1, attention: 2 } as const;
  for (const f of r.findings) {
    const text = `${f.title} ${f.quote}`.toLowerCase();
    for (const l of r.labs) {
      if (!text.includes(l.name.split(/[ (]/)[0].toLowerCase())) continue;
      const ratio = l.high !== null && l.value > l.high ? l.value / l.high : l.low !== null && l.value < l.low ? l.low / l.value : 1;
      const s = ratio > 1.5 ? "attention" : ratio > 1 ? "watch" : "normal";
      if (rank[s] > rank[f.severity]) f.severity = s;
    }
  }
  return r;
}
