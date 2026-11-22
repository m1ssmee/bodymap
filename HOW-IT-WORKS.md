# How BodyMap works

A plain-language guide to the code: what each part does and how the parts fit together.
For setup and deployment, see [README.md](README.md).

---

## 1. What BodyMap is

BodyMap helps older patients in India understand their medical papers.

You photograph a prescription, a blood report or a scan report. The app reads it and:
- explains every result in short, simple English or Hindi,
- lights up the matching organ on a 3D body (green = fine, amber = keep an eye, red = talk to your doctor),
- tracks lab results over time ("is my sugar getting better?"),
- lists your medicines by time of day and warns when two of them don't mix,
- answers questions about your records, typed or spoken (this is the NLP part, see section 5).

There is no login and no database. Everything is saved in your own browser.

---

## 2. The big picture

```
 Photo / PDF of a report
          │
          ▼
 ┌─────────────────────┐      ┌──────────────────────┐
 │  Upload page        │ ───▶ │  /api/extract        │ ──▶ Gemini reads the document
 │  (shrinks the photo)│      │  (checks the answer) │     and returns structured data
 └─────────────────────┘      └──────────────────────┘
          │
          ▼
 Saved in the browser (localStorage)  ──▶  /api/translate makes a Hindi copy in the background
          │
          ├──▶ My Body     3D body with organs coloured by how serious the findings are
          ├──▶ Records     every document, newest first
          ├──▶ Trends      each lab test over time, in words ("A little high", "Better")
          ├──▶ Medicines   what to take when, and which medicines don't mix
          ├──▶ Overview    summary, upcoming check-ups, and a link to Ask
          └──▶ Ask         questions answered from your records (NLP + Gemini)
```

---

## 3. What it's built with

| Part | Tool | Why |
|---|---|---|
| Website | **Next.js 16** (React 19, TypeScript) | Pages and small server functions in one project |
| Styling | **Tailwind CSS 4** | Styles written right next to the HTML |
| 3D body | **three.js** with React Three Fiber | Draws the body as glowing points and lines |
| Reading documents | **Google Gemini** (Flash models) | Reads photos and PDFs, writes plain explanations |
| Search for Ask | **Our own code** (`lib/retrieve.ts`) | Tokenising, stemming, query expansion and BM25, no library |
| Hosting | **Vercel** | Every push to `main` goes live automatically |
| Android app | **Capacitor 8** | Wraps the live website and adds phone features |

---

## 4. Folder map

```
app/                 the pages (one folder = one URL) and the server routes
  page.tsx           landing page (animated quote)
  overview/          home screen after landing
  body/              the 3D body
  records/           list of all documents
  trends/            lab results over time
  medicines/         medicine plan + "do your medicines mix well?"
  upload/            add a new document
  ask/               ask a question about your records (NLP)
  api/extract/       server: send a document to Gemini, check what comes back
  api/translate/     server: translate a record into Hindi
  api/interactions/  server: ask Gemini about medicines our own list doesn't know
  api/ask/           server: write the answer for Ask from the passages it was given

components/          building blocks used by the pages
  Body.tsx           the 3D body drawing
  Frame.tsx          page frame: menu, language switch, family member switch
  RecordView.tsx     one document explained: findings, labs, medicines, advice
  MedMix.tsx         the medicine-interaction card
  Charts.tsx         "zone bars" that show a lab value in words
  Upcoming.tsx       upcoming appointments and check-ups
  Speak.tsx          "Listen" button (reads text aloud)
  AppNative.tsx      Android-only features: reminders, back button

lib/                 the logic, with no screens
  retrieve.ts        ★ the NLP pipeline for Ask
  medical.ts         data types and medical rules (current medicines, trends, check-up dates)
  interactions.ts    reviewed list of medicine interactions
  gemini.ts          one shared function that calls Gemini, with retries
  store.ts           saving and loading everything in the browser
  i18n.ts            every sentence on screen, in English and Hindi
  demo.ts            two fictional demo patients with their records
  reminders.ts       medicine and check-up notifications (Android app)

scripts/check.mjs    automatic checks (npm run check)
mobile/              the Android app
public/              3D body data and demo images
demo-docs/           printable fake reports for the live demo
```

