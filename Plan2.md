# Plan2 — round two of changes

## 1. The body figure — REVISED for the light page — built 28 Oct 2026

Reference: the anatomical wireframe man (triangulated skin, bright outline, faint inside, organs and arteries in red).
Adapted to the site's light flowing background, where it has to read as ink on paper, not light on black.

### What's wrong with the current figure
- Shape is a maths blob: thick arms, no hands, neck or muscle line.
- Surface is a uniform dot cloud, not a triangulated mesh.
- Organs are random clusters, not organ shapes; no arteries.

### Source mesh (checked)
- MakeHuman base mesh, CC0 (confirmed in MakeHuman's LICENSE: base mesh, rigs and weights are CC0).
  Body only: 13,380 vertices, 13,378 quads. Unisex, slim, standing.
- It stands in an A-pose: arms out at about 45°, hands at hip-to-chest height, arm span ~60% of height.
  The reference has arms hanging close to the body, so the arms are lowered ~35° using MakeHuman's own skeleton
  (163 bones) and skin weights, the clean way (no stretched armpits).
- If the torso reads too soft next to the reference, widen shoulders/chest slightly through the same rig.

### One-time build step (`scripts/build-body.mjs`, output committed, nothing downloaded at runtime)
1. Read base.obj + skeleton + weights, keep the body, pose the arms down.
2. Simplify to ~5,000 triangles (three.js SimplifyModifier) for the wireframe edges.
3. Sample ~6,000 points on the full-detail surface (three.js MeshSurfaceSampler) with their normals.
4. Write `public/body.bin` (~200 KB, quantised, gzipped by the server). The page loads it with the 3D code.

### How it is drawn on the light page (no bloom — bloom brightens to white and would wash out on pastel)
1. **Wireframe**: the ~5k-triangle edges as thin ink-blue lines (#1f3a93). Alpha from the viewing angle: the outline
   ~0.85, surfaces facing you ~0.06. This is what gives "bright edge, faint inside".
2. **Surface points**: the 6k sampled points, 1.5–2.5 px, same rule, plus ~80 larger accent points for sparkle.
3. **Organs as shapes**: lungs (two lobes), heart (tilted left), liver, stomach, pancreas, kidneys (beans, at the back),
   intestines (coiled band), bladder, thyroid (butterfly), brain, eyes, spine (column of dots); joints as rings
   (shoulder, hip, knee); leg bones as dotted lines. Built from small shapes placed inside the mesh, sampled into
   points + short joining lines.
   - Flagged organs: red #d4483b (talk to doctor) / amber #d18a14 (keep an eye), each with a soft halo behind it.
   - Normal findings: teal-green #2f9e6e, quieter.
   - Organs with no finding: not drawn (keeps the figure calm).
4. **Arteries**: aorta from the heart, splitting into both legs; arteries down both arms; carotids up the neck.
   Thin rose lines (#c9506a) at ~25% opacity, always present like the reference, never louder than a flag.
5. **Ambient**: ~200 drifting indigo dust points at low opacity, no connecting lines (they read as scribbles on a
   light page). A soft white radial glow behind the figure separates it from the flowing background.

### Scene and motion
- The figure fills ~85% of the stage height, centred, camera at chest height. No ground ring.
- Idle: slow ±12° sway instead of spinning, so organs stay readable. Drag turns it left/right; on release it eases
  back to the front over ~2 s. No zoom; the wheel and vertical swipes keep scrolling the page (as now).
- Entrance: points fade in, then the lines (~0.6 s).

### Interaction
- Each organ shape is its own tap target (replaces the pulsing dots). Hover brightens it; tap selects it, fades the
  other organs to 30%, and opens that organ in the side panel (as now).
- Selected organ: a thin leader line to a small caption, e.g. "LIVER · 2 findings", positioned in plain HTML over the
  canvas (no 3D text library).

### Cost and risks
- ~3 hours: build script + posing ~1 h, drawing ~45 min, organ shapes + arteries ~1 h, interaction ~15 min.
- Posing risk: if the skin weights give a pinched shoulder, fall back to the A-pose (standard in anatomy charts).
- Phone: ~5k lines + 6k points without post-processing is light; the narrower arms-down pose also fits phones better.

### Not in this round
- Sex/age-specific bodies, animation, real organ meshes, tapping individual arteries.

### Status — built 28 Oct 2026
- `scripts/build-body.mjs` poses the MakeHuman mesh with its own rig: forearms straightened, arms hanging 80° below
  horizontal, legs brought in 4.5°. Run `node scripts/build-body.mjs` to rebuild; `--preview` writes a 2D check.
- Output is `public/body.json` (469 KB, 135 KB gzipped) instead of a quantised body.bin: simpler, the server gzips it.
- Skin: 7,455 wireframe edges from a ~5,160-triangle simplification, 6,000 surface points, 80 accents.
- Face cleanup: no outlines around the eyes, mouth cavity removed, lower face never outlines (no ring when it turns).
- Organs, joints, bones and arteries as planned. Normal findings draw at 60%, flagged ones get the halo; arteries 22%.
- Taps hit one invisible sphere per organ, smallest first (heart beats lungs). The skin ignores the pointer, so a tap
  on empty space clears the selection. The figure holds the front while an organ is selected.
- Caption sits on the organ's outer side; on narrow phones it takes the roomier side and shortens its leader line.
  Checked at 375 px and 1440 px, English and Hindi. tsc, lint and production build pass.

## 2. Landing page — APPROVED (reference: white page, one bold line, EXPLORE bottom-left, SWIPE UP bottom-centre)

### What changes
- `/` becomes a single full-screen landing page. Nothing else on it: no records, no needs-attention, no stats.
- Today's home content (greeting, status, needs attention, records) moves to `/overview`, labelled "Overview" in
  the nav. Nothing is deleted.
- Background: the current flowing shader, untouched.

### Layout (desktop)
```
┌──────────────────────────────────────────────────────────────────┐
│                                                     [R ⌄]        │  patient switcher only
│                                                                  │
│  Hope you do                                                     │
│  good in life.                                       BodyMap     │  quote left, wordmark right,
│                                                 YOUR RECORDS,    │  bottom edges aligned
│                                                     EXPLAINED    │
│                                                                  │
│ [EXPLORE]                    SWIPE UP ↑                          │
└──────────────────────────────────────────────────────────────────┘
```
- Quote: left, Geist SemiBold, very large (≈ 7vw, capped), tight tracking, near-black. Explicit line breaks so the
  layout never reflows mid-animation. Hindi set in Noto Sans Devanagari SemiBold (Geist has no Devanagari).
- Wordmark: "BodyMap" on the right at about half the quote size, same weight, with a two-line mono caption under it.
- EXPLORE: bottom-left, black rectangle, square corners, bold uppercase, exactly like the reference. Goes to `/overview`.
- SWIPE UP: bottom-centre, small mono caps, a thin arrow that bobs slowly.
- No nav bar, no footer, no phone tab bar on this page. The patient switcher stays top-right, small (you asked for it
  on the home page earlier).

### Layout (phone)
- Quote on top, wordmark under it right-aligned, EXPLORE bottom-left, SWIPE UP bottom-centre. Quote ≈ 12vw.

### The flip animation (calendar / split-flap, per character)
- Each character sits in its own cell. Switching language flips cells left to right, ~40 ms apart, like a
  train-station board: the top half of the old character folds down over a hinge while the bottom half of the new
  one swings into place (CSS 3D transforms, no library).
- Hindi is split by grapheme cluster with the browser's built-in `Intl.Segmenter`, so vowel signs and conjuncts stay
  attached to their letter (क + ि flips as कि, never as two pieces).
- Each cell eases its width from the old glyph to the new one during the flip, so English and Hindi of different
  lengths both sit naturally. Extra cells flip to blank.
- Cells touch (no gaps), so when a Hindi word settles its top line (shirorekha) reads unbroken.
- Rhythm: English holds 4 s → flips to Hindi → holds 4 s → flips to the next quote's English. Loops forever.
- Reduced-motion users get a plain crossfade instead of flips.

### Quotes (English / Hindi, line breaks fixed)
1. Hope you do / good in life.  —  आशा है, ज़िंदगी में / आप अच्छा करें।
2. Small steps, / every day.  —  हर दिन, / छोटे क़दम।
(Chosen: quotes 1 and 3 from the draft.)
(Edit them in one array in the landing page file. I can have the Hindi checked for tone if you prefer different wording.)

### Getting to the app
- EXPLORE, a swipe up on touch, a scroll down with a mouse wheel or trackpad, or the ↓ / Space keys all go to
  `/overview`.
- Transition: the landing slides up and Overview rises in (the browser's View Transitions API; browsers without it
  just navigate).
- The BodyMap wordmark in the nav on every other page links back to the landing page.

### Cost
- ~1.5 hours. The flip component is the only real work; the rest is layout and moving the current home to `/overview`.

### Status — 28 Oct 2026
Built: `/` landing (FlipQuote split-flap EN/HI, BodyMap wordmark, EXPLORE, SWIPE UP; scroll / swipe / ↓ / Space enter
the app), old home moved to `/overview` with the vertical slide both ways, nav label "Overview", wordmark links back
to `/`. Noto Sans Devanagari added for Hindi. Verified: tsc, lint, production build, clean console, desktop + phone
(longest Hindi line 251 px of 321 px available at 375 px wide).
Round 2 fixes: wordmark is now "//BodyMap" (landing + header), vertically centred against the quote. Swipe follows the
gesture (page lifts and dims with the wheel/finger, springs back if released early, slides out past the threshold) and
Overview rises in; React ViewTransition removed. Flip rebuilt: each letter ticks through two random letters of the
target script with hinge rotations, no fades.

## 3. Plain-language health numbers + Hindi/English (revised after feedback)

### The problem, from what the app shows today
- Names are lab jargon: "HbA1c", "SGPT (ALT)", "Fasting Glucose", "Triglycerides".
- Direction is numeric, not meaningful. "Vitamin D: up from 18 to 24" sounds bad but is good news.
- Everything is English only.

### A. Small descriptors, written by the reader — no dictionary
- When a report is read, every test also gets three short fields:
  - **plain**: a plain name, 2–4 words — "Average blood sugar"
  - **about**: one line on what it means — "Your sugar level over the last 3 months."
  - **tip**: one safe recommendation — "A 30-minute walk after meals helps bring this down."
- Rules for tips: everyday habits only (food, walking, sleep, water, sunlight, taking medicines as prescribed);
  never start, stop or change a medicine; anything serious ends with "ask your doctor".
- The demo patients get these written by hand.

### B. Better/worse, computed — not guessed
- Distance outside the healthy range is measured for each reading (0 when inside).
- Closer to healthy than last time = **Getting better**, further = **Getting worse**, same = **Steady**.
- Level: inside = **Healthy**, up to 1.5× past the limit = **A little high / low**, beyond = **High / Low**.
- Vitamin D 18 → 24 reads "A little low · Getting better".

### C. Trends page rebuilt
- **What's changed** at the top: up to three plain sentences, worst first, ends with good news when there is some.
- **What you can do**: the tips from the tests that are getting worse, max three.
- Sections by body part (Sugar · Liver · Kidneys · Heart · Blood · Thyroid · Bones & vitamins).
- Each card: plain name big, lab name small, level + better/worse words, zone bar labelled in words with a "You"
  marker, the one-line descriptor, the tip, the number in small print, a Listen button.

### D. Same plain language in the record view
- Lab rows in the body page panel and the upload check screen show plain name, descriptor and level word.

### E. Hindi / English toggle, whole site
- A small **EN | हिं** switch top-right on every page (next to the patient menu, landing included). Remembered on
  the device; sets the page language so screen readers and read-aloud switch voice.
- **Interface text** (nav, headings, buttons, labels, status words, landing caption, empty states): one strings
  file, both languages, written by me.
- **Record content** (summaries, findings, descriptors, tips, advice, questions, medicine purposes):
  - demo patients: Hindi written by hand, instant.
  - new uploads: the reader stays English-only so uploads stay fast (the handwritten prescription already takes
    ~35 s of a 52 s limit). Right after you save, a quick translation call runs in the background (~4 s) and stores
    the Hindi with the record. If you switch to Hindi before it finishes, that record shows English with a small
    "translating…" note, then updates.
- Medicine and test names stay in their original form (Glycomet, HbA1c) in both languages, as doctors write them.
- Read-aloud uses an Indian English or Hindi voice to match.

### F. Accessibility basics
- Body text ≥ 18 px, status words as text not only colour, contrast ≥ 4.5:1, tap targets ≥ 44 px, keyboard
  reachable, screen-reader labels on zone bars ("Average blood sugar: a little high, getting worse").

### Cost
- ~4 hours: interface strings + toggle ~1 h, Hindi for demo records ~1 h, reader + background translation ~45 min,
  trends rebuild ~1 h, record view ~15 min.

### Status — section 3 built (28 Oct 2026)
- EN | हिं toggle on every page (landing included), remembered per device; sets <html lang> and the read-aloud voice.
- All interface text in lib/i18n.ts (both languages). Demo records carry hand-written Hindi + plain words.
- Reader adds plain / about / tip / region per test (capped at 12 / 18 words). Blood report now ~21–24 s (was ~15 s).
- New /api/translate fills Hindi for new uploads in the background (~12–15 s); the record shows a "Hindi version on
  the way" note until it lands. Records missing Hindi are re-requested whenever Hindi is on.
- Trends rebuilt: What's changed, What you can do, body-part sections, cards with level + better/worse words.
- Changes from the plan: "a little" = up to 25% past the limit (1.5x was too lenient: HbA1c 7.8 read "a little high");
  zone bars use equal-width zones so every label fits; trend arrows removed (words only).
- Storage key moved to bodymap.v3, so data saved locally before this change was cleared.

## 4. Overview: Upcoming + Records page — built 28 Oct 2026
- Overview: Records section removed; "Upcoming" sits where Needs attention was; Needs attention moved to the bottom.
- Upcoming merges: appointments added by hand (title, date, time, place), follow-ups the reader dates from documents
  ("repeat HbA1c after 3 months" -> date), routine checks (HbA1c 3 mo, TSH 6 mo, cholesterol + kidney yearly) counted
  from the last test. A doctor's newest visit replaces their older follow-ups; a follow-up naming the same test
  within 120 days hides the routine one. Overdue / today / in N days, and a Done button on each.
- New /records page: filters (all, prescriptions, blood tests, scans), grouped by year, links to the body page.
- Nav gains Records; the phone tab bar drops Upload (Overview and Records both have an upload button).
- Storage key moved to bodymap.v4 for the demo follow-ups and appointments (local uploads cleared again).

## 5. My Body page matches the site — built 28 Oct 2026
- Dark mode removed everywhere (frame, background shader, all dark: classes). /body now uses the same flowing
  background, light panels, hairlines and chips as every other page.
- Figure redrawn for a light page: ink-blue points/lines with normal blending, darkest at the silhouette, organs in the
  site's severity colours, nodes as solid coloured dots. NOTE for section 1 (on hold): the scene is now light, not navy.
- The figure no longer traps scrolling: no wheel zoom, vertical swipes scroll the page, it turns left/right only.

## 6. Medicines: "Do your medicines mix well?" — built 28 Oct 2026

### What it shows
- A new section on the Medicines page, under today's plan and above Doctor's advice.
- One card per caution, most serious first:
  - the names involved, e.g. "Thyronorm + Orofer XT" or "Glycomet + alcohol"
  - a level word in the site's colours: Ask your doctor (red), Be careful (amber), Good to know (green)
  - what happens, in one short sentence, and what to do, in one short sentence
  - a read-aloud button, like the medicine slots
- Three kinds of caution: medicine with medicine, medicine with food or drink (tea, milk, alcohol, low-sodium salt),
  and medicine with common shop medicines (painkillers like Combiflam or Voveran, antacids, calcium).
- Timing: when two medicines that must be kept apart sit in the same slot, the card says so. When the plan already
  keeps them apart, it says "your timing already keeps these apart".
- Nothing found: "No known problems between your medicines."
- Footer on every list: "Tell your doctor about every medicine you take, including shop and ayurvedic medicines.
  Never stop a medicine on your own."
- Full Hindi, like the rest of the site.

### Where the cautions come from
- A reviewed list in `lib/interactions.ts`, matched by generic name: about 20 well-known cautions for medicines
  common in older Indians (diabetes, BP, cholesterol, thyroid, blood thinners, painkillers, acidity, iron, calcium,
  vitamins), written in English and Hindi. Instant, works offline, same answer every time.
- Medicines not on the list (from new uploads): one Gemini call returns cautions in English and Hindi. It is told to
  list only well-established ones and never to advise stopping or changing a dose. These cards carry a
  "Checked by AI · confirm with your pharmacist" tag. The result is saved in the browser, so it runs once per
  medicine list. While it runs (~10 s), one small "Checking your medicines…" line shows. No loading screen.
- No outside drug database: the free NIH interaction API was shut down in 2024, and DrugBank needs a licence.

### What the demo patients will show
- Ramesh: painkillers for his knee (ibuprofen, diclofenac) with Telma can raise BP and strain the kidneys, so ask
  before taking any painkiller. Alcohol with Glycomet can drop sugar and adds to his liver strain. Glycomet over years
  lowers vitamin B12, so ask for a yearly B12 test. Low-sodium salt with Telma can raise potassium.
- Lakshmi: iron in Orofer XT blocks Thyronorm, so keep them 4 hours apart (her plan already does). Tea, coffee or
  milk too close to Thyronorm weakens it. Tea or milk with Orofer XT lowers the iron taken in, so take it with water.

### Cost
- About 1.5 h: list and matching ~45 min, section and Hindi ~30 min, AI for unlisted medicines ~20 min.

### Not in this round
- Medicines typed in by hand, dose checks, allergy checks.

### Status — built 28 Oct 2026
- 20 reviewed cautions in `lib/interactions.ts`. Ramesh shows 4 (painkillers, alcohol, B12, low-sodium salt) and
  Lakshmi 3 (iron spacing with "your timing already keeps these apart", tea with each tablet). No AI call for either.
- AI check in `/api/interactions`: one request per new medicine list, saved in the browser. Answers took 11–50 s
  because Gemini was slow, so the route gets 60 s and drops a hung model after 16 s to try the next one. When every
  model is busy, the card says "Couldn't check … ask your pharmacist" and it retries on the next visit.
- AI answers can differ between runs (tested with Ciplox: iron, dairy, thyroid and caffeine came up). Each list is
  checked once and then stays the same.
