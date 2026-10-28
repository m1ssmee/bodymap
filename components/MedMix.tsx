"use client";
import { useEffect, useState } from "react";
import { Sev } from "@/components/Bits";
import Speak from "@/components/Speak";
import { useLang, useT } from "@/lib/i18n";
import { byLevel, checkWithAI, listKey, reviewedCautions, shortName, unlisted, useSavedChecks, type Caution } from "@/lib/interactions";
import type { Medicine } from "@/lib/medical";

// "Do your medicines mix well?" on the Medicines page: reviewed cautions first, AI checks for medicines the list doesn't know.
export default function MedMix({ meds }: { meds: Medicine[] }) {
  const t = useT(), m = t.meds.mix, lang = useLang();
  const key = listKey(meds);
  const unknown = unlisted(meds);
  const ai = useSavedChecks()[key];
  const [failed, setFailed] = useState<string | null>(null);
  const checking = unknown.length > 0 && !ai && failed !== key;

  useEffect(() => {
    if (checking) checkWithAI(meds).then((done) => { if (!done) setFailed(key); }); // deduped while in flight, saved once done
  }, [checking, key, meds]);

  const cards = [...reviewedCautions(meds), ...(ai ?? [])].sort(byLevel);
  const extra = (c: Caution) => (c.timing ? m[c.timing] : "");
  const say = (c: Caution) => `${c.title[lang]}. ${m.level[c.level]}. ${c.what[lang]} ${c.todo[lang]} ${extra(c)}`;

  return (
    <section>
      <h2 className="label mb-3">{m.title}</h2>
      <div className="panel divide-y divide-line">
        {cards.map((c, i) => (
          <div key={i} className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{c.title[lang]}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Sev s={c.level} label={m.level[c.level]} />
                  {c.ai && <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{m.ai}</span>}
                </div>
              </div>
              <Speak text={say(c)} />
            </div>
            <p className="mt-2">{c.what[lang]}</p>
            <p className="mt-1 text-muted">{c.todo[lang]}</p>
            {c.timing && <p className="mt-1 font-medium">{extra(c)}</p>}
          </div>
        ))}
        {checking && <p className="px-5 py-4 text-muted">{m.checking}</p>}
        {failed === key && !ai && <p className="px-5 py-4 text-muted">{m.failed(unknown.map(shortName).join(", "))}</p>}
        {!cards.length && !checking && failed !== key && <p className="px-5 py-4">{m.none}</p>}
      </div>
      <p className="mt-3 max-w-lg text-[0.9rem] text-muted">{m.footer}</p>
    </section>
  );
}
