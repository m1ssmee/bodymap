"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n";

// Inside the Android app the WebView injects window.Capacitor; @capacitor-community/text-to-speech reads aloud
// natively (speak() resolves when it finishes). The site doesn't bundle @capacitor/core, so call it through the global.
type Cap = {
  Plugins?: { TextToSpeech?: Record<"speak" | "stop", (o?: object) => Promise<unknown>> };
  nativePromise?: (plugin: string, method: string, o?: object) => Promise<unknown>;
};
const nativeTts = () => {
  const c = (window as unknown as { Capacitor?: Cap }).Capacitor;
  if (!c) return null;
  return (method: "speak" | "stop", o: object = {}) => {
    const p = c.Plugins?.TextToSpeech;
    return p ? p[method](o) : c.nativePromise ? c.nativePromise("TextToSpeech", method, o) : Promise.reject(new Error("no TextToSpeech"));
  };
};

// Reads text aloud slowly in the current language (Indian English or Hindi voice when the device has one).
export default function Speak({ text, label }: { text: string; label?: string }) {
  const t = useT();
  const [on, setOn] = useState(false);
  const toggle = async () => {
    const tts = nativeTts();
    if (tts) {
      try { await tts("stop"); } catch {} // like cancel() below: one voice at a time; ends any other button's speech
      if (on) return setOn(false);
      setOn(true);
      try { await tts("speak", { text, lang: t.voice, rate: 0.85 }); } catch {} finally { setOn(false); }
      return;
    }
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
    <button onClick={toggle} className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] opacity-70 hover:opacity-100
      app:gap-2.5 app:rounded-full app:border-2 app:border-sage app:bg-white app:pl-4 app:pr-5 app:font-semibold app:text-ink app:opacity-100 app:hover:bg-sage/10">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="app:size-5 app:text-sage"><path d="M2 5h2.5L8 2v10L4.5 9H2z" fill="currentColor" />{on ? <path d="M10 5v4M12 4v6" stroke="currentColor" strokeWidth="1.3" /> : <path d="M10 4.5a3.5 3.5 0 0 1 0 5M11.5 3a5.5 5.5 0 0 1 0 8" fill="none" stroke="currentColor" strokeWidth="1.2" />}</svg>
      {on ? t.stop : label ?? t.listen}
    </button>
  );
}
