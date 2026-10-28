"use client";
import Link from "next/link";
import FlipQuote, { type Quote } from "@/components/FlipQuote";
import { useSwipeNav } from "@/components/useSwipeNav";
import { useT } from "@/lib/i18n";

const QUOTES: Quote[] = [
  { en: ["Hope you do", "good in life."], hi: ["आशा है, ज़िंदगी में", "आप अच्छा करें।"] },
  { en: ["Small steps,", "every day."], hi: ["हर दिन,", "छोटे क़दम।"] },
];

export default function Landing() {
  const t = useT();
  const { ref, go } = useSwipeNav<HTMLElement>({ dir: "up", href: "/overview", flag: "rise" });

  return (
    <main ref={ref} className="drop-in relative flex h-[100svh] flex-col overflow-hidden px-6 will-change-transform sm:px-10">
      <section className="flex flex-1 items-center pt-16">
        <div className="flex w-full flex-col gap-10 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <h1 className="text-ink"><FlipQuote quotes={QUOTES} /></h1>
          <div className="self-end text-right sm:self-center">
            <div className="text-[clamp(2rem,3.4vw,3.6rem)] latin font-semibold leading-none tracking-[-0.045em]"><span className="text-muted/60">{"//"}</span>BodyMap</div>
            <div className="mt-3 font-mono text-[11px] uppercase leading-relaxed tracking-[0.16em] text-muted">{t.landing.caption[0]}<br />{t.landing.caption[1]}</div>
          </div>
        </div>
      </section>
      <footer className="relative flex h-24 items-center">
        <Link href="/overview" onClick={(e) => { e.preventDefault(); go(); }}
          className="bg-ink px-5 py-3.5 text-[0.8rem] font-bold uppercase tracking-[0.02em] text-white transition hover:bg-black">{t.landing.explore}</Link>
        <button onClick={go} className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em]">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="animate-[bob_1.8s_ease-in-out_infinite]"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
          {t.landing.swipe}
        </button>
      </footer>
    </main>
  );
}
