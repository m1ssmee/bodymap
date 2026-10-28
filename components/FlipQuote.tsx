"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export type Quote = { en: string[]; hi: string[] };

const TRACK = -0.03; // em, matches the display tracking
const STAGGER = 42; // ms between cells starting
const TICK = 85; // ms per intermediate flip
const LATIN = "abcdefghijklmnopqrstuvwxyz";
const DEVA = ["क", "ख", "ग", "च", "ज", "ट", "ड", "त", "द", "न", "प", "ब", "म", "य", "र", "ल", "व", "स", "ह", "का", "दि", "मे"];
const seg = new Intl.Segmenter("hi", { granularity: "grapheme" }); // keeps matras and conjuncts with their letter
const split = (s: string) => [...seg.segment(s)].map((x) => x.segment);
const filler = (target: string) => {
  const pool = /[ऀ-ॿ]/.test(target) ? DEVA : LATIN;
  const c = pool[Math.floor(Math.random() * pool.length)];
  return target === target.toUpperCase() && target !== target.toLowerCase() ? c.toUpperCase() : c;
};
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// One character cell, like a departure board: on change it ticks through two random letters of the
// target script, each tick a hinge flip, then lands on the real character with a small settle.
function Cell({ ch, width, delay }: { ch: string; width?: number; delay: number }) {
  const [glyph, setGlyph] = useState({ c: ch, n: 0, last: true });
  const target = useRef(ch);

  useEffect(() => {
    if (ch === target.current) return;
    target.current = ch;
    const word = ch.trim() !== "" && /[\p{L}\p{M}]/u.test(ch); // spaces and punctuation flip once, letters tick through
    const seq = still() || !word ? [ch] : [filler(ch), filler(ch), ch];
    const timers = seq.map((c, i) => setTimeout(() => setGlyph((g) => ({ c, n: g.n + 1, last: i === seq.length - 1 })), delay + i * TICK));
    return () => timers.forEach(clearTimeout);
  }, [ch, delay]);

  const style = { width, transitionDelay: `${delay}ms` } as React.CSSProperties;
  return (
    <span className="flip-cell" style={style}>
      <span className="flip-size">{glyph.c || "​"}</span>
      <span key={glyph.n} className={`flip-g ${glyph.n === 0 ? "" : glyph.last ? "flip-land" : "flip-tick"}`}>{glyph.c}</span>
    </span>
  );
}

// Cycles English -> Hindi -> next English ..., flipping cell by cell, left to right.
export default function FlipQuote({ quotes, hold = 4000, className = "" }: { quotes: Quote[]; hold?: number; className?: string }) {
  const texts = useMemo(() => quotes.flatMap((q) => [q.en, q.hi]).map((lines) => lines.map(split)), [quotes]);
  const cols = useMemo(() => Array.from({ length: Math.max(...texts.map((t) => t.length)) }, (_, l) => Math.max(...texts.map((t) => t[l]?.length ?? 0))), [texts]);
  const [i, setI] = useState(0);
  const [widths, setWidths] = useState<number[][][] | null>(null); // [text][line][cell] in px
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let alive = true;
    const font = () => { const cs = getComputedStyle(ref.current!); return { spec: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, size: parseFloat(cs.fontSize) }; };
    const measure = () => {
      if (!ref.current || !alive) return;
      const { spec, size } = font();
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = spec;
      setWidths(texts.map((t) => cols.map((n, l) => Array.from({ length: n }, (_, j) => {
        const ch = t[l]?.[j] ?? "";
        return ch ? ctx.measureText(ch).width + size * TRACK : 0;
      }))));
    };
    // load the Devanagari face up front, otherwise it only loads when Hindi first appears and widths would be wrong
    document.fonts.load(font().spec, texts.flat(2).join("")).then(measure, measure);
    addEventListener("resize", measure);
    const cells = cols.reduce((a, b) => a + b, 0);
    const tick = setInterval(() => setI((x) => (x + 1) % texts.length), hold + cells * STAGGER + 3 * TICK + 300);
    return () => { alive = false; removeEventListener("resize", measure); clearInterval(tick); };
  }, [texts, cols, hold]);

  let k = 0;
  return (
    <span ref={ref} className={`flip-quote ${className}`}>
      <span className="sr-only">{quotes.map((q) => q.en.join(" ")).join(" ")}</span>
      {cols.map((n, l) => (
        <span key={l} className="flip-line" aria-hidden>
          {Array.from({ length: n }, (_, j) => <Cell key={j} ch={texts[i][l]?.[j] ?? ""} width={widths?.[i][l][j]} delay={k++ * STAGGER} />)}
        </span>
      ))}
    </span>
  );
}
