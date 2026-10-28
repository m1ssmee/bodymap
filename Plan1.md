# Plan1 — BodyMap redesign

Direction: a clinical document on a living background. Strict black type, mono labels, hairline rules and
data-led rows, sitting on a slow, silky colour-field like vibrant.noomoagency.com. No cards-on-gradients,
no glass, no emoji, no serif quote, no splash screen.

## 1. Background (every page)
- Full-screen WebGL fragment shader behind the content: 3 colours blended with slow fractal noise,
  drifting like light through water. Palette taken from the reference: pale sky blue, lavender, a touch of
  warm pink. Low saturation so black text sits cleanly on it.
- Runs at ~30 fps, pauses when the tab is hidden, falls back to a static CSS gradient when WebGL is
  unavailable or the user prefers reduced motion.
- Content panels are white at ~85% opacity with a 1px hairline, no blur, no shadow. The gradient shows
  through at the edges and between sections; it is never behind body text.

## 2. Type and colour
- Geist Sans everywhere (already installed). Display sizes with tight tracking. Body text 18px minimum.
- Geist Mono for metadata: dates, units, record IDs, uppercase section labels (12px, letter-spaced).
- Numbers are the hero: tabular figures, large.
- Palette: near-black `#0b0b0f`, two greys, white panels. Red / amber / green only on health data
  (small dots, and the big value when out of range). No other colour on UI. Primary button is black.

## 3. Home page (no body, no canvas except the background)
- Top bar: wordmark left; nav as plain text (Home · My Body · Medicines · Trends); patient switcher top
  right as "Ramesh Iyer, 68 ⌄" with a dropdown of family members and "Add a family member".
- Headline, left-aligned: "Good morning, Ramesh." Beneath it a one-line quote in mono under a small
  TODAY label (rotates daily from a short list, editable in one file).
- Status block, right of the headline, mono: last report date · items flagged · next review.
- "Needs attention" as a table with hairline rows: organ, finding, date, severity dot. Row → body page
  with that organ selected.
- "Records" as a dated list with a small thumbnail. Row → body page with that record selected.
- One black button on the page: Upload a record.

## 4. My Body page (the only dark page)
- Full black page. Figure on the left, findings on the right in white mono, record timeline below.
- Figure in the style of the reference image: a real human mesh (Ready Player Me default avatar; the
  mannequin is the fallback through the same effect) rendered as sparse blue wireframe + thousands of
  glow points on the skin, brighter at the rim. Organ findings are glowing node clusters: red = talk to
  doctor, amber = keep an eye, blue-green = normal. A few hundred drifting particles with faint
  connecting lines around the figure. Slow auto-rotate, drag to turn, tap a node.
- No "Loading body" text: the 3D chunk is preloaded from the home page.

## 5. Trends and record detail
- Each test is a row, not a card: name · latest value large · horizontal range bar (grey track = healthy
  range, black marker = you) · small sparkline (thin line, dots, no fill, no axes) · one plain sentence.
- Out-of-range rows first; their value turns the muted red.
- Record detail reuses the same rows for "what changed since last report".

## 6. Upload
- Same flow. The read step is a slim progress bar under the photo, not a full-screen state.
- Confirm step keeps the big black Save and a text Discard.

## 7. Medicines
- Three columns Morning / Afternoon / Night as hairline tables, Listen as a text button. No emoji.

## 8. Patient switcher
- Records stored per patient in localStorage. Ramesh is the demo patient. Add asks name, age, sex.
- Switching re-renders every page; nothing else changes.

## 9. Phone
- Bottom tab bar stays, restyled: text labels only, black active state.

## Build order (~2.5 h)
1. Background shader + global theme + top bar + patient switcher
2. Home page
3. Body figure (show screenshot before moving on)
4. Trends rows + record detail
5. Upload + Medicines restyle
6. Phone pass, build, screenshots
Deployment stays on hold until you say so.

## Status — 28 Oct 2026
Built: background shader, theme, header + patient switcher (2 demo patients: Ramesh, Lakshmi), home page,
constellation body on /body (figure geometry in lib/figure.ts, ~175 ms, warmed from the home page),
trends rows with range bars + sparklines, record view, medicines columns, upload with inline progress, phone tab bar.
Verified: tsc, lint, production build, clean console, desktop + phone widths. Screenshots in /screenshots.
Changed from plan: figure is procedural (no downloaded avatar); home status block shows "Records" instead of
"next review" (review dates can't be read reliably from prescriptions).
Not deployed: production still runs the previous design until `npx vercel deploy --prod --yes`.
