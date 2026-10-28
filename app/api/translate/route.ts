import { askGemini } from "@/lib/gemini";
import type { HiText } from "@/lib/medical";

export const maxDuration = 30;

const str = { type: "string" };
const list = (props: string[]) => ({ type: "array", items: { type: "object", properties: Object.fromEntries(props.map((p) => [p, str])), required: props } });
const SCHEMA = {
  type: "object",
  properties: {
    title: str, summary: str,
    findings: list(["title", "explanation"]), labs: list(["plain", "about", "tip"]), medicines: list(["dose", "purpose", "duration"]),
    advice: { type: "array", items: str }, questions: { type: "array", items: str }, followUps: list(["title"]),
  },
  required: ["title", "summary", "findings", "labs", "medicines", "advice", "questions", "followUps"],
};

const PROMPT = `Translate every string in this JSON into simple, warm, everyday Hindi (Devanagari) for an elderly reader in India.
Translate titles too ("Blood report" -> "खून की जाँच"). Keep only proper names as written, in Latin script: people, clinics and labs, medicine brands, test names (HbA1c, SGPT, TSH), numbers and units.
Return the same structure: the same arrays, in the same order, with the same number of items.

`;

const ARRAYS = ["findings", "labs", "medicines", "advice", "questions", "followUps"] as const;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 60_000) return Response.json({ error: "Too much text to translate." }, { status: 413 });
  let src: HiText;
  try { src = { followUps: [], ...JSON.parse(raw) }; } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  if (typeof src.title !== "string" || ARRAYS.some((k) => !Array.isArray(src[k]))) return Response.json({ error: "Bad request." }, { status: 400 });

  const res = await askGemini([{ type: "text", text: PROMPT + JSON.stringify(src) }], SCHEMA, 25_000);
  if (!res.ok) return Response.json({ error: res.error }, { status: res.status });
  const hi = res.data as unknown as HiText;
  if (ARRAYS.some((k) => !Array.isArray(hi[k]) || hi[k]!.length !== src[k]!.length)) return Response.json({ error: "Translation came back incomplete." }, { status: 502 });
  return Response.json(hi);
}
