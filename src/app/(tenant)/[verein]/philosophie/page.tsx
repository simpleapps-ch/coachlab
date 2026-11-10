import type { Metadata } from "next";
import Link from "next/link";
import { Leser } from "@/components/philosophie/leser";
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
  const link = (id: string) => `${basis}/philosophie?${vorschau ? "fassung=entwurf&" : ""}abschnitt=${id}`;
  const original = await originalLink(ph.datei);
  const aktuell = typeof sp.abschnitt === "string" ? sp.abschnitt : undefined;

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

      <Leser dokument={d} aktuell={aktuell} link={link} original={original} />
    </div>
  );
}
