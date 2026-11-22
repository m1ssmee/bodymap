import { EMBED_DIM, EMBED_MODEL, embedTexts } from "@/lib/gemini";

export const maxDuration = 30;

// Sentence embeddings for Ask's semantic search (lib/retrieve.ts ranks with them in the browser).
// task "document" for the record passages, "query" for the question: the model encodes them slightly differently.
// Each vector comes back as base64 float32, unit length.
export async function POST(req: Request) {
  let body: { texts?: unknown; task?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const { texts, task } = body ?? {};
  if ((task !== "query" && task !== "document") || !Array.isArray(texts) || !texts.length || texts.length > 200
    || !texts.every((s) => typeof s === "string" && s.length > 0 && s.length <= 1200))
    return Response.json({ error: "Bad request." }, { status: 400 });

  const res = await embedTexts(texts as string[], task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT");
  if (!res.ok) return Response.json({ error: res.error }, { status: res.status });
  const vectors = res.vectors.map((v) => Buffer.from(new Float32Array(v).buffer).toString("base64"));
  return Response.json({ model: EMBED_MODEL, dim: EMBED_DIM, vectors });
}
