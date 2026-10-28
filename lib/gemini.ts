// Server-only Gemini call shared by /api/extract and /api/translate.
// These keys only work on the Interactions API; newest models are often overloaded, so fall back across fast ones.
const MODELS = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash-preview"];
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
