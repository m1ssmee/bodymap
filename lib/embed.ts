"use client";
import type { Dense, Passage } from "./retrieve";

// Browser side of semantic search: fetches embeddings from /api/embed and keeps passage vectors in memory, keyed by
// the passage's text, so each passage is embedded once per visit and only new or changed ones are sent.
const cache = new Map<string, Float32Array>();
const MAX = 1200; // the route's per-text limit
const key = (p: Passage) => p.text.slice(0, MAX);

const decode = (b64: string) => {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
};

async function embed(texts: string[], task: "query" | "document") {
  const res = await fetch("/api/embed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texts, task }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(json.vectors) || json.vectors.length !== texts.length) throw new Error(json.error ?? "embedding failed");
  return (json.vectors as string[]).map(decode);
}

// Embeds any passages not yet cached (call ahead of time so the first question is quick). Calls run one after
// another, so a question asked while the prefetch is still running waits for it instead of embedding everything twice.
let queue: Promise<void> = Promise.resolve();
export function embedPassages(passages: Passage[]) {
  queue = queue.catch(() => {}).then(async () => {
    const todo = [...new Set(passages.map(key).filter((t) => !cache.has(t)))];
    for (let i = 0; i < todo.length; i += 200) {
      const part = todo.slice(i, i + 200);
      (await embed(part, "document")).forEach((v, j) => cache.set(part[j], v));
    }
  });
  return queue;
}

// What retrieve() needs for semantic search: the question's vector and a lookup for each passage's vector.
export async function denseFor(question: string, passages: Passage[]): Promise<Dense> {
  const [[query]] = await Promise.all([embed([question.slice(0, MAX)], "query"), embedPassages(passages)]);
  return { query, vector: (p) => cache.get(key(p)) };
}
