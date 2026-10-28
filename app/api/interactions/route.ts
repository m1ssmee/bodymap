import { askGemini } from "@/lib/gemini";

export const maxDuration = 60;

const both = { type: "object", properties: { en: { type: "string" }, hi: { type: "string" } }, required: ["en", "hi"] };
const SCHEMA = {
  type: "object",
  properties: {
    cautions: {
      type: "array",
      items: {
        type: "object",
        properties: { level: { type: "string", enum: ["attention", "watch", "normal"] }, title: both, what: both, todo: both },
        required: ["level", "title", "what", "todo"],
      },
    },
  },
  required: ["cautions"],
};

const PROMPT = `You are a careful clinical pharmacist in India checking an older patient's current medicines.
List only well-established, clinically meaningful interactions found in standard drug references that involve at least one of these medicines: UNLISTED.
Include medicine with medicine, medicine with food or drink (tea, milk, alcohol, grapefruit), and medicine with common shop medicines (painkillers, antacids, calcium).
If you are not sure, leave it out. An empty list is a good answer. At most 4 cautions, most serious first.
Never tell the patient to stop, skip or change a dose. "todo" is always something safe: spacing doses, avoiding a food or drink, asking the doctor or pharmacist.
If two medicines must be kept apart, use the "when" times below to say whether the plan already keeps them apart.
level: "attention" = ask the doctor soon, "watch" = be careful, "normal" = good to know.
title: the medicine names joined with " + ", e.g. "Ecosprin + Combiflam" or "Amlong + grapefruit".
Plain words for an elderly reader, no jargon, each sentence under 18 words.
"hi" is simple everyday Hindi in Devanagari. Keep medicine names in Latin script, but translate foods, drinks and other words, in titles too ("Metolar + शराब").

Medicines:
`;

type Med = { name: string; generic: string; when: string; food: string };
const ok = (s: unknown) => typeof s === "string" && s.length <= 120;

export async function POST(req: Request) {
  let body: { medicines: Med[]; unlisted: string[] };
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const { medicines, unlisted } = body ?? {};
  if (!Array.isArray(medicines) || !Array.isArray(unlisted) || medicines.length > 30 || !unlisted.length || unlisted.length > 30
    || !medicines.every((m) => ok(m?.name) && ok(m?.generic) && ok(m?.when) && ok(m?.food)) || !unlisted.every(ok))
    return Response.json({ error: "Bad request." }, { status: 400 });

  const list = medicines.map((m) => `- ${m.name} (${m.generic || "generic not given"}), taken: ${m.when || "as needed"}, ${m.food} food`).join("\n");
  const res = await askGemini([{ type: "text", text: PROMPT.replace("UNLISTED", unlisted.join(", ")) + list }], SCHEMA, 52_000, 16_000); // up to three tries; answers usually take ~11 s, a hung model is dropped at 16 s
  if (!res.ok) return Response.json({ error: res.error }, { status: res.status });
  const cautions = Array.isArray(res.data.cautions) ? res.data.cautions.slice(0, 4) : [];
  return Response.json({ cautions });
}
