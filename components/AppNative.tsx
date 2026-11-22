"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLang, useT } from "@/lib/i18n";
import { localToday } from "@/lib/medical";
import { listen, native, noop } from "@/lib/native";
import { planReminders, setRemindersOn, syncReminders, useRemindersOn } from "@/lib/reminders";
import { setActivePatient, useAppState } from "@/lib/store";

// Android app behaviour, mounted once in Frame. On the website native() is undefined and these do nothing.
export default function AppNative() {
  const router = useRouter();
  const state = useAppState(), lang = useLang(), on = useRemindersOn();
  const [resumed, setResumed] = useState(0); // back from Android settings, or another day: plan again

  // Back goes back a page; on the first page it leaves the app like Home does (Capacitor alone does nothing there).
  useEffect(() => listen("App", "backButton", ({ canGoBack }: { canGoBack: boolean }) => {
    if (canGoBack) history.back(); else native("App")?.minimizeApp();
  }), []);

  // Tapping a reminder opens its page, for the family member it was about.
  useEffect(() => listen("LocalNotifications", "localNotificationActionPerformed", ({ notification }) => {
    const x = notification?.extra as { url?: string; patient?: string } | undefined;
    if (x?.patient) setActivePatient(x.patient);
    if (x?.url) router.push(x.url);
  }), [router]);

  useEffect(() => listen("App", "appStateChange", ({ isActive }: { isActive: boolean }) => { if (isActive) setResumed((n) => n + 1); }), []);

  useEffect(() => {
    if (native("LocalNotifications")) syncReminders(on ? planReminders(state, lang, localToday()) : [], lang);
  }, [state, lang, on, resumed]);

  return null;
}


// The reminder switch on the Medicines page, shown only in the app.
export function RemindCard() {
  const r = useT().remind;
  const available = useSyncExternalStore(noop, () => !!native("LocalNotifications"), () => false);
  const on = useRemindersOn();
  const [blocked, setBlocked] = useState(false);
  const [exact, setExact] = useState(true); // until checked, don't nag

  useEffect(() => {
    if (on) native("LocalNotifications")?.checkExactNotificationSetting().then((s) => setExact(s.exact_alarm === "granted"));
  }, [on, available]);
  if (!available) return null;

  async function turnOn() {
    const ln = native("LocalNotifications")!;
    let { display } = await ln.checkPermissions();
    if (display !== "granted") ({ display } = await ln.requestPermissions()); // Android 13+ asks once
    if (display === "granted") setRemindersOn(true); else setBlocked(true);
  }
  // Opens Android's "Alarms & reminders" screen; resolves when the user comes back.
  const allowExact = () => native("LocalNotifications")!.changeExactNotificationSetting().then((s) => setExact(s.exact_alarm === "granted"));

  const solid = "min-h-11 shrink-0 rounded-full bg-ink px-6 font-medium text-white hover:bg-black";
  const quiet = "min-h-11 shrink-0 rounded-full border border-line px-6 font-medium hover:bg-black/5";
  return (
    <section className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-xl">{blocked ? r.blocked : !on ? r.off : exact ? r.on : r.late}</p>
      <div className="flex flex-wrap gap-3">
        {on && !exact && <button onClick={allowExact} className={solid}>{r.exact}</button>}
        {on
          ? <button onClick={() => setRemindersOn(false)} className={quiet}>{r.turnOff}</button>
          : <button onClick={turnOn} className={solid}>{r.turnOn}</button>}
      </div>
    </section>
  );
}
