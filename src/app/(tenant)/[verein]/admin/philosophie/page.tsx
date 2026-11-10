import type { Metadata } from "next";
import Link from "next/link";
import { Karte, Knopf } from "@/components/ui";
import { ladePhilosophien } from "@/lib/philosophie/laden";
import { nurVerwalter, vereinsBasis } from "@/lib/verein";
import { philosophieAendern } from "./actions";
import { Hochladen } from "./hochladen";

export const metadata: Metadata = { title: "Philosophie verwalten" };

const datum = (s: string) =>
  new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(s),
  );

export default async function PhilosophieVerwalten({ params }: PageProps<"/[verein]/admin/philosophie">) {
  const { verein: slug } = await params;
  const z = await nurVerwalter(slug);
  const basis = await vereinsBasis(slug);
  const { entwurf, freigegeben } = await ladePhilosophien(z.verein.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Philosophie verwalten</h1>
        <p className="mt-1 text-neutral-500">
          Lade eure Ausbildungs- und Spielphilosophie als PDF hoch. Coachlab erstellt daraus Abschnitte zum Durchklicken. Du
          prüfst die Vorschau und gibst frei; erst dann sehen sie die Trainer.
        </p>
      </div>

      {entwurf ? (
        <Karte>
          <h2 className="font-semibold">Entwurf</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {entwurf.dateiname ?? "PDF"} · {entwurf.dokument.abschnitte.length} Abschnitte
            {entwurf.dokument.kapitel.length ? ` in ${entwurf.dokument.kapitel.length} Kapiteln` : ""} · hochgeladen am{" "}
            {datum(entwurf.geaendert_am)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`${basis}/philosophie?fassung=entwurf`}
              className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Vorschau ansehen
            </Link>
            <form action={philosophieAendern}>
              <input type="hidden" name="verein" value={slug} />
              <input type="hidden" name="aktion" value="freigeben" />
              <Knopf type="submit">{freigegeben ? "Freigeben und bisherige ersetzen" : "Freigeben"}</Knopf>
            </form>
            <form action={philosophieAendern}>
              <input type="hidden" name="verein" value={slug} />
              <input type="hidden" name="aktion" value="verwerfen" />
              <Knopf type="submit" art="gefahr">
                Entwurf verwerfen
              </Knopf>
            </form>
          </div>
        </Karte>
      ) : null}

      <Karte>
        <h2 className="font-semibold">Freigegeben</h2>
        {freigegeben ? (
          <p className="mt-1 text-sm text-neutral-500">
            {freigegeben.dateiname ?? "PDF"} · {freigegeben.dokument.abschnitte.length} Abschnitte · freigegeben am{" "}
            {freigegeben.freigegeben_am ? datum(freigegeben.freigegeben_am) : "–"} ·{" "}
            <Link href={`${basis}/philosophie`} className="underline">
              ansehen
            </Link>
          </p>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">Noch keine Philosophie freigegeben.</p>
        )}
      </Karte>

      <Karte>
        <h2 className="mb-3 font-semibold">{entwurf || freigegeben ? "Neue Fassung hochladen" : "PDF hochladen"}</h2>
        <Hochladen verein={slug} tenantId={z.verein.id} />
        <p className="mt-3 text-xs text-neutral-500">
          Gut geeignet sind Foliensätze und Dokumente, die direkt aus Google Slides, PowerPoint, Keynote oder Word als PDF
          exportiert wurden. Jede Seite wird ein Abschnitt; Kapitelseiten («A», «B» …) gruppieren die Abschnitte. Das
          Original-PDF bleibt für alle Trainer abrufbar.
        </p>
      </Karte>
    </div>
  );
}
