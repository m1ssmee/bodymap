"use client";
import { useLayoutEffect } from "react";

// App mode = running inside the BodyMap Android shell (its WebView adds "BodyMapApp" to the user agent),
// or previewing that look in a browser with ?app=1 (remembered for the tab in sessionStorage).
// The inline script in app/layout.tsx applies the same rule before paint; keep the two in sync.
export const APP_KEY = "bodymap.app";

export function isApp() {
  if (typeof navigator === "undefined") return false;
  if (navigator.userAgent.includes("BodyMapApp")) return true;
  try { return sessionStorage.getItem(APP_KEY) === "1"; } catch { return false; }
}

// Strict Mode's dev remount resets <html> attributes, dropping the script's data-app; put it back before paint.
export function useAppMode() {
  useLayoutEffect(() => { if (isApp()) document.documentElement.dataset.app = "1"; }, []);
}
