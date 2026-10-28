"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Flow from "./Flow";
import { setLang, useLang, useT } from "@/lib/i18n";
import { addPatient, setActivePatient, translateRecord, useAppState, usePatient, useRecords } from "@/lib/store";

const LINKS = [
  { href: "/overview", key: "overview" },
  { href: "/body", key: "body" },
  { href: "/records", key: "records" },
  { href: "/medicines", key: "medicines" },
  { href: "/trends", key: "trends" },
  { href: "/upload", key: "upload" },
] as const;
const TABS = LINKS.filter((l) => l.key !== "upload"); // phone tab bar: Overview and Records both have an upload button

function LangToggle() {
  const lang = useLang();
  const opt = (l: "en" | "hi", label: string, name: string) => (
    <button onClick={() => setLang(l)} aria-pressed={lang === l} aria-label={name} lang={l}
      className={`min-h-9 min-w-11 rounded-md px-2.5 text-[0.85rem] font-medium transition ${lang === l ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>{label}</button>
  );
  return <div role="group" aria-label="Language / भाषा" className="flex rounded-lg border border-line p-0.5">{opt("en", "EN", "English")}{opt("hi", "हिं", "हिंदी")}</div>;
}

function PatientSwitcher() {
  const t = useT();
  const { patients, activeId } = useAppState();
  const patient = usePatient();
  const pop = useRef<HTMLDivElement>(null);
  const close = () => pop.current?.hidePopover();

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    addPatient({ name: String(f.get("name")).trim(), age: Number(f.get("age")), sex: f.get("sex") === "F" ? "F" : "M", conditions: [] });
    e.currentTarget.reset();
    close();
  }

  return (
    <>
      <button popoverTarget="patients" className="flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-[0.95rem] font-medium hover:bg-black/5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{patient.name[0]}</span>
        <span className="hidden sm:inline">{patient.name}, {patient.age}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      <div ref={pop} id="patients" popover="auto"
        className="fixed inset-auto right-4 top-16 m-0 w-80 rounded-xl border border-line bg-white p-2 text-ink shadow-[0_20px_60px_-20px_rgba(0,0,0,.35)]">
        <div className="label px-3 pb-1 pt-2">{t.patients.title}</div>
        {patients.map((p) => (
          <button key={p.id} onClick={() => { setActivePatient(p.id); close(); }}
            className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-black/5">
            <span><span className="font-medium">{p.name}</span> <span className="text-muted">{p.age}</span></span>
            {p.id === activeId && <span className="font-mono text-xs uppercase text-muted">{t.patients.active}</span>}
          </button>
        ))}
        <form onSubmit={add} className="mt-2 space-y-2 border-t border-line px-3 pb-2 pt-3">
          <div className="label">{t.patients.add}</div>
          <input name="name" required placeholder={t.patients.name} aria-label={t.patients.name} className="field" />
          <div className="flex gap-2">
            <input name="age" required type="number" min={0} max={120} placeholder={t.patients.age} aria-label={t.patients.age} className="field w-24" />
            <select name="sex" className="field flex-1" defaultValue="F" aria-label={`${t.patients.female} / ${t.patients.male}`}><option value="F">{t.patients.female}</option><option value="M">{t.patients.male}</option></select>
          </div>
          <button className="min-h-11 w-full rounded-lg bg-ink py-2.5 font-medium text-white">{t.patients.addBtn}</button>
        </form>
      </div>
    </>
  );
}

export default function Frame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const t = useT(), lang = useLang();
  const records = useRecords();
  const active = (href: string) => path.startsWith(href);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]); // screen readers + voices follow the toggle
  useEffect(() => { if (lang === "hi") records.forEach((r) => translateRecord(r)); }, [lang, records]); // fill in any Hindi still missing

  if (path === "/") return ( // landing: nothing but the page, the language toggle and the patient switcher
    <div className="min-h-full text-ink">
      <Flow />
      <div className="fixed right-4 top-4 z-20 flex items-center gap-2 sm:right-8 sm:top-6"><LangToggle /><PatientSwitcher /></div>
      {children}
    </div>
  );
  return (
    <div className="flex min-h-full flex-col text-ink">
      <Flow />
      <header className="rise-fade sticky top-0 z-20 bg-white/55 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
          <Link href="/" onClick={() => { document.documentElement.dataset.drop = "1"; }} className="latin text-lg font-semibold tracking-tight"><span className="opacity-40">{"//"}</span>BodyMap</Link>
          <nav className="hidden gap-6 text-[0.9rem] md:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href}
                className={active(l.href) ? "font-medium underline decoration-1 underline-offset-[6px]" : "text-muted hover:text-ink"}>{t.nav[l.key]}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2"><LangToggle /><PatientSwitcher /></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-28 pt-6 md:pb-16">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-5 pb-24 pt-6 font-mono text-[11px] leading-relaxed text-muted md:pb-8">
        {t.footer}<br />{t.credits}
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {TABS.map((l) => (
          <Link key={l.href} href={l.href}
            className={`border-t-2 py-3 text-center text-[13px] ${active(l.href) ? "border-ink font-semibold" : "border-transparent text-muted"}`}>
            {l.key === "body" ? t.nav.bodyShort : t.nav[l.key]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