---

## 5. The NLP part: "Ask about your records"

**What the user sees:** a chat page. You type or say *"Is my sugar getting better?"*. The app answers in 2 to 4 simple sentences and shows which records the answer came from.

**How it works:** this is **RAG** (retrieval-augmented generation). First our own NLP code finds the few facts in your records that matter for the question (**retrieval**). Then Gemini writes the answer **using only those facts** (**generation**). The AI can't invent things about you, because it only sees what retrieval handed it.

All of the retrieval runs in the browser, in [`lib/retrieve.ts`](lib/retrieve.ts).

### Step 1: Turn records into passages
Each record is cut into small passages, **one fact each**:
- `Finding (pancreas, Keep an eye): Sugar slightly high. Your 3-month average sugar (HbA1c) is 6.6%…`
- `Test result: Creatinine (Kidney cleaning test, kidneys) = 0.9 mg/dL, Healthy…`
- `Medicine: Tab. Telma 40 (Telmisartan), 40 mg, morning…`

The code also builds summary passages: a lab's **trend over time**, today's **medicine list**, **upcoming check-ups**, and the **patient** (age, conditions). The first demo patient ends up with 53 passages.

Small passages make the search precise. A whole report would match almost any question.

### Step 2: Clean up the words (preprocessing)
The question and every passage go through the same steps:

| Step | What it does | Example |
|---|---|---|
| Normalise | Same letters, same code; lowercase | `HbA1c` → `hba1c` |
| Tokenise | Split into words, keeping Hindi vowel signs | `"What's my sugar?"` → `what`, `s`, `my`, `sugar` |
| Remove the nukta | Hindi letters with and without the dot count as one | `ज़्यादा` = `ज्यादा` |
| Stop words | Drop filler words in English and Hindi | `what`, `my`, `is`, `है`, `क्या` are dropped |
| Stemming | Cut English word endings so forms match | `kidneys` → `kidney`, `tablets` → `tablet` |

The stemmer is deliberately simple (a few Porter-style rules). It sometimes cuts oddly, like `pancreas` → `pancrea`, but the question and the records get exactly the same cut, so they still match.

### Step 3: Query expansion (everyday words → medical words)
Patients say "sugar"; reports say "HbA1c" and "glucose". A small synonym map in English and Hindi bridges the gap:

- `sugar / शुगर / डायबिटीज` → `hba1c, glucose, metformin, glimepiride, pancreas, diabetes`
- `bp / बीपी / pressure` → `hypertension, telmisartan, amlodipine`
- `kidney / गुर्दा / किडनी` → `creatinine, urea, egfr`
- …17 groups in total (liver, thyroid, cholesterol, bones, check-up dates, trends…)

Words you typed count fully (weight **1**). Added words count a bit less (weight **0.6**), so a direct match still wins.

