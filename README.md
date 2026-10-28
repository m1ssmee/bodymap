# BodyMap — your body, explained

**Live demo:** https://bodymap-qu9s.vercel.app

Upload a prescription, blood report, X-ray, MRI, CT or ultrasound. Gemini reads it, every finding is pinned to a 3D body, and everything is explained in plain language for older patients. Records stay in the browser (localStorage). No login, no database.

## Run locally
```bash
cp .env.example .env.local   # put your Gemini keys in GEMINI_KEYS
npm install
npm run dev
```

## Deploying
Vercel is connected to this GitHub repo. Every push to `main` redeploys https://bodymap-qu9s.vercel.app automatically. Pushes to other branches get their own preview link.

Set `GEMINI_KEYS` (and optionally `GEMINI_MODEL`) under the Vercel project's Settings > Environment Variables, then redeploy once.

## Gemini notes
- These keys only work on the Gemini **Interactions** API (`/v1beta/interactions`), which the route uses.
- Models tried in order: gemini-3.6-flash, gemini-3.5-flash, gemini-3-flash-preview. 3.7/3.8 Flash were overloaded on 28 Oct 2026. Override with `GEMINI_MODEL`.
- Each request rotates keys; any key that fails (quota, billing, invalid) is skipped. Lab severity is computed from the printed reference range, not guessed by the model.

## Demo packet
- `public/demo/` — images the app uses (preloaded record thumbnails + the two "Try a sample" uploads).
- `demo-docs/print/` — PDFs to print for the live demo.
- `demo-docs/make.py` — regenerates both. Patient, doctors and labs are fictional.
- Scan images are from Wikimedia Commons, CC BY-SA 4.0 (credited in the footer).

Live demo uploads: `07-blood-oct26` (lights the liver red, HbA1c trend climbs) and the handwritten prescription (`08-rx-handwritten`, or write it by hand).

- Hindi type: Anek Devanagari (Ek Type, SIL Open Font License), self-hosted in app/fonts, scaled 112% so it sits level with Geist.
