import type { Metadata } from "next";
import Link from "next/link";
import { Hinweis, Karte } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { aktuellerBenutzer, vereinOder404, vereinsBasis } from "@/lib/verein";
import { AnnehmenFormular, RegistrierenFormular } from "./formulare";

export const metadata: Metadata = { title: "Einladung" };

type Pruefung = { verein_name: string; verein_slug: string; rolle: string; persoenlich: boolean };

const ROLLE = { admin: "Admin", trainer: "Trainer" } as Record<string, string>;

export default async function EinladungSeite({
  params,
  searchParams,
}: PageProps<"/[verein]/einladung">) {
  const { verein: slug } = await params;
  const { code: roh } = await searchParams;
  const verein = await vereinOder404(slug);
  const basis = await vereinsBasis(slug);
  const code = typeof roh === "string" && /^[0-9a-f]{32}$/.test(roh) ? roh : null;

  let einladung: Pruefung | undefined;
  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("einladung_pruefen", { p_code: code });
    einladung = (data as Pruefung[] | null)?.[0];
  }

  if (!code || !einladung || einladung.verein_slug !== verein.slug) {
    return (
      <Karte className="mx-auto w-full max-w-md">
        <h1 className="mb-3 text-xl font-semibold">Einladung</h1>
        <Hinweis art="fehler">
          Diese Einladung ist ungültig, abgelaufen oder wurde schon verwendet. Frag deine
          Technische Leitung nach einem neuen Link.
        </Hinweis>
      </Karte>
    );
  }

  const benutzer = await aktuellerBenutzer();
  const hierher = `${basis}/einladung?code=${code}`;

  return (
    <Karte className="mx-auto w-full max-w-md">
      <h1 className="mb-1 text-xl font-semibold">Willkommen bei {einladung.verein_name}</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Du wurdest als {ROLLE[einladung.rolle] ?? einladung.rolle} eingeladen.
        {einladung.persoenlich
          ? ""
          : " Nach der Registrierung schaltet dich die Technische Leitung frei."}
      </p>

      {benutzer ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Angemeldet als <strong>{benutzer.email}</strong>.
          </p>
          <AnnehmenFormular verein={slug} code={code} />
        </div>
      ) : (
        <>
          <RegistrierenFormular verein={slug} code={code} />
          <p className="mt-6 text-sm text-neutral-500">
            Schon ein Konto?{" "}
            <Link
              href={`${basis}/login?weiter=${encodeURIComponent(hierher)}`}
              className="font-medium text-[var(--vereinsfarbe)] underline"
            >
              Anmelden
            </Link>
          </p>
        </>
      )}
    </Karte>
  );
}
