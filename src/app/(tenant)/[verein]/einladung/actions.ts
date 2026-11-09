"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { slug as slugSchema } from "@/lib/schema";
import { createClient } from "@/lib/supabase/server";
import { aktuelleOrigin, vereinsBasis } from "@/lib/verein";

export type EinladungZustand = {
  fehler?: string;
  bestaetigen?: string; // E-Mail, an die der Bestätigungslink ging
  name?: string;
  email?: string;
};

const code = z.string().regex(/^[0-9a-f]{32}$/);

async function annehmenUndWeiter(slug: string, einladungscode: string): Promise<EinladungZustand> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("einladung_annehmen", { p_code: einladungscode });
  if (error) return { fehler: error.message };
  redirect(`${await vereinsBasis(slug)}/`);
}

/** Bereits angemeldet: Einladung mit dem bestehenden Konto annehmen. */
export async function einladungAnnehmen(
  _: EinladungZustand,
  formData: FormData,
): Promise<EinladungZustand> {
  const v = slugSchema.safeParse(formData.get("verein"));
  const c = code.safeParse(formData.get("code"));
  if (!v.success || !c.success) return { fehler: "Ungültige Einladung." };
  return annehmenUndWeiter(v.data, c.data);
}

const registrierung = z.object({
  verein: slugSchema,
  code,
  name: z.string().trim().min(2, "Bitte gib deinen Namen ein.").max(120),
  email: z.email("Bitte gib eine gültige E-Mail-Adresse ein."),
  passwort: z.string().min(10, "Das Passwort braucht mindestens 10 Zeichen."),
});

/** Neues Konto anlegen und Einladung annehmen. */
export async function registrieren(
  _: EinladungZustand,
  formData: FormData,
): Promise<EinladungZustand> {
  const roh = Object.fromEntries(formData);
  const vorher = { name: String(roh.name ?? ""), email: String(roh.email ?? "") };
  const daten = registrierung.safeParse(roh);
  if (!daten.success) {
    return { ...vorher, fehler: daten.error.issues[0]?.message ?? "Bitte Eingaben prüfen." };
  }
  const { verein, code: einladungscode, name, email, passwort } = daten.data;

  const basis = await vereinsBasis(verein);
  const zurueck = `${basis}/einladung?code=${einladungscode}`;
  const callback = new URL("/auth/callback", await aktuelleOrigin());
  callback.searchParams.set("weiter", zurueck);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: passwort,
    options: { data: { name }, emailRedirectTo: callback.toString() },
  });

  if (error) {
    const text =
      error.code === "user_already_exists"
        ? "Für diese E-Mail gibt es schon ein Konto. Melde dich an und nimm die Einladung danach an."
        : error.code === "weak_password"
          ? "Dieses Passwort ist zu schwach. Bitte wähle ein längeres."
          : "Registrierung fehlgeschlagen. Bitte versuch es nochmals.";
    return { ...vorher, fehler: text };
  }

  // E-Mail-Bestätigung aktiv: erst nach Klick auf den Link geht es weiter.
  if (!data.session) return { bestaetigen: email };

  return annehmenUndWeiter(verein, einladungscode);
}
