import type { Metadata } from "next";
import Link from "next/link";
import { Hinweis, Karte } from "@/components/ui";
import { UebungsKarte } from "@/components/uebung-karte";
import { filterAktiv, filterLesen, type UebungsFilter } from "@/lib/uebung-filter";
import { INTENSITAETEN, KATEGORIEN, SFV_ALTER, SFV_STUFEN, SPIELPHASEN } from "@/lib/uebung-schema";
import { bibliothek } from "@/lib/uebungen";
import { vereinsBasis, zugang } from "@/lib/verein";

export const metadata: Metadata = { title: "Übungen" };

function Auswahlfeld({
  name,
  werte,
  gewaehlt,
  beschriftung,
}: {
  name: string;
  werte: readonly string[];
  gewaehlt: string[];
  beschriftung?: (w: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {werte.map((w) => (
        <label key={w} className="cursor-pointer">
          <input type="checkbox" name={name} value={w} defaultChecked={gewaehlt.includes(w)} className="peer sr-only" />
          <span className="inline-block rounded-full border border-neutral-300 px-2.5 py-1 text-sm peer-checked:border-[var(--vereinsfarbe)] peer-checked:bg-[var(--vereinsfarbe)] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--vereinsfarbe)] dark:border-neutral-700">
            {beschriftung ? beschriftung(w) : w}
          </span>
        </label>
      ))}
    </div>
  );
}

function Filter({ f, basis }: { f: UebungsFilter; basis: string }) {
  const titel = "mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500";
  return (
    <form method="get" action={`${basis}/uebungen`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">
          <span className={titel}>Suche</span>
          <input
            type="search"
            name="q"
            defaultValue={f.q}
            placeholder="z. B. Pressing, Rondo, Abschluss"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
          />
        </label>
        <label className="flex w-32 flex-col gap-1.5 text-sm">
          <span className={titel}>Spielerzahl</span>
          <input
            type="number"
            name="spieler"
            min={1}
            max={40}
            defaultValue={f.spieler}
            placeholder="z. B. 14"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="torhueter" value="1" defaultChecked={f.torhueter} className="h-4 w-4 accent-[var(--vereinsfarbe)]" />
          mit Torhüter
        </label>
      </div>

      <div>
        <p className={titel}>Stufe</p>
        <Auswahlfeld name="stufe" werte={SFV_STUFEN} gewaehlt={f.stufen} beschriftung={(s) => (s === "Aktive" ? s : `${s} · ${SFV_ALTER[s as keyof typeof SFV_ALTER]}`)} />
      </div>

      <details open={f.kategorien.length + f.phasen.length + f.intensitaeten.length > 0 || f.dauerMax !== undefined}>
        <summary className="cursor-pointer text-sm font-medium text-neutral-600 dark:text-neutral-300">Weitere Filter</summary>
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <p className={titel}>Kategorie</p>
            <Auswahlfeld name="kategorie" werte={KATEGORIEN} gewaehlt={f.kategorien} />
          </div>
          <div>
            <p className={titel}>Spielphase</p>
            <Auswahlfeld name="phase" werte={SPIELPHASEN} gewaehlt={f.phasen} />
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className={titel}>Intensität</p>
              <Auswahlfeld name="intensitaet" werte={INTENSITAETEN} gewaehlt={f.intensitaeten} />
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={titel}>Dauer höchstens</span>
              <select
                name="dauer"
                defaultValue={f.dauerMax ?? ""}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
              >
                <option value="">egal</option>
                {[10, 15, 20, 30, 45].map((d) => (
                  <option key={d} value={d}>
                    {d} Minuten
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </details>

      <div className="flex gap-2">
        <button className="rounded-lg bg-[var(--vereinsfarbe)] px-4 py-2 font-medium text-white hover:opacity-90">Filtern</button>
        {filterAktiv(f) ? (
          <Link href={`${basis}/uebungen`} className="rounded-lg px-4 py-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
            Zurücksetzen
          </Link>
        ) : null}
      </div>
    </form>
  );
}

export default async function Bibliothek({ params, searchParams }: PageProps<"/[verein]/uebungen">) {
  const { verein: slug } = await params;
  const z = await zugang(slug);
  const basis = await vereinsBasis(slug);
  if (z.art !== "voll") {
    return (
      <Karte className="mx-auto w-full max-w-lg">
        <Hinweis>Die Übungen siehst du, sobald dein Zugang aktiv ist.</Hinweis>
      </Karte>
    );
  }

  const f = filterLesen(await searchParams);
  const uebungen = await bibliothek(z.verein.id, f);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Übungen</h1>
        <p className="text-sm text-neutral-500">
          {uebungen.length} {uebungen.length === 1 ? "Übung" : "Übungen"}
          {filterAktiv(f) ? " passend zum Filter" : ""}
        </p>
      </div>

      <Karte>
        <Filter f={f} basis={basis} />
      </Karte>

      {uebungen.length === 0 ? (
        <Hinweis>
          {filterAktiv(f)
            ? "Keine Übung passt zu diesem Filter. Versuch es mit weniger Einschränkungen."
            : z.verwalten
              ? "Noch keine freigegebenen Übungen. Entwürfe gibst du unter «Entwürfe & Freigabe» frei."
              : "Noch keine Übungen freigegeben."}
        </Hinweis>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {uebungen.map((u) => (
            <UebungsKarte key={u.id} u={u} href={`${basis}/uebungen/${u.slug}`} />
          ))}
        </div>
      )}
    </div>
  );
}
