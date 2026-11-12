"use client";
import { useSyncExternalStore } from "react";
import { S, type Lang } from "./i18n";
import { shortName } from "./interactions";
import { currentMedicines, localize, upcoming } from "./medical";
import { native } from "./native";
import type { useAppState } from "./store";

// Medicine and check-up reminders, as local notifications in the Android app. Built from every family member's
// current medicines and Upcoming list; rescheduled only when that plan changes.
type State = ReturnType<typeof useAppState>;
type Note = { id: number; title: string; body: string; channelId: string; schedule: object; extra: { url: string; patient: string } };

const SLOTS = [["morning", 8], ["afternoon", 14], ["night", 20]] as const; // the times the Medicines page shows
const CHANNEL = "reminders";

export function planReminders(state: State, lang: Lang, today: string): Note[] {
  const t = S[lang], notes: Note[] = [];
  const many = state.patients.length > 1; // name the person when one phone looks after the family
  state.patients.forEach((p, pi) => {
    const records = (state.records[p.id] ?? []).map((r) => localize(r, lang));
    const who = many ? `${p.name.split(" ")[0]}: ` : "", extra = { patient: p.id }; // first, so a small screen still shows whose
    const meds = currentMedicines(records);
    SLOTS.forEach(([slot, hour], si) => {
      const list = meds.filter((m) => m[slot]);
      if (list.length) notes.push({
        id: 1000 + pi * 10 + si, title: who + t.remind.slot(t.meds.slots[slot]), body: list.map(shortName).join(", "),
        channelId: CHANNEL, schedule: { on: { hour, minute: 0 }, allowWhileIdle: true }, extra: { ...extra, url: "/medicines" },
      });
    });
    // one notification at 9 AM on the day each upcoming visit or test falls due (today's is already in the app)
    upcoming(records, state.appointments?.[p.id] ?? [], p.conditions, state.done?.[p.id] ?? [], today)
      .filter((i) => i.date > today).slice(0, 10)
      .forEach((i, k) => notes.push({
        id: 5000 + pi * 100 + k, title: who + t.remind.due, body: i.kind === "routine" ? t.upcoming.lab[i.lab] ?? i.lab : i.title,
        channelId: CHANNEL, schedule: { at: new Date(`${i.date}T09:00:00`), allowWhileIdle: true }, extra: { ...extra, url: "/overview" },
      }));
  });
  return notes;
}

// Exact times need Android's "Alarms & reminders" setting (off by default from Android 14). Asking for a notification to
// be exact without it makes the plugin open that settings screen, so a sync only asks when it's already allowed;
// otherwise Android may deliver reminders a few minutes late. RemindCard offers the setting once, with a sentence why.
const SENT = "bodymap.reminders.sent";
let queue = Promise.resolve();
// One sync at a time: two overlapping ones would each cancel and reschedule everything.
export const syncReminders = (notes: Note[], lang: Lang) => (queue = queue.then(() => sync(notes, lang)));

async function sync(notes: Note[], lang: Lang) {
  const ln = native("LocalNotifications");
  if (!ln) return;
  try {
    const exact = (await ln.checkExactNotificationSetting()).exact_alarm === "granted";
    const all = notes.map((n) => ({ ...n, isExactNotification: exact }));
    const sig = JSON.stringify(all);
    if (localStorage.getItem(SENT) === sig) return;
    const { notifications: pending } = await ln.getPending();
    if (pending.length) await ln.cancel({ notifications: pending.map((n: { id: number }) => ({ id: n.id })) });
    if (all.length) {
      await ln.createChannel({ id: CHANNEL, name: S[lang].remind.channel, importance: 4, visibility: 1, vibration: true }); // pops up with sound
      await ln.schedule({ notifications: all });
    }
    localStorage.setItem(SENT, sig);
  } catch {} // no permission yet, or storage blocked: the next change tries again
}

// "Remind me" switch, remembered on this device.
const ON = "bodymap.reminders";
const listeners = new Set<() => void>();
const read = () => { try { return localStorage.getItem(ON) === "1"; } catch { return false; } };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useRemindersOn = () => useSyncExternalStore(subscribe, read, () => false);
export function setRemindersOn(on: boolean) {
  try { localStorage.setItem(ON, on ? "1" : "0"); } catch {}
  listeners.forEach((l) => l());
}
