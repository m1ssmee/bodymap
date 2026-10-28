"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n";

// Reads text aloud slowly in the current language (Indian English or Hindi voice when the device has one).
export default function Speak({ text, label }: { text: string; label?: string }) {
  const t = useT();
  const [on, setOn] = useState(false);
  const toggle = () => {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    if (on) return setOn(false);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = t.voice;
    u.rate = 0.85;
    u.voice = s.getVoices().find((v) => v.lang.replace("_", "-") === t.voice) ?? null;
    u.onend = u.onerror = () => setOn(false);
    s.speak(u);
    setOn(true);
  };
  return (
    <button onClick={toggle} className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] opacity-70 hover:opacity-100">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M2 5h2.5L8 2v10L4.5 9H2z" fill="currentColor" />{on ? <path d="M10 5v4M12 4v6" stroke="currentColor" strokeWidth="1.3" /> : <path d="M10 4.5a3.5 3.5 0 0 1 0 5M11.5 3a5.5 5.5 0 0 1 0 8" fill="none" stroke="currentColor" strokeWidth="1.2" />}</svg>
      {on ? t.stop : label ?? t.listen}
    </button>
  );
}
