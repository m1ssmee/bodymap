// Server-only Gemini calls shared by the /api routes: askGemini (extract, translate, interactions, ask) and embedTexts (embed).
// Generation goes through the Interactions API; newest models are often overloaded, so fall back across fast ones.
const MODELS = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : ["gemini-3-flash-preview", "gemini-3.5-flash", "gemini-3.6-flash"]; // fastest first: on 22 Nov 2026 3.6 hung and 3.5 took 14-28 s
const KEYS = (process.env.GEMINI_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
let cursor = 0; // ponytail: per-instance round robin, fine for a demo; shared counter (KV) if keys burn unevenly

export type GeminiResult = { ok: true; data: Record<string, unknown> } | { ok: false; status: number; error: string };

export async function askGemini(input: unknown[], schema: object, budgetMs = 52_000, attemptMs = 30_000): Promise<GeminiResult> {
  if (!KEYS.length) return { ok: false, status: 500, error: "Server has no GEMINI_KEYS configured." };
  const deadline = Date.now() + budgetMs;
  const start = cursor++;
  let lastError = "";
  for (let i = 0; i < Math.max(MODELS.length, KEYS.length) * 2 && Date.now() < deadline - 3_000; i++) {
    const model = MODELS[i % MODELS.length], key = KEYS[(start + i) % KEYS.length];
    let res: Response;
    try {
      res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          model, input,
          response_format: { type: "text", mime_type: "application/json", schema },
          generation_config: { temperature: 0.2, thinking_level: "low" },
        }),
        signal: AbortSignal.timeout(Math.min(attemptMs, deadline - Date.now())), // a hung model must leave time for the next one
      });
    } catch { lastError = `${model} timed out`; continue; }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      lastError = `${model} ${res.status}`;
      if (res.status === 400 && !/api.?key/i.test(json?.error?.message ?? "")) return { ok: false, status: 400, error: json?.error?.message ?? "Could not read this file." };
      continue; // 401/403 bad key, 404 model, 429 quota, 5xx overloaded: try next key + model
    }
    const text: string = (json?.steps ?? []).filter((s: { type: string }) => s.type === "model_output")
      .flatMap((s: { content?: { text?: string }[] }) => s.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
    try { return { ok: true, data: JSON.parse(text) }; } catch { lastError = `${model} returned unreadable output`; }
  }
  return { ok: false, status: 503, error: `The reading service is busy (${lastError}). Please try again in a minute.` };
}

// ---- sentence embeddings for Ask's semantic search ----
// One fixed model: vectors from different models live in different spaces and can't be compared, so there is no
// model fallback here, only key rotation. 768 of the model's 3072 dimensions (it is trained so the first ones carry
// most of the meaning) keeps the vectors small; they are scaled to length 1 so cosine similarity is a dot product.
export const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIM = 768;
export type EmbedTask = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";
export type EmbedResult = { ok: true; vectors: number[][] } | { ok: false; status: number; error: string };

export async function embedTexts(texts: string[], task: EmbedTask, budgetMs = 20_000): Promise<EmbedResult> {
  if (!KEYS.length) return { ok: false, status: 500, error: "Server has no GEMINI_KEYS configured." };
  const deadline = Date.now() + budgetMs;
  const vectors: number[][] = [];
  for (let at = 0; at < texts.length; at += 100) { // the batch endpoint takes up to 100 texts
    const requests = texts.slice(at, at + 100).map((text) => ({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] }, taskType: task, outputDimensionality: EMBED_DIM }));
    let got: number[][] | null = null, lastError = "";
    for (let i = 0, start = cursor++; i < KEYS.length && !got && Date.now() < deadline - 1_000; i++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`, {
          method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": KEYS[(start + i) % KEYS.length] },
          body: JSON.stringify({ requests }), signal: AbortSignal.timeout(Math.min(10_000, deadline - Date.now())),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) { lastError = `${res.status}`; continue; } // 401/403 bad or unbilled key, 429 quota, 5xx: next key
        const list: { values?: number[] }[] = json?.embeddings ?? [];
        if (list.length === requests.length && list.every((e) => e.values?.length === EMBED_DIM)) got = list.map((e) => unit(e.values!));
        else lastError = "incomplete";
      } catch { lastError = "timed out"; }
    }
    if (!got) return { ok: false, status: 503, error: `Semantic search is busy (${lastError}).` };
    vectors.push(...got);
  }
  return { ok: true, vectors };
}

const unit = (v: number[]) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
