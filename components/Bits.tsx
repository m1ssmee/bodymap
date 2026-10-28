"use client";
import { useT } from "@/lib/i18n";
import { SEVERITY_COLOR, type Kind, type Severity } from "@/lib/medical";

export const Dot = ({ s, size = 8 }: { s: Severity; size?: number }) => {
  const t = useT();
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: SEVERITY_COLOR[s] }} aria-label={t.sev[s]} />;
};

export const Sev = ({ s, label }: { s: Severity; label?: string }) => {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: SEVERITY_COLOR[s] }}>
      <Dot s={s} size={7} />{label ?? t.sev[s]}
    </span>
  );
};

const ABBR: Record<Kind, string> = { prescription: "RX", blood: "LAB", xray: "XR", mri: "MRI", ct: "CT", ultrasound: "US", other: "DOC" };

export const Thumb = ({ src, kind, size = 44 }: { src?: string; kind: Kind; size?: number }) => {
  const t = useT();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={t.kind[kind]} width={size} height={size} className="shrink-0 rounded-md bg-black/5 object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-md bg-black/[0.06] font-mono text-[10px] tracking-wider text-muted" style={{ width: size, height: size }}>{ABBR[kind]}</span>
  );
};

export const Arrow = () => <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100"><path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
