"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import RecordView from "@/components/RecordView";
import type { MedRecord } from "@/lib/medical";
import { useT } from "@/lib/i18n";
import { addRecord, translateRecord } from "@/lib/store";

type Extracted = Omit<MedRecord, "id">;
const SAMPLES = [
  { i: 0, url: "/demo/07-blood-oct26.png" },
  { i: 1, url: "/demo/08-rx-handwritten.jpg" },
];

// Downscale photos so they stay under Vercel's 4.5 MB request limit.
async function toJpeg(file: Blob, max: number, quality: number) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}
const toDataUrl = (f: Blob) => new Promise<string>((ok, err) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = err; r.readAsDataURL(f); });

export default function Upload() {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "reading" | "preview">("idle");
  const [error, setError] = useState("");
  const [rec, setRec] = useState<Extracted | null>(null);
  const [thumb, setThumb] = useState<string | undefined>();
  const [preview, setPreview] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  async function handle(file: Blob) {
    setError(""); setState("reading");
    try {
      const isPdf = file.type === "application/pdf";
      if (isPdf && file.size > 4_000_000) throw new Error(t.upload.pdfTooBig);
      const dataUrl = isPdf ? await toDataUrl(file) : await toJpeg(file, 1800, 0.85);
      const small = isPdf ? undefined : await toJpeg(file, 360, 0.7);
      setThumb(small); setPreview(isPdf ? undefined : dataUrl);
      const res = await fetch("/api/extract", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mimeType: isPdf ? "application/pdf" : "image/jpeg", data: dataUrl.split(",")[1] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t.upload.failed);
      setRec(json); setState("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.upload.failed); setState("idle");
    }
  }

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handle(f); };
  const sample = async (url: string) => handle(await (await fetch(url)).blob());

  function save() {
    if (!rec) return;
    const id = crypto.randomUUID();
    const record = { ...rec, id, image: thumb };
    addRecord(record);
    translateRecord(record); // Hindi is fetched in the background so uploads stay fast
    router.push(`/body?record=${id}`);
  }

  if (state === "preview" && rec) return (
    <div className="mx-auto max-w-2xl space-y-6 pt-4 md:pt-10">
      <div>
        <div className="label">{t.upload.check}</div>
        <h1 className="mt-4 text-4xl font-medium tracking-[-0.035em]">{t.upload.match}</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <label className="block"><span className="label">{t.upload.titleField}</span>
          <input value={rec.title} onChange={(e) => setRec({ ...rec, title: e.target.value })} className="field mt-1.5" /></label>
        <label className="block"><span className="label">{t.upload.dateField}</span>
          <input type="date" value={rec.date} onChange={(e) => setRec({ ...rec, date: e.target.value })} className="field mt-1.5" /></label>
      </div>
      <div className="panel p-6"><RecordView r={rec} /></div>
      <div className="sticky bottom-20 flex items-center gap-3 md:bottom-6">
        <button onClick={save} className="flex-1 rounded-full bg-ink py-4 font-medium text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,.5)]">{t.upload.save}</button>
        <button onClick={() => { setRec(null); setState("idle"); }} className="rounded-full bg-white/80 px-6 py-4 font-medium">{t.upload.discard}</button>
      </div>
    </div>
  );

  const reading = state === "reading";
  return (
    <div className="mx-auto max-w-2xl space-y-10 pt-4 md:pt-10">
      <div>
        <div className="label">{t.upload.label}</div>
        <h1 className="mt-4 text-[2.4rem] font-medium leading-[1.05] tracking-[-0.04em] sm:text-6xl">{t.upload.title}</h1>
        <p className="mt-4 text-muted">{t.upload.intro}</p>
      </div>

      {reading ? (
        <div className="panel overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          {preview && <img src={preview} alt="Your document" className="max-h-80 w-full bg-black/5 object-contain" />}
          <div className="h-0.5 w-full overflow-hidden bg-line"><div className="h-full w-1/3 animate-[slide_1.4s_ease-in-out_infinite] bg-ink" /></div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="font-medium">{t.upload.reading}</span>
            <span className="label">{t.upload.time}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-[#d4483b]/30 bg-white/80 px-4 py-3 text-[#b13a2f]">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => camRef.current?.click()} className="rounded-2xl bg-ink px-6 py-7 text-left text-white transition hover:bg-black">
              <div className="text-xl font-medium">{t.upload.photo}</div>
              <div className="mt-1 text-[0.9rem] text-white/60">{t.upload.photoSub}</div>
            </button>
            <button onClick={() => fileRef.current?.click()} className="panel px-6 py-7 text-left transition hover:bg-white">
              <div className="text-xl font-medium">{t.upload.file}</div>
              <div className="mt-1 text-[0.9rem] text-muted">{t.upload.fileSub}</div>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
            <span className="label">{t.upload.sample}</span>
            {SAMPLES.map((s) => <button key={s.url} onClick={() => sample(s.url)} className="min-h-11 text-[0.9rem] underline decoration-1 underline-offset-4 hover:decoration-2">{t.upload.samples[s.i]}</button>)}
          </div>
        </div>
      )}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
      <p className="font-mono text-[0.72rem] text-muted">{t.upload.privacy}</p>
    </div>
  );
}
