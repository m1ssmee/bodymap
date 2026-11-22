// Self-check for the medical rules: npm run check (Node 23+ runs the .ts files directly).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// lib/ imports siblings without ".ts", the way Next resolves them
registerHooks({
  resolve: (spec, ctx, next) => (spec.startsWith("./") && !/\.\w+$/.test(spec) ? next(spec + ".ts", ctx) : next(spec, ctx)),
});
const { reviewedCautions, unlisted } = await import("../lib/interactions.ts");
const { gradeFromRanges, upcoming } = await import("../lib/medical.ts");

const med = (name, generic = "", slots = {}) => ({ name, generic, dose: "", morning: false, afternoon: false, night: false, food: "any", purpose: "", duration: "", ...slots });
const titles = (meds) => reviewedCautions(meds).map((c) => c.title.en);

// "spironolactone" contains "iron"; "aripiprazole" contains "prazole"
assert.ok(!titles([med("Aldactone", "spironolactone"), med("Thyronorm", "levothyroxine")]).some((t) => /Aldactone \+ Thyronorm|Thyronorm \+ Aldactone/.test(t)));
assert.equal(unlisted([med("Abilify", "aripiprazole")]).length, 1, "aripiprazole must go to the AI check");
assert.ok(titles([med("Thyronorm", "levothyroxine"), med("Pan 40", "pantoprazole")]).includes("Thyronorm + Pan"));
assert.ok(titles([med("Thyronorm", "levothyroxine"), med("Orofer", "ferrous ascorbate")]).includes("Thyronorm + Orofer"));
// iron and thyroid in the same slot are flagged as taken together
const both = reviewedCautions([med("Thyronorm", "levothyroxine", { morning: true }), med("Orofer", "ferrous", { morning: true })]);
assert.equal(both.find((c) => c.title.en === "Thyronorm + Orofer").timing, "together");

// a low Vitamin D must not raise a normal Vitamin B12 finding
const lab = (name, value, low, high) => ({ name, value, unit: "", low, high, flag: "normal" });
const find = (title, quote) => ({ title, quote, explanation: "", severity: "normal", region: "blood", side: "none" });
const graded = gradeFromRanges({
  findings: [find("Vitamin B12 normal", "Vitamin B12: 450"), find("Vitamin D low", "Vitamin D: 12")],
  labs: [lab("Vitamin B12", 450, 200, 900), lab("Vitamin D", 12, 30, 100)],
});
assert.equal(graded.findings[0].severity, "normal");
assert.equal(graded.findings[1].severity, "attention");
assert.equal(gradeFromRanges({ findings: [find("SGPT raised", "SGPT 52")], labs: [lab("SGPT (ALT)", 52, 0, 40)] }).findings[0].severity, "watch");

// "Done" on a routine test with no past result must still hide it tomorrow
const due = (today, done = []) => upcoming([], [], ["Type 2 diabetes"], done, today).filter((i) => i.kind === "routine" && i.lab === "HbA1c");
const key = due("2026-11-22")[0].key;
assert.equal(due("2026-11-23", [key]).length, 0);

// ---- Ask: NLP retrieval (lib/retrieve.ts) ----
const { S } = await import("../lib/i18n.ts");
const { DEMO_PATIENTS, DEMO_RECORDS } = await import("../lib/demo.ts");
const { tokenize, stem, queryTerms, buildPassages, retrieve } = await import("../lib/retrieve.ts");

assert.deepEqual(tokenize("What's my blood pressure?"), ["blood", "pressure"]); // stop words and the "s" of what's go
assert.deepEqual(tokenize("ज़्यादा फेफड़े"), tokenize("ज्यादा फेफडे")); // nukta dropped
assert.deepEqual(["kidneys", "tablets", "glasses", "status", "remedies"].map(stem), ["kidney", "tablet", "glass", "status", "remedy"]);
const sugar = queryTerms("शुगर");
assert.ok(sugar.some((q) => q.term === "hba1c" && q.weight < 1 && q.from === "शुगर"), "Hindi word expands to the record's words");

const p = DEMO_PATIENTS[0], t = S.en;
const passages = buildPassages(DEMO_RECORDS[p.id], { patient: p, conditions: p.conditions, upcoming: [], t });
const top = (q) => retrieve(q, passages).hits[0].passage.text;
assert.match(top("Is my liver okay?"), /SGPT|liver/i);
assert.match(top("मेरी शुगर सुधर रही है क्या?"), /HbA1c|Glucose|Sugar/i); // Hindi question, English records
assert.match(top("kidney ok?"), /kidney|creatinine/i);
// no shared word: fall back to the overview, patient and medicines first even with many records
const many = buildPassages([...DEMO_RECORDS[p.id], ...DEMO_RECORDS[p.id], ...DEMO_RECORDS[p.id]], { patient: p, conditions: p.conditions, upcoming: [], t });
const general = retrieve("how am I doing?", many).hits.map((h) => h.passage.id);
assert.deepEqual(general.slice(0, 2).sort(), ["current-medicines", "patient"]);

console.log("All checks passed.");