### Step 4: Rank the passages with BM25
**BM25** is the classic scoring formula behind search engines. For each passage it adds up, for every search word:
- **how rare the word is** across all passages (a rare word like `hba1c` means more than a common one like `test`),
- **how often it appears** in this passage, with diminishing returns (saying it 5 times isn't 5× better),
- **a length correction**, so long passages don't win just by having more words.

The settings are the textbook ones: `k1 = 1.5`, `b = 0.75`. The top **8** passages are kept. If no word matches at all (*"how am I doing?"*), it uses the patient summary, the current medicines and the latest records instead.

### Step 5: Gemini writes the answer
[`app/api/ask/route.ts`](app/api/ask/route.ts) sends the question and the 8 passages to Gemini with strict rules:
- answer **only** from these passages; if they don't answer it, say so kindly,
- never tell the patient to start, stop or change a medicine; never diagnose,
- at most 4 short sentences, in English or Hindi to match the screen,
- return the **ids** of the passages it used, which appear as "From: Blood report · 20 Apr" links.

The server also checks the request: question at most 300 characters, at most 12 passages, total size limited.

### A real example
Question: **"मेरी शुगर सुधर रही है क्या?"** ("Is my sugar getting better?")

```
tokens after cleanup :  शुगर  सुधर                      (मेरी, रही, है, क्या are stop words)
after expansion      :  शुगर  hba1c  glucose  sugar  metformin  glimepiride  pancrea  diabete
                        सुधर  trend
top passages (BM25)  :  Finding: Sugar slightly high. HbA1c is 6.6%…           score 5.85
                        Finding: Sugar going up. HbA1c rose from 6.6% to 7.1%  score 5.63
                        Trend over time for Fasting Glucose: 112 → 128 mg/dL   score 4.98
```
A Hindi question finds English records, because expansion added the English medical words.

### Voice input
The microphone button uses the browser's built-in **speech recogniser** (Indian English `en-IN` or Hindi `hi-IN`, matching the screen language). The spoken words fill the box and the question is asked automatically. This works in Chrome, Edge and Safari. The Android app's built-in browser doesn't support it, so the button is hidden there.

### "How this answer was found"
Every answer has a fold-out panel showing the searched words (added words marked with the word they came from) and every passage with its BM25 score. It makes the pipeline visible and easy to demo.

---

## 6. The other features

### Reading a document (`app/upload`, `app/api/extract`)
1. The browser shrinks photos (Vercel accepts at most 4.5 MB per request) and sends the photo or PDF to `/api/extract`.
2. The server sends it to Gemini with a long set of rules: Indian date format (DD/MM/YYYY), decoding Indian dosing like `1-0-1` (morning–afternoon–night) and `BD`/`OD`/`HS`, which organ each test belongs to, plain words for a 70-year-old.
3. Gemini must answer in a fixed **JSON schema** (a template listing every field and its type), so the result is always data, never free text.
4. The server checks the answer: fixes a bad date, drops findings with an unknown organ, keeps lab values only from lab reports.
5. **Severity isn't left to the AI.** If a lab value is more than 1.5× past its printed normal limit, the finding becomes red; if it's outside the range at all, at least amber.
6. You check the result, then save. A Hindi translation is fetched in the background.

### Calling Gemini (`lib/gemini.ts`)
One shared function used by all four server routes. It rotates between several API keys and three Gemini models. If one is busy, out of quota or slow, it tries the next, within a time limit.

### The 3D body (`components/Body.tsx`)
The body is drawn from `public/body.json`, made once from an open-source human model (MakeHuman, CC0). Each organ is a cloud of points and lines. Organs with findings glow in their severity colour, and tapping one shows its findings.

### Trends (`app/trends`)
Each lab test over time. Values are described in **words** ("Healthy", "A little high", "High") and the trend as "Better / Worse / Steady". "Better" means *closer to the healthy range*, not just "went down".

### Medicines (`app/medicines`, `lib/interactions.ts`)
- **Current medicines:** a doctor's newest prescription replaces their older one; lists from different doctors are combined.
- **"Do your medicines mix well?"** First a **reviewed list** of well-known interactions common in older Indian patients (for example, BP tablets + painkillers, thyroid tablet + iron). Medicines are matched by brand or generic name with patterns. Medicines the list doesn't know are checked once by Gemini, and the result is saved.
- Everything is worded so it **never tells anyone to stop a medicine**, only to space doses, avoid a food, or ask the doctor.

### Upcoming (`components/Upcoming.tsx`, `lib/medical.ts`)
Combines appointments you add, follow-ups the doctor wrote ("review after 6 months"), and routine tests for long-term conditions (HbA1c every 3 months for diabetes, TSH every 6 months for thyroid…).

### Two languages (`lib/i18n.ts`)
Every sentence on screen exists in English and Hindi. A record's own text is translated once by `/api/translate` and stored with it. Names, medicine brands, test names and numbers stay as printed.

### Family
One phone can hold several family members. Each has their own records, medicines and reminders.

### Android app (`mobile/`)
A small app that opens the live website and adds phone features: medicine reminders at 8 AM, 2 PM and 8 PM, Google's document scanner, sharing to WhatsApp, reading aloud with the phone's voice, and an offline screen.

---

## 7. Where the data lives (privacy)

- Records, medicines and appointments are saved **only in your browser** (`localStorage`, in `lib/store.ts`). There is no account and no database.
- A document passes through our server only while Gemini reads it. It isn't stored.
- For Ask, only the 8 passages picked for that question are sent, not the whole record history.
- API keys stay on the server (Vercel environment variables), never in the browser.

---

## 8. Safety rules built into the code

- The app **explains**; it does not diagnose. Every page footer says so.
- No feature ever says to start, stop, skip or change a medicine.
- Lab severity comes from the **printed reference range**, not the AI's opinion.
- Scan images without a written report are marked "Preliminary" and never given a diagnosis.
- Ask answers **only** from the user's records and shows its sources.

---

## 9. Checking that it works

```bash
npm run check   # automatic checks (scripts/check.mjs)
npm run lint
npm run build
```

`npm run check` tests the parts where a mistake would show wrong medical information:
- medicines go into the right interaction groups (spironolactone isn't "iron"; aripiprazole isn't an acidity tablet),
- lab grading (a low Vitamin D doesn't turn a normal B12 red),
- check-ups marked "Done" stay done,
- the NLP pipeline: stop words, Hindi spelling variants, stemming, Hindi → English expansion, BM25 picking the right passage, and the fallback for general questions.

---

## 10. Settings you can change, and what would happen

Most behaviour is controlled by a few numbers in the code. Each entry says where the setting is, its current value, and what happens if you raise or lower it. After any change, run `npm run check`.

### NLP search for Ask (`lib/retrieve.ts`)

We tested the first three on demo patient Ramesh (53 passages) to show the real effect.

| Setting | Now | If you change it |
|---|---|---|
| **Expansion weight** (`weight: 0.6` in `queryTerms`) | 0.6 | **Set to 0 (no expansion):** the Hindi question "मेरी शुगर सुधर रही है क्या?" matches **0 passages** (the records are in English), and "Is my sugar getting better?" ranks a *Vitamin D* trend first, because only the word "better" matched. **0.6:** 24 passages match; the HbA1c findings come first. **1.0:** same top results here, but an added word now counts as much as a typed one, so a question about one thing can be pulled toward related things. |
| **Stop-word list** (`STOP`) | about 120 English and Hindi words | **Remove it:** words like *is, my, है, क्या* become search terms. They appear in many passages, so they add noise to every score. **Add words:** be careful: adding a medical word (like "test") means nobody can search for it. |
| **Synonym map** (`SYNONYMS`) | 17 groups | **Add a group** (say `["eye आँख vision", "eyes"]`) and questions using those words start finding eye records. **Remove one** and questions with only those everyday words find nothing. This is the easiest way to make Ask smarter. |
| **`K1`** (BM25 word-repeat setting) | 1.5 | **Lower (towards 0):** a word counts the same whether it appears once or five times. **Higher (2–3):** passages that repeat a word win more. 1.2–2.0 is the usual range. |
| **`B`** (BM25 length correction) | 0.75 | **0:** long passages are not penalised, so they win simply by having more words. **1:** full penalty, so short passages win more easily. 0.75 is the textbook value. |
| **`k`** (passages sent to Gemini, in `retrieve`) | 8 | **Lower (3–4):** cheaper and more focused, but answers can miss facts ("what is each medicine for?" may skip some medicines). **Higher:** more complete, but slower and costlier. Above **12**, the server rejects the request (see below). |
| **Stemming rules** (`stem`) | 5 suffix rules | **Remove:** "kidneys" no longer matches "kidney", so plural or "-ing" questions miss records. **Add more rules:** more matches, but also more wrong merges (words with different meanings cut to the same root). |

### Ask answers (`app/api/ask/route.ts`)
| Setting | Now | If you change it |
|---|---|---|
| Question length | 300 characters | Longer questions are rejected with "Bad request". Raising it is safe but lets people send more text to Gemini. |
| Passages per request | 12 max, 1,200 characters each, 12,000 total | Limits how much text one request can send to Gemini, which caps cost and stops abuse. Raise it only if you also raise `k`. |
| Time limit | 25 s total, 14 s per try | **Lower:** errors come sooner when Gemini is slow. **Higher:** fewer errors, but users wait longer. It must stay under `maxDuration` (30 s), or Vercel cuts the request off. |
| Answer rules (in `PROMPT`) | at most 4 sentences, under 18 words each | Change the text to make answers longer, shorter or more formal. The "never change a medicine" rule should stay. |

### Calling Gemini (`lib/gemini.ts`)
| Setting | Now | If you change it |
|---|---|---|
| `MODELS` | 3.6 Flash → 3.5 Flash → 3 Flash preview | The order models are tried in. Newer models may read better but are more often overloaded. You can also set the `GEMINI_MODEL` environment variable to force one model. |
| `temperature` | 0.2 | How "creative" Gemini is. **Higher (0.7+):** more varied wording, and more risk of made-up details. **0:** the same answer every time. Keep it low for medical text. |
| `thinking_level` | low | **Higher:** the model reasons more first, which is slower but can read hard documents better. |
| `budgetMs` / `attemptMs` | 52 s / 30 s (defaults) | Total time for all retries, and the time one try may take before moving on to the next key or model. |

### Reading documents (`app/api/extract/route.ts`, `app/upload/page.tsx`)
| Setting | Now | If you change it |
|---|---|---|
| Red threshold (`ratio > 1.5` in `gradeFromRanges`) | 1.5× the limit | **Lower (1.2):** more results turn red; patients may worry more. **Higher (2):** only extreme values turn red. Anything outside the range is still at least amber. |
| Photo size (`toJpeg(file, 1800, 0.85)`) | 1800 px, 85% quality | **Smaller:** faster upload, but small print on reports may become unreadable for Gemini. **Larger:** sharper, but can go over Vercel's 4.5 MB request limit. |
| Thumbnail (`toJpeg(file, 360, 0.7)`) | 360 px | The picture saved with each record. Bigger thumbnails fill browser storage faster (about 5 MB in total). |
| PDF limit | 3.3 MB | Must stay under about 3.3 MB, because base64 encoding makes files a third bigger and Vercel accepts at most 4.5 MB. **Do not raise it.** |

### Medical rules (`lib/medical.ts`)
| Setting | Now | If you change it |
|---|---|---|
| "A little" high/low (`d <= 0.25` in `level`) | up to 25% past the limit | **Higher (0.5):** more values are called "a little high" instead of "high". The zone bars in `Charts.tsx` use the same rule. |
| "Steady" trend (`< 0.02` in `trend`) | under a 2% change | **Higher:** small changes are called "steady" instead of "better" or "worse". |
| Routine tests (`ROUTINE`) | HbA1c every 3 months, TSH 6, LDL 12, Creatinine 12 | Change the months to change when Upcoming suggests the next test. Add a line to add a new routine test for a condition. |

### Medicines (`lib/interactions.ts`, `app/api/interactions/route.ts`)
| Setting | Now | If you change it |
|---|---|---|
| Medicine groups (`CLASSES`) | name patterns per group | Add a brand name to a group (like a new painkiller brand) and every rule for that group applies to it. **Careful:** a pattern that is too short matches inside other names (we fixed "iron" matching "spironolactone"). Add a check to `scripts/check.mjs` for every new pattern. |
| Rules (`RULES`) | 20 reviewed rules | Each rule names the groups involved, how serious it is, and what to say. Adding one makes the warning appear for everyone with those medicines. |
| AI cautions | at most 4 | **More:** fuller list, but more minor warnings that may alarm patients. |

### Reminders, sound and storage
| Setting | Where | Now | If you change it |
|---|---|---|---|
| Medicine times | `SLOTS` in `lib/reminders.ts` | 8 AM, 2 PM, 8 PM | Changes when the Android reminders go off. Keep them in step with the times shown on the Medicines page. |
| Check-up reminder | `lib/reminders.ts` | 9 AM on the day, next 10 items | Change the hour, or how many future check-ups get a notification. |
| Reading speed | `rate` in `components/Speak.tsx` | 0.85 | **Lower:** slower and clearer for older listeners. **1:** normal speed. |
| Storage key | `KEY` in `lib/store.ts` | `bodymap.v4` | **Changing it starts every user from scratch:** their saved records are no longer found, and they see the demo family again. Only change it on purpose. |

---

## 11. Every file, one line each

### Pages (`app/`): one folder = one web address
| File | What it does |
|---|---|
| `app/layout.tsx` | The shell around every page: fonts (Geist + Anek Devanagari for Hindi), page title, and a tiny script that switches on "app mode" before the first paint |
| `app/globals.css` | Colours, fonts, animations, Hindi typography, and the larger "app mode" sizes for phones |
| `app/page.tsx` | Landing page: an animated quote that flips between English and Hindi |
| `app/overview/page.tsx` | Home screen: greeting, last report, flagged organs, daily medicines, Ask card, upcoming check-ups |
| `app/body/page.tsx` | The 3D body; tap a glowing organ to see its findings |
| `app/records/page.tsx` | All documents, newest first, filterable (prescriptions, blood tests, scans) |
| `app/trends/page.tsx` | Each lab test over time, grouped by organ (sugar, liver, kidneys…) |
| `app/medicines/page.tsx` | Medicines by morning, afternoon and night; the interaction card; reminder switch (app only) |
| `app/upload/page.tsx` | Take a photo, pick a file or try a sample; shows the result to check before saving |
| `app/ask/page.tsx` | The Ask chat: question box, microphone, answers with sources, "How this answer was found" panel |
| `app/favicon.ico` | Browser tab icon |

### Server routes (`app/api/`): run on Vercel, hold the API keys
| File | What it does |
|---|---|
| `app/api/extract/route.ts` | Reads a document with Gemini, checks the result, grades lab severity from printed ranges |
| `app/api/translate/route.ts` | Translates a record's text into Hindi, keeping names, numbers and units |
| `app/api/interactions/route.ts` | Asks Gemini about interactions for medicines our reviewed list doesn't know |
| `app/api/ask/route.ts` | Writes the Ask answer from the passages it was given, with citations |

### Components (`components/`): reusable screen pieces
| File | What it does |
|---|---|
| `Frame.tsx` | Menu (top on computers, tab bar on phones), language switch, family member switch, footer |
| `Body.tsx` | Draws the 3D body with three.js: points, lines, glowing organs, tap to select |
| `RecordView.tsx` | One document explained: summary, findings, lab zone bars, medicines, advice, questions, Share button |
| `Charts.tsx` | Zone bars ("Low · Healthy · High" with "You" marked) and the words for levels and trends |
| `MedMix.tsx` | "Do your medicines mix well?": reviewed cautions first, then the AI check for unknown medicines |
| `Upcoming.tsx` | Upcoming appointments, follow-ups and routine tests; add an appointment or mark one done |
| `Speak.tsx` | "Listen" button: reads text aloud (browser voice on the web, phone voice in the app) |
| `AppNative.tsx` | Android-only: reminders, back button, opening the right page when a notification is tapped |
| `Bits.tsx` | Small shared pieces: severity dot, severity label, document thumbnail, arrow icon |
| `FlipQuote.tsx` | The departure-board style flipping quote on the landing page |
| `Flow.tsx` | The soft moving background on the landing page (a small WebGL shader) |
| `useSwipeNav.ts` | Swipe or scroll gesture that slides to the next page (landing → overview) |

### Logic (`lib/`): no screens, just rules and data
| File | What it does |
|---|---|
| `retrieve.ts` | **NLP pipeline**: passages, tokenising, stop words, stemming, query expansion, BM25 (section 5) |
| `medical.ts` | Data types, current medicines, lab series, organ summaries, levels and trends, lab grading, upcoming check-ups |
| `interactions.ts` | Medicine groups (by name patterns) and the reviewed interaction rules, in English and Hindi; saves AI checks |
| `gemini.ts` | The one function that calls Gemini, with key and model rotation and time limits |
| `store.ts` | Saves and loads patients, records, appointments and "done" items in the browser |
| `i18n.ts` | Every on-screen sentence in English and Hindi, plus date formatting and the language switch |
| `demo.ts` | Two fictional patients (Ramesh, Lakshmi) with records, so the app works on first visit |
| `reminders.ts` | Plans and schedules medicine and check-up notifications in the Android app |
| `native.ts` | Reaches the Android app's phone features; on the website it simply finds nothing |
| `appMode.ts` | Detects whether we're inside the Android app (or `?app=1`) to switch on the phone look |

### Scripts, demo material and assets
| File | What it does |
|---|---|
| `scripts/check.mjs` | Automatic checks, run with `npm run check` (section 9) |
| `scripts/build-body.mjs` | One-time tool that built `public/body.json` from the open-source MakeHuman model |
| `public/body.json` | The 3D body's points, lines and organ shapes |
| `public/demo/` | Demo record images and the two "Try a sample" documents |
| `demo-docs/make.py` | Generates the fictional demo reports as HTML, images and printable PDFs |
| `demo-docs/html/`, `demo-docs/print/` | The generated demo reports (web pages and PDFs to print) |
| `app/fonts/anek-devanagari.woff2` | The Hindi font, stored with the app so it loads fast |

### Android app (`mobile/`)
| File | What it does |
|---|---|
| `capacitor.config.ts` | App id and name, the website it opens, offline page, notification icon colour |
| `package.json` | The app's own dependencies (Capacitor and its plugins: notifications, scanner, share, speech) |
| `set-server-url.mjs` | After each sync, writes the website address into the offline page |
| `www/offline.html` | "No internet" screen in English and Hindi with a Try again button |
| `www/index.html` | Empty placeholder that Capacitor requires |
| `android/…/MainActivity.java` | The Android entry point: the "BodyMap" loading screen shown until the site loads |
| `android/…/AndroidManifest.xml` | Android settings: internet permission, the main screen, file sharing (plugins add their own permissions) |
| `android/…/res/` | App icons, splash screens, colours, the reminder icon |
| `android/*.gradle` | Android build settings (made by Capacitor) |
| `assets/` | Source images for the app icon and splash screen |

### Settings files (project root)
| File | What it does |
|---|---|
| `package.json` | The website's dependencies and commands (`dev`, `build`, `lint`, `check`) |
| `next.config.ts` | Next.js settings; lets phones on the same Wi-Fi load the dev server |
| `tsconfig.json` | TypeScript settings; `@/` means the project root in imports |
| `eslint.config.mjs` | Code style checks; skips the Android folder |
| `.env.example` | Template for the Gemini keys (`GEMINI_KEYS`); the real keys go in `.env.local`, never in git |
| `.gitignore`, `.vercelignore` | Files git and Vercel should skip (keys, build output, demo sources) |
| `AGENTS.md` | Notes for AI coding assistants, written by Next.js itself |
| `README.md` | How to run, deploy and build the project |

---

## 12. Words used in this guide

| Word | Meaning |
|---|---|
| **NLP** | Natural Language Processing: getting computers to work with human language |
| **Token** | One word after splitting a sentence |
| **Stop words** | Very common words that carry little meaning (*is, my, है, क्या*) |
| **Stemming** | Cutting words to a common root so *kidneys* matches *kidney* |
| **Query expansion** | Adding related words to a search (*sugar* → *HbA1c, glucose*) |
| **BM25** | A standard formula for ranking text by how well it matches a search |
| **RAG** | Retrieval-augmented generation: find relevant facts first, then let an AI answer only from them |
| **Passage** | One small piece of a record, about one fact |
| **LLM** | Large language model, such as Gemini |
| **JSON schema** | A template that forces the AI to answer in a fixed structure |
| **localStorage** | Storage inside the browser, on the user's own device |
