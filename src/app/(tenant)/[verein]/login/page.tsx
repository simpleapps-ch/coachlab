import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hinweis, Karte } from "@/components/ui";
import { sichererPfad } from "@/lib/pfad";
import { aktuellerBenutzer, vereinOder404, vereinsBasis } from "@/lib/verein";
import { LoginFormular } from "./login-formular";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginSeite({ params, searchParams }: PageProps<"/[verein]/login">) {
  const { verein: slug } = await params;
  const { weiter, fehler } = await searchParams;
  const verein = await vereinOder404(slug);
  const basis = await vereinsBasis(slug);
  const ziel = typeof weiter === "string" ? sichererPfad(weiter) : undefined;

  if (await aktuellerBenutzer()) redirect(ziel ?? `${basis}/`);

  return (
    <Karte className="mx-auto w-full max-w-sm">
      <h1 className="mb-1 text-xl font-semibold">Anmelden</h1>
      <p className="mb-6 text-sm text-neutral-500">bei {verein.name}</p>
      {fehler === "link" ? (
        <div className="mb-4">
          <Hinweis art="fehler">Der Link ist ungültig oder abgelaufen. Bitte melde dich an.</Hinweis>
        </div>
      ) : null}
      <LoginFormular verein={slug} weiter={ziel} />
      <p className="mt-6 text-sm text-neutral-500">
        Noch kein Konto? Du brauchst einen Einladungslink von deiner Technischen Leitung.
      </p>
    </Karte>
  );
}
