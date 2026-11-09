"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sichererPfad } from "@/lib/pfad";
import { slug as slugSchema } from "@/lib/schema";
import { createClient } from "@/lib/supabase/server";
import { vereinsBasis } from "@/lib/verein";

export type LoginZustand = { fehler?: string; email?: string };

const eingabe = z.object({
  verein: slugSchema,
  email: z.email(),
  passwort: z.string().min(1),
  weiter: z.string().optional(),
});

export async function anmelden(_: LoginZustand, formData: FormData): Promise<LoginZustand> {
  const daten = eingabe.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!daten.success) return { fehler: "Bitte E-Mail und Passwort eingeben.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: daten.data.email,
    password: daten.data.passwort,
  });
  if (error) {
    const text =
      error.code === "email_not_confirmed"
        ? "Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungs-E-Mail."
        : "E-Mail oder Passwort stimmt nicht.";
    return { fehler: text, email };
  }

  const basis = await vereinsBasis(daten.data.verein);
  redirect(sichererPfad(daten.data.weiter, `${basis}/`));
}
