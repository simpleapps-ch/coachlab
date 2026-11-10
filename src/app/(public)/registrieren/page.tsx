import type { Metadata } from "next";
import { Hinweis, Karte } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { AnmeldeFormular, KontoFormular, VereinFormular } from "./formulare";

export const metadata: Metadata = { title: "Verein registrieren · Coachlab" };

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "coachlab.com";
// Vorschau der Vereinsadresse: Subdomain auf der eigenen Domain, sonst Pfad (z. B. auf netlify.app).
const ADRESSE = ROOT.endsWith("netlify.app") ? `${ROOT}/{slug}` : `{slug}.${ROOT.split(":")[0]}`;

export default async function Registrieren({ searchParams }: PageProps<"/registrieren">) {
  const { abbruch } = await searchParams;
  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  const angemeldet = c?.claims?.sub ? { id: c.claims.sub, email: (c.claims.email as string) ?? "" } : null;

  // Angefangene Registrierung (Verein ohne abgeschlossenes Abo) wieder aufnehmen.
  let vorgabe: { name: string; slug: string } | undefined;
  if (angemeldet) {
    const { data } = await supabase
      .from("memberships")
      .select("tenants(name, slug, abo_status)")
      .eq("user_id", angemeldet.id)
      .eq("rolle", "owner");
    const offen = ((data ?? []) as unknown as Array<{ tenants: { name: string; slug: string; abo_status: string } | null }>)
      .map((m) => m.tenants)
      .find((t) => t?.abo_status === "incomplete");
    if (offen) vorgabe = { name: offen.name, slug: offen.slug };
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="titel text-4xl">Verein registrieren</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {angemeldet ? "Schritt 2 von 2: dein Verein und das Abo." : "Schritt 1 von 2: dein Konto als Technische Leitung."}
        </p>
      </div>

      {abbruch ? <Hinweis>Die Zahlung wurde abgebrochen. Du kannst es jederzeit nochmals versuchen.</Hinweis> : null}

      {angemeldet ? (
        <Karte>
          <VereinFormular vorgabe={vorgabe} muster={ADRESSE} />
          <p className="mt-4 text-xs text-neutral-500">Angemeldet als {angemeldet.email}.</p>
        </Karte>
      ) : (
        <>
          <Karte>
            <KontoFormular />
          </Karte>
          <Karte>
            <h2 className="mb-4 text-sm font-medium">Schon ein Coachlab-Konto?</h2>
            <AnmeldeFormular />
          </Karte>
        </>
      )}
    </main>
  );
}
