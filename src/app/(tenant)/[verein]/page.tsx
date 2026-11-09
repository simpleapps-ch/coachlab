import Link from "next/link";
import { Hinweis, Karte } from "@/components/ui";
import { vereinsBasis, zugang } from "@/lib/verein";

const ROLLEN_NAME = { owner: "Technische Leitung", admin: "Admin", trainer: "Trainer" } as const;

export default async function VereinsStart({ params }: PageProps<"/[verein]">) {
  const { verein: slug } = await params;
  const z = await zugang(slug);
  const basis = await vereinsBasis(slug);

  if (z.art !== "voll") {
    const text = {
      wartet:
        "Dein Konto wartet auf Freischaltung. Sobald die Technische Leitung dich freigibt, siehst du hier die Inhalte.",
      gesperrt: "Dein Zugang zu diesem Verein ist gesperrt. Wende dich an die Technische Leitung.",
      kein_mitglied:
        "Du bist mit diesem Konto kein Mitglied dieses Vereins. Frag die Technische Leitung nach einem Einladungslink.",
      abo_abgelaufen:
        "Das Abo des Vereins ist abgelaufen. Die Technische Leitung kann es im Admin-Bereich verlängern.",
    }[z.art];
    return (
      <Karte className="mx-auto w-full max-w-lg">
        <h1 className="mb-3 text-xl font-semibold">{z.verein.name}</h1>
        <Hinweis>{text}</Hinweis>
      </Karte>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Willkommen bei {z.verein.name}</h1>
        <p className="text-neutral-500">{ROLLEN_NAME[z.mitgliedschaft.rolle]}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Karte>
          <h2 className="mb-1 font-semibold">Übungsbibliothek</h2>
          <p className="text-sm text-neutral-500">Kommt in Phase 2: Übungen mit Animation, Filter nach Stufe und Spielerzahl.</p>
        </Karte>
        <Karte>
          <h2 className="mb-1 font-semibold">Philosophie</h2>
          <p className="text-sm text-neutral-500">Kommt in Phase 3: Spielprinzipien des Vereins mit passenden Übungen.</p>
        </Karte>
        {z.verwalten ? (
          <Link href={`${basis}/admin/mitglieder`} className="block">
            <Karte className="h-full transition hover:border-[var(--vereinsfarbe)]">
              <h2 className="mb-1 font-semibold">Mitglieder verwalten →</h2>
              <p className="text-sm text-neutral-500">Trainer einladen, freischalten, Rollen vergeben.</p>
            </Karte>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
