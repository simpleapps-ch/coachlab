import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADER, istGueltigerSlug } from "@/lib/tenant";
import type { Rolle } from "@/lib/schema";

/**
 * Datenzugriff für Vereinsseiten (Data Access Layer).
 * Alle Abfragen laufen mit dem Login des Benutzers, also unter Row Level Security.
 */

export type Verein = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  farben: { primaer?: string; sekundaer?: string };
};

export type Benutzer = { id: string; email: string | null };

export type Mitgliedschaft = {
  rolle: Rolle;
  status: "wartet" | "aktiv" | "gesperrt";
};

export type Zugang =
  | { art: "voll"; verein: Verein; benutzer: Benutzer; mitgliedschaft: Mitgliedschaft; verwalten: boolean }
  | { art: "abo_abgelaufen" | "wartet" | "gesperrt" | "kein_mitglied"; verein: Verein; benutzer: Benutzer };

/**
 * Basis-Pfad für Links innerhalb eines Vereins:
 * auf der Subdomain (zug94.coachlab.com) leer, sonst "/zug94".
 */
export async function vereinsBasis(slug: string): Promise<string> {
  const h = await headers();
  return h.get(TENANT_HEADER) === slug ? "" : `/${slug}`;
}

export const ladeVerein = cache(async (slug: string): Promise<Verein | null> => {
  if (!istGueltigerSlug(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verein_oeffentlich", { p_slug: slug });
  // Ein Verbindungsfehler ist kein «Verein nicht gefunden»: sichtbar machen statt 404.
  if (error) throw new Error(`Verein konnte nicht geladen werden: ${error.message}`);
  const verein = (data as Verein[] | null)?.[0];
  return verein ?? null;
});

export const aktuellerBenutzer = cache(async (): Promise<Benutzer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
});

/** Absolute Adresse der aktuellen Anfrage, z. B. für Links in E-Mails. */
export async function aktuelleOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Verein laden oder 404. */
export async function vereinOder404(slug: string): Promise<Verein> {
  const verein = await ladeVerein(slug);
  if (!verein) notFound();
  return verein;
}

/**
 * Zugang des angemeldeten Benutzers zum Verein.
 * Ohne Login wird auf die Login-Seite des Vereins umgeleitet.
 */
export const zugang = cache(async (slug: string): Promise<Zugang> => {
  const z = await zugangOhneUmleitung(slug);
  if (!z) redirect(`${await vereinsBasis(slug)}/login`);
  return z;
});

/** Wie zugang(), aber ohne Login einfach null (z. B. für die Navigation im Layout). */
export const zugangOhneUmleitung = cache(async (slug: string): Promise<Zugang | null> => {
  const verein = await vereinOder404(slug);
  const benutzer = await aktuellerBenutzer();
  if (!benutzer) return null;

  const supabase = await createClient();
  const { data: m } = await supabase
    .from("memberships")
    .select("rolle, status")
    .eq("tenant_id", verein.id)
    .eq("user_id", benutzer.id)
    .maybeSingle();

  if (!m) return { art: "kein_mitglied", verein, benutzer };
  const mitgliedschaft = m as Mitgliedschaft;
  if (mitgliedschaft.status === "wartet") return { art: "wartet", verein, benutzer };
  if (mitgliedschaft.status === "gesperrt") return { art: "gesperrt", verein, benutzer };

  const verwalten = mitgliedschaft.rolle === "owner" || mitgliedschaft.rolle === "admin";

  // Abo-Status: aktive Mitglieder sehen die Vereinszeile (RLS).
  const { data: t } = await supabase
    .from("tenants")
    .select("abo_status")
    .eq("id", verein.id)
    .maybeSingle();
  const aboOk = ["trialing", "active", "past_due"].includes(
    (t as { abo_status?: string } | null)?.abo_status ?? "",
  );
  if (!aboOk && !verwalten) return { art: "abo_abgelaufen", verein, benutzer };

  return { art: "voll", verein, benutzer, mitgliedschaft, verwalten };
});

/** Nur für Owner und Admins, sonst zurück zur Vereins-Startseite. */
export async function nurVerwalter(slug: string) {
  const z = await zugang(slug);
  if (z.art !== "voll" || !z.verwalten) redirect(`${await vereinsBasis(slug)}/`);
  return z;
}
