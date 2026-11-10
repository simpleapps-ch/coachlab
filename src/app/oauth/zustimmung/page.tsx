import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hinweis, Karte, Knopf } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { oauthAbmelden, oauthEntscheiden } from "./actions";
import { autorisierungsId } from "./anfrage";
import { AnmeldeFormular } from "./anmelden-formular";

export const metadata: Metadata = { title: "Claude verbinden · Coachlab" };

const ROLLEN = { owner: "Technische Leitung", admin: "Admin", trainer: "Trainer" } as const;

/**
 * Zustimmungsseite des Connectors (Supabase OAuth 2.1, «Authorization Path»).
 * Supabase leitet mit ?authorization_id=… hierher; die Person meldet sich an und erlaubt
 * oder lehnt ab. Danach geht es zurück zu Claude.
 */
export default async function Zustimmung({ searchParams }: PageProps<"/oauth/zustimmung">) {
  const { authorization_id, fehler } = await searchParams;
  const id = autorisierungsId.safeParse(authorization_id);

  if (!id.success) {
    return (
      <Rahmen titel="Claude verbinden">
        <Hinweis art="fehler">
          Diese Seite öffnet sich, wenn du in Claude den Coachlab-Connector verbindest. Die Anfrage fehlt
          oder ist ungültig. Bitte starte die Verbindung in Claude neu.
        </Hinweis>
      </Rahmen>
    );
  }

  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  const benutzer = c?.claims?.sub ? { id: c.claims.sub, email: (c.claims.email as string) ?? "" } : null;

  if (!benutzer) {
    return (
      <Rahmen titel="Claude verbinden" untertitel="Melde dich mit deinem Coachlab-Konto an.">
        <AnmeldeFormular autorisierungsId={id.data} />
      </Rahmen>
    );
  }

  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(id.data);
  if (error || !details) {
    return (
      <Rahmen titel="Claude verbinden">
        <Hinweis art="fehler">
          Die Anfrage ist abgelaufen oder wurde schon beantwortet. Bitte starte die Verbindung in Claude neu.
        </Hinweis>
      </Rahmen>
    );
  }
  // Schon früher erlaubt: direkt zurück zu Claude.
  if (!("authorization_id" in details)) redirect(details.redirect_url);

  const { data: mitgliedschaften } = await supabase
    .from("memberships")
    .select("rolle, tenants(name, slug)")
    .eq("user_id", benutzer.id)
    .eq("status", "aktiv");
  const vereine = ((mitgliedschaften ?? []) as unknown as Array<{
    rolle: keyof typeof ROLLEN;
    tenants: { name: string; slug: string } | null;
  }>).filter((m) => m.tenants);
  const darfSpeichern = vereine.some((v) => v.rolle !== "trainer");

  let ziel = details.redirect_uri;
  try {
    ziel = new URL(details.redirect_uri).host;
  } catch {}

  return (
    <Rahmen titel={`${details.client.name || "Claude"} mit Coachlab verbinden`}>
      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-300">
        <strong>{details.client.name || "Ein Programm"}</strong> möchte in deinem Namen auf Coachlab zugreifen.
        Es sieht und darf nie mehr als du auf der Website.
      </p>

      {vereine.length ? (
        <ul className="mb-4 flex flex-col gap-1 text-sm">
          {vereine.map((v) => (
            <li key={v.tenants!.slug} className="flex justify-between rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
              <span className="font-medium">{v.tenants!.name}</span>
              <span className="text-neutral-500">{ROLLEN[v.rolle]}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mb-4">
          <Hinweis>Du bist noch in keinem Verein aktives Mitglied. Der Connector findet darum keine Übungen.</Hinweis>
        </div>
      )}

      <p className="mb-1 text-sm font-medium">Erlaubt wird:</p>
      <ul className="mb-4 list-disc pl-5 text-sm text-neutral-600 dark:text-neutral-300">
        <li>Übungen deiner Vereine suchen und lesen</li>
        {darfSpeichern ? (
          <li>Neue Übungen als Entwurf speichern (nur wo du Technische Leitung oder Admin bist). Freigeben geht weiterhin nur hier auf der Website.</li>
        ) : null}
      </ul>

      {fehler === "entscheid" ? (
        <div className="mb-4">
          <Hinweis art="fehler">Das hat nicht geklappt. Bitte versuche es nochmals oder starte die Verbindung in Claude neu.</Hinweis>
        </div>
      ) : null}

      <form action={oauthEntscheiden} className="flex gap-3">
        <input type="hidden" name="authorization_id" value={id.data} />
        <Knopf type="submit" name="entscheid" value="erlauben" className="flex-1">
          Erlauben
        </Knopf>
        <Knopf type="submit" name="entscheid" value="ablehnen" art="sekundaer" className="flex-1">
          Ablehnen
        </Knopf>
      </form>

      <p className="mt-6 text-xs text-neutral-500">
        Angemeldet als {benutzer.email}. Danach geht es zurück zu {ziel}.
      </p>
      <form action={oauthAbmelden} className="mt-1">
        <input type="hidden" name="authorization_id" value={id.data} />
        <button type="submit" className="text-xs text-neutral-500 underline">
          Mit einem anderen Konto anmelden
        </button>
      </form>
    </Rahmen>
  );
}

function Rahmen({ titel, untertitel, children }: { titel: string; untertitel?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <p className="mb-3 text-center text-sm font-semibold tracking-tight text-neutral-500">Coachlab</p>
      <Karte>
        <h1 className="mb-1 text-xl font-semibold">{titel}</h1>
        {untertitel ? <p className="mb-6 text-sm text-neutral-500">{untertitel}</p> : <div className="mb-4" />}
        {children}
      </Karte>
    </main>
  );
}
