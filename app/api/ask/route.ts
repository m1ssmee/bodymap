import { askGemini } from "@/lib/gemini";

export const maxDuration = 30;

// Generation step of "Ask" (RAG): the browser has already picked the relevant passages with BM25 (lib/retrieve.ts);
// the model may answer only from them and must say which ones it used.
const SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    citations: { type: "array", items: { type: "string" }, description: "ids of the passages the answer uses" },
  },
  required: ["answer", "citations"],
};

const PROMPT = (lang: "en" | "hi") => `You answer an older patient's question about their own medical records, for someone with no medical training.
Today is ${new Date().toISOString().slice(0, 10)}. A passage dated before today is in the past: call an earlier "upcoming" date overdue, never next.
Use ONLY the numbered passages below. They are facts from the patient's records. Do not use outside knowledge about the patient.
If the passages do not answer the question, say so kindly in one sentence and suggest asking their doctor. Return no citations then.
Never tell the patient to start, stop, skip or change a medicine or a dose. Never diagnose something the records do not say.
Write at most 4 short sentences, each under 18 words, in warm, plain words. Say numbers with their units. Explain any medical word you use.
${lang === "hi" ? "Reply in simple everyday Hindi (Devanagari). Keep medicine names, test names (HbA1c, SGPT), numbers and units in Latin script." : "Reply in simple English."}
citations = the ids of the passages you used, most important first.

Passages:
`;

type P = { id: string; text: string; date: string };
const ok = (s: unknown, max: number): s is string => typeof s === "string" && s.length <= max;

export async function POST(req: Request) {
  let body: { question?: unknown; lang?: unknown; passages?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const { question, lang, passages } = body ?? {};
  if (!ok(question, 300) || !question.trim() || (lang !== "en" && lang !== "hi") || !Array.isArray(passages) || passages.length > 12
    || !passages.every((p: P) => ok(p?.id, 120) && ok(p?.text, 1200) && ok(p?.date, 10)))
    return Response.json({ error: "Bad request." }, { status: 400 });
  const ps = passages as P[];
  if (ps.reduce((n, p) => n + p.text.length, 0) > 12_000) return Response.json({ error: "Too much to read." }, { status: 413 });

  const context = ps.map((p) => `[${p.id}]${p.date ? ` (${p.date})` : ""} ${p.text}`).join("\n");
  const res = await askGemini([{ type: "text", text: `${PROMPT(lang)}${context || "(none)"}\n\nQuestion: ${question.trim()}` }], SCHEMA, 25_000, 14_000);
  if (!res.ok) return Response.json({ error: res.error }, { status: res.status });
  const answer = typeof res.data.answer === "string" ? res.data.answer : "";
  if (!answer) return Response.json({ error: "No answer came back. Please try again." }, { status: 502 });
  const sent = new Set(ps.map((p) => p.id));
  const citations = Array.isArray(res.data.citations) ? [...new Set(res.data.citations.filter((c): c is string => typeof c === "string" && sent.has(c)))] : [];
  return Response.json({ answer, citations });
}
