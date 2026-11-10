"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { autorisierungsId } from "./anfrage";


const zurueck = (id: string) => `/oauth/zustimmung?authorization_id=${encodeURIComponent(id)}`;

export type AnmeldeZustand = { fehler?: string; email?: string };

const anmeldung = z.object({
  authorization_id: autorisierungsId,
  email: z.email(),
  passwort: z.string().min(1),
});

export async function oauthAnmelden(_: AnmeldeZustand, formData: FormData): Promise<AnmeldeZustand> {
  const email = String(formData.get("email") ?? "");
  const daten = anmeldung.safeParse(Object.fromEntries(formData));
  if (!daten.success) return { fehler: "Bitte E-Mail und Passwort eingeben.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: daten.data.email,
    password: daten.data.passwort,
  });
  if (error) {
    return {
      fehler:
        error.code === "email_not_confirmed"
          ? "Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungs-E-Mail."
          : "E-Mail oder Passwort stimmt nicht.",
      email,
    };
  }
  redirect(zurueck(daten.data.authorization_id));
}

export async function oauthAbmelden(formData: FormData) {
  const id = autorisierungsId.safeParse(formData.get("authorization_id"));
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(id.success ? zurueck(id.data) : "/");
}

/** Erlauben oder ablehnen; Supabase liefert die Adresse zurück zu Claude. */
export async function oauthEntscheiden(formData: FormData) {
  const id = autorisierungsId.safeParse(formData.get("authorization_id"));
  if (!id.success) redirect("/oauth/zustimmung?fehler=anfrage");
  const supabase = await createClient();
  const { data, error } =
    formData.get("entscheid") === "erlauben"
      ? await supabase.auth.oauth.approveAuthorization(id.data)
      : await supabase.auth.oauth.denyAuthorization(id.data);
  if (error || !data?.redirect_url) {
    redirect(`${zurueck(id.data)}&fehler=entscheid`);
  }
  redirect(data.redirect_url);
}
