import Link from "next/link";
import type { PhilosophieDokument } from "@/lib/philosophie/schema";
import { AbschnittInhalt } from "./abschnitt";
import { Folie } from "./folie";

/**
 * Leseansicht der Philosophie: ein Abschnitt pro Seite, Inhaltsverzeichnis mit aufklappbaren
 * Kapiteln (nur das aktuelle ist offen), unten Zurück/Weiter.
 */

export type Ansicht = "folie" | "text";

type Props = {
  dokument: PhilosophieDokument;
  aktuell: string | undefined;
  /** Link zu einem Abschnitt in einer Ansicht (mit Vereinsbasis und ggf. Vorschau-Parameter) */
  link: (id: string, ansicht: Ansicht) => string;
  /**
   * url: kurz gültiger Link fürs Laden der Folien, datei: Pfad (Zwischenspeicher im Browser),
   * ansehen: Seite -> Link «Original ansehen» (prüft bei jedem Klick den Login)
   */
  original: { url: string; datei: string; ansehen: (seite: number) => string } | null;
  ansicht: Ansicht;
};

export function Leser({ dokument: d, aktuell, link: linkIn, original, ansicht: gewuenscht }: Props) {
  const ansicht: Ansicht = original ? gewuenscht : "text";
  const link = (id: string) => linkIn(id, ansicht);
  const index = Math.max(0, d.abschnitte.findIndex((a) => a.id === aktuell));
  const a = d.abschnitte[index];
  const vorher = d.abschnitte[index - 1];
  const nachher = d.abschnitte[index + 1];
  const kapitel = d.kapitel.find((k) => k.nr === a.kapitel);

  // Abschnitte vor dem ersten Kapitel bilden die Gruppe «Einführung»
  const gruppen = [
    { schluessel: "einfuehrung", titel: "Einführung", abschnitte: d.abschnitte.filter((x) => x.kapitel === null) },
    ...d.kapitel.map((k) => ({
      schluessel: `k${k.nr}`,
      titel: `${k.zeichen} · ${k.titel}`,
      abschnitte: d.abschnitte.filter((x) => x.kapitel === k.nr),
    })),
  ].filter((g) => g.abschnitte.length);

  const verzeichnis = (
    <nav aria-label="Inhalt der Philosophie" className="flex flex-col gap-1 text-sm">
      {gruppen.map((g) => {
        const offen = g.abschnitte.some((x) => x.id === a.id);
        return (
          <details key={g.schluessel} open={offen} className="group rounded-lg">
            <summary
              className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2 py-2 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                offen ? "text-[var(--vereinsfarbe)]" : ""
              }`}
            >
              <span>{g.titel}</span>
              <span className="flex items-center gap-2 text-xs font-normal text-neutral-500">
                {g.abschnitte.length}
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="transition-transform group-open:rotate-90">
                  <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </summary>
            <ul className="mb-2 ml-2 flex flex-col border-l border-neutral-200 pl-2 dark:border-neutral-800">
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
          </details>
        );
      })}
    </nav>
  );

  return (
    <>
      <details className="rounded-xl border border-neutral-200 bg-white p-3 lg:hidden dark:border-neutral-800 dark:bg-neutral-900">
        <summary className="cursor-pointer text-sm font-medium">
          Inhalt · {kapitel ? `${kapitel.zeichen} · ` : ""}
          {a.titel}
        </summary>
        <div className="mt-3">{verzeichnis}</div>
      </details>

      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
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
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-2xl font-semibold sm:text-3xl">{a.titel}</h2>
              {original ? (
                <div role="group" aria-label="Ansicht" className="inline-flex rounded-lg border border-neutral-200 p-0.5 text-sm dark:border-neutral-800">
                  {(["folie", "text"] as const).map((v) => (
                    <Link
                      key={v}
                      href={linkIn(a.id, v)}
                      aria-current={ansicht === v ? "true" : undefined}
                      className={`rounded-md px-3 py-1 ${
                        ansicht === v
                          ? "bg-[var(--vereinsfarbe)] font-medium text-white"
                          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {v === "folie" ? "Folie" : "Text"}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {ansicht === "folie" && original ? (
            <Folie key={`${original.datei}-${a.seite}`} url={original.url} datei={original.datei} seite={a.seite} titel={a.titel} />
          ) : (
            <AbschnittInhalt bloecke={a.bloecke} />
          )}

          <nav
            aria-label="Abschnitte blättern"
            className="mt-4 grid gap-3 border-t border-neutral-200 pt-5 sm:grid-cols-2 dark:border-neutral-800"
          >
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
                <a href={original.ansehen(a.seite)} target="_blank" rel="noopener" className="underline">
                  Original ansehen (PDF, Seite {a.seite})
                </a>
              </>
            ) : null}
          </p>
        </article>
      </div>
    </>
  );
}
