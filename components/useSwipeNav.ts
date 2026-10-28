"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

type Options = {
  dir: "up" | "down"; // "up": scroll down / drag up moves the page up (landing). "down": the reverse, only at the top (Overview).
  href: string;
  flag: "rise" | "drop"; // set on <html> so the next page plays its entrance
  threshold?: number; // px of wheel travel to commit
};

const FRESH = 200; // ms of wheel silence that marks a new gesture; trackpad momentum is one unbroken stream

// The page follows the gesture, springs back if released early, and slides out + navigates past the threshold.
export function useSwipeNav<T extends HTMLElement>({ dir, href, flag, threshold = 220 }: Options) {
  const router = useRouter();
  const ref = useRef<T>(null);
  const gone = useRef(false);
  const sign = dir === "up" ? -1 : 1;

  const paint = useCallback((p: number, spring = false) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = spring ? "transform .55s cubic-bezier(.2,.9,.25,1), opacity .55s" : "none";
    el.style.transform = p ? `translate3d(0, ${sign * p * 140}px, 0)` : "";
    el.style.opacity = p ? String(1 - p * 0.4) : "";
  }, [sign]);

  const go = useCallback(() => {
    const el = ref.current;
    if (gone.current || !el) return;
    gone.current = true;
    el.style.transition = "transform .6s cubic-bezier(.65,0,.35,1), opacity .45s ease-in";
    el.style.transform = `translate3d(0, ${sign * 100}svh, 0)`;
    el.style.opacity = "0";
    document.documentElement.dataset[flag] = "1";
    setTimeout(() => router.push(href), 380);
  }, [sign, flag, href, router]);

  useEffect(() => {
    router.prefetch(href);
    let acc = 0, p = 0, y0 = 0, dragging = false, lastWheel = 0, armed = dir === "up";
    let idle: ReturnType<typeof setTimeout> | undefined;
    const settle = () => { acc = 0; p = 0; if (!gone.current) paint(0, true); };

    const onScroll = () => { if (scrollY > 0 && p) settle(); };
    const onWheel = (e: WheelEvent) => {
      if (gone.current) return;
      const now = performance.now(), fresh = now - lastWheel > FRESH;
      lastWheel = now;
      if (dir === "down") { // only a new gesture that starts at the very top pulls back; scrolling up to the top never does
        if (scrollY > 0) { armed = false; acc = 0; return; }
        if (fresh) armed = true;
        if (!armed) return;
      }
      acc = Math.max(0, acc + (dir === "up" ? e.deltaY : -e.deltaY));
      p = Math.min(1, acc / threshold);
      if (p >= 1) return go();
      paint(p);
      clearTimeout(idle);
      idle = setTimeout(settle, 180);
    };
    const onStart = (e: TouchEvent) => { y0 = e.touches[0].clientY; dragging = dir === "up" || scrollY <= 0; };
    const onMove = (e: TouchEvent) => {
      if (gone.current || !dragging) return;
      const d = dir === "up" ? y0 - e.touches[0].clientY : e.touches[0].clientY - y0;
      p = Math.max(0, Math.min(1, d / (innerHeight * 0.5)));
      paint(p);
    };
    const onEnd = () => { if (gone.current || !dragging) return; dragging = false; if (p > 0.35) go(); else settle(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, select, textarea, button, a, [popover]")) return;
      const keys = dir === "up" ? ["ArrowDown", "PageDown", " "] : ["ArrowUp", "PageUp"];
      if (keys.includes(e.key) && (dir === "up" || scrollY <= 0)) { e.preventDefault(); go(); }
    };
    // the arriving page's entrance plays once; clear the flag so later visits don't replay it
    const other = flag === "rise" ? "drop" : "rise";
    const clear = setTimeout(() => delete document.documentElement.dataset[other], 900);

    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("wheel", onWheel, { passive: true });
    addEventListener("touchstart", onStart, { passive: true });
    addEventListener("touchmove", onMove, { passive: true });
    addEventListener("touchend", onEnd, { passive: true });
    addEventListener("keydown", onKey);
    return () => {
      clearTimeout(idle); clearTimeout(clear);
      removeEventListener("scroll", onScroll); removeEventListener("wheel", onWheel);
      removeEventListener("touchstart", onStart); removeEventListener("touchmove", onMove);
      removeEventListener("touchend", onEnd); removeEventListener("keydown", onKey);
    };
  }, [dir, href, flag, threshold, router, go, paint]);

  return { ref, go };
}
