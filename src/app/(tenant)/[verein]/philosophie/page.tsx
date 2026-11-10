import type { Metadata } from "next";
import Link from "next/link";
import { AbschnittInhalt } from "@/components/philosophie/abschnitt";
import { Hinweis, Karte } from "@/components/ui";
import { ladePhilosophien, originalLink } from "@/lib/philosophie/laden";
import { vereinsBasis, zugang } from "@/lib/verein";

export const metadata: Metadata = { title: "Philosophie" };

export default async function PhilosophieSeite({ params, searchParams }: PageProps<"/[verein]/philosophie">) {
  const { verein: slug } = await params;
  const sp = await searchParams;
  const z = await zugang(slug);
  const basis = await vereinsBasis(slug);
  if (z.art !== "voll") {
    return (
      <Karte className="mx-auto w-full max-w-lg">
        <Hinweis>Die Philosophie siehst du, sobald dein Zugang aktiv ist.</Hinweis>
      </Karte>
    );
  }

  const fassungen = await ladePhilosophien(z.verein.id);
  // Vorschau des Entwurfs nur für Owner und Admins (RLS liefert ihn sonst gar nicht)
  const vorschau = sp.fassung === "entwurf" && z.verwalten && !!fassungen.entwurf;
  const ph = vorschau ? fassungen.entwurf : fassungen.freigegeben;

  if (!ph) {
    return (
      <Karte className="mx-auto w-full max-w-xl">
        <h1 className="mb-2 text-xl font-semibold">Ausbildungs- und Spielphilosophie</h1>
        {z.verwalten ? (
          <>
            <p className="mb-4 text-neutral-600 dark:text-neutral-300">
              Lade eure Philosophie als PDF hoch. Coachlab macht daraus Abschnitte zum Durchklicken für alle Trainer.
            </p>
            <Link href={`${basis}/admin/philosophie`} className="font-medium text-[var(--vereinsfarbe)] underline">
              Philosophie hochladen
            </Link>
          </>
        ) : (
          <Hinweis>Eure Technische Leitung hat die Philosophie noch nicht veröffentlicht.</Hinweis>
        )}
      </Karte>
    );
  }

  const d = ph.dokument;
  const index = Math.max(0, d.abschnitte.findIndex((a) => a.id === sp.abschnitt));
  const a = d.abschnitte[index];
  const vorher = d.abschnitte[index - 1];
  const nachher = d.abschnitte[index + 1];
  const kapitel = d.kapitel.find((k) => k.nr === a.kapitel);
  const link = (id: string) => `${basis}/philosophie?${vorschau ? "fassung=entwurf&" : ""}abschnitt=${id}`;
  const original = await originalLink(ph.datei);

  // Inhaltsverzeichnis: Abschnitte ohne Kapitel zuerst, dann je Kapitel
  const gruppen = [
    { kapitel: null as (typeof d.kapitel)[number] | null, abschnitte: d.abschnitte.filter((x) => x.kapitel === null) },
    ...d.kapitel.map((k) => ({ kapitel: k, abschnitte: d.abschnitte.filter((x) => x.kapitel === k.nr) })),
  ].filter((g) => g.abschnitte.length);

  const verzeichnis = (
    <nav aria-label="Inhalt der Philosophie" className="flex flex-col gap-4 text-sm">
      {gruppen.map((g) => (
        <div key={g.kapitel?.nr ?? 0}>
          {g.kapitel ? (
            <p className="mb-1.5 font-semibold">
              {g.kapitel.zeichen} · {g.kapitel.titel}
            </p>
          ) : null}
          <ul className="flex flex-col">
            {g.abschnitte.map((x) => (
              <li key={x.id}>
                <Link
                  href={link(x.id)}
                  aria-current={x.id === a.id ? "page" : undefined}
                  className={`block rounded-md px-2 py-1.5 ${
                    x.id === a.id
                      ? "bg-[var(--vereinsfarbe)] font-medium text-white"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  {x.titel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex flex-col gap-6">
      {vorschau ? (
        <Hinweis>
          Vorschau des Entwurfs: Trainer sehen diese Fassung erst nach der Freigabe.{" "}
          <Link href={`${basis}/admin/philosophie`} className="font-medium underline">
            Zur Freigabe
          </Link>
        </Hinweis>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{d.titel}</h1>
          {d.untertitel ? <p className="mt-1 max-w-2xl text-neutral-500">{d.untertitel}</p> : null}
        </div>
        {z.verwalten && !vorschau ? (
          <Link href={`${basis}/admin/philosophie`} className="text-sm text-neutral-500 underline">
            Neue Fassung hochladen
          </Link>
        ) : null}
      </header>

      <details className="rounded-xl border border-neutral-200 bg-white p-3 lg:hidden dark:border-neutral-800 dark:bg-neutral-900">
        <summary className="cursor-pointer text-sm font-medium">
          Inhalt · Abschnitt {index + 1} von {d.abschnitte.length}
        </summary>
        <div className="mt-3">{verzeichnis}</div>
      </details>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto pr-2">{verzeichnis}</div>
        </aside>

        <article className="flex min-w-0 flex-col gap-5">
          <div>
            {kapitel ? (
              <p className="text-sm font-medium text-[var(--vereinsfarbe)]">
                {kapitel.zeichen} · {kapitel.titel}
              </p>
            ) : null}
            <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">{a.titel}</h2>
          </div>

          <AbschnittInhalt bloecke={a.bloecke} />

          <nav aria-label="Abschnitte blättern" className="mt-4 grid gap-3 border-t border-neutral-200 pt-5 sm:grid-cols-2 dark:border-neutral-800">
            {vorher ? (
              <Link href={link(vorher.id)} className="rounded-xl border border-neutral-200 p-3 hover:border-[var(--vereinsfarbe)] dark:border-neutral-800">
                <span className="block text-xs text-neutral-500">Zurück</span>
                <span className="font-medium">{vorher.titel}</span>
              </Link>
            ) : (
              <span />
            )}
            {nachher ? (
              <Link
                href={link(nachher.id)}
                className="rounded-xl border border-neutral-200 p-3 text-right hover:border-[var(--vereinsfarbe)] dark:border-neutral-800"
              >
                <span className="block text-xs text-neutral-500">Weiter</span>
                <span className="font-medium">{nachher.titel}</span>
              </Link>
            ) : null}
          </nav>

          <p className="text-xs text-neutral-500">
            Abschnitt {index + 1} von {d.abschnitte.length}
            {original ? (
              <>
                {" · "}
                <a href={`${original}#page=${a.seite}`} target="_blank" rel="noopener" className="underline">
                  Original ansehen (PDF, Seite {a.seite})
                </a>
              </>
            ) : null}
          </p>
        </article>
      </div>
    </div>
  );
}
