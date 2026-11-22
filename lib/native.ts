"use client";

// Inside the Android app (mobile/) the WebView injects window.Capacitor.Plugins: one object per native plugin, whose
// methods take an options object and return a promise, plus addListener(event, callback). The site doesn't bundle
// @capacitor/core, so it calls them through that global. On the website native() returns undefined.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- every plugin has its own options and results
type Plugin = Record<string, (options?: object) => Promise<any>> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addListener(event: string, callback: (data: any) => void): { remove(): void } | Promise<{ remove(): void }>;
};

export const native = (name: string): Plugin | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: { Plugins?: Record<string, Plugin> } }).Capacitor?.Plugins?.[name];

// Subscribes to a plugin event; returns the cleanup for useEffect.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- event payloads differ per plugin
export function listen(name: string, event: string, callback: (data: any) => void) {
  const handle = native(name)?.addListener(event, callback);
  return () => { Promise.resolve(handle).then((h) => h?.remove()); };
}

// For useSyncExternalStore reads that never change after load (a plugin present, today's date): nothing to subscribe to.
export const noop = () => () => {};
