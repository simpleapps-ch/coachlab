"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { bezahlterPlan, slug as slugSchema, vereinRegistrieren } from "@/lib/schema";
import { checkoutStarten } from "@/lib/stripe/checkout";
import { createClient } from "@/lib/supabase/server";
import { aktuelleOrigin } from "@/lib/verein";

export type Zustand = { fehler?: string; bestaetigen?: string; werte?: Record<string, string> };

const werteAus = (fd: FormData, felder: string[]) =>
  Object.fromEntries(felder.map((f) => [f, String(fd.get(f) ?? "")]));

const konto = z.object({
  name: z.string().trim().min(2, "Bitte gib deinen Namen ein.").max(120),
  email: z.email("Bitte gib eine gültige E-Mail-Adresse ein."),
  passwort: z.string().min(10, "Das Passwort braucht mindestens 10 Zeichen."),
});

/** Schritt 1: Konto für die Technische Leitung anlegen. */
export async function kontoAnlegen(_: Zustand, fd: FormData): Promise<Zustand> {
  const werte = werteAus(fd, ["name", "email"]);
  const d = konto.safeParse(Object.fromEntries(fd));
  if (!d.success) return { fehler: d.error.issues[0]?.message, werte };

  const callback = new URL("/auth/callback", await aktuelleOrigin());
  callback.searchParams.set("weiter", "/registrieren");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: d.data.email,
    password: d.data.passwort,
    options: { data: { name: d.data.name }, emailRedirectTo: callback.toString() },
  });
  if (error) {
    return {
      werte,
      fehler:
        error.code === "user_already_exists"
          ? "Für diese E-Mail gibt es schon ein Konto. Bitte melde dich unten an."
          : error.code === "weak_password"
            ? "Dieses Passwort ist zu schwach. Bitte wähle ein längeres."
            : "Registrierung fehlgeschlagen. Bitte versuch es nochmals.",
    };
  }
  if (!data.session) return { bestaetigen: d.data.email };
  redirect("/registrieren");
}

/** Schritt 1 (bestehendes Konto): anmelden. */
export async function anmelden(_: Zustand, fd: FormData): Promise<Zustand> {
  const werte = werteAus(fd, ["email"]);
  const d = z.object({ email: z.email(), passwort: z.string().min(1) }).safeParse(Object.fromEntries(fd));
  if (!d.success) return { fehler: "Bitte E-Mail und Passwort eingeben.", werte };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: d.data.email, password: d.data.passwort });
  if (error) {
    return {
      werte,
      fehler:
        error.code === "email_not_confirmed"
          ? "Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungs-E-Mail."
          : "E-Mail oder Passwort stimmt nicht.",
    };
  }
  redirect("/registrieren");
}

/** Schritt 2: Verein anlegen und zur Zahlung (Stripe Checkout, 14 Tage Testphase). */
export async function vereinAnlegen(_: Zustand, fd: FormData): Promise<Zustand> {
  const werte = werteAus(fd, ["name", "slug", "plan"]);
  const d = vereinRegistrieren.safeParse({
    name: fd.get("name"),
    slug: String(fd.get("slug") ?? "").trim().toLowerCase(),
    plan: bezahlterPlan.catch("monat").parse(fd.get("plan")),
  });
  if (!d.success) return { fehler: d.error.issues[0]?.message ?? "Bitte Eingaben prüfen.", werte };

  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  const email = (c?.claims?.email as string | undefined) ?? "";
  if (!c?.claims?.sub) redirect("/registrieren");

  const { data, error } = await supabase.rpc("verein_registrieren", { p_name: d.data.name, p_slug: d.data.slug });
  if (error) {
    const text = /tenants_slug_key|tenants_slug_nicht_reserviert/.test(error.message)
      ? "Diese Adresse ist schon vergeben. Bitte wähle eine andere."
      : "Der Verein konnte nicht angelegt werden. Bitte versuch es nochmals.";
    return { fehler: text, werte };
  }
  const verein = (data as Array<{ id: string; slug: string }>)[0];

  const origin = await aktuelleOrigin();
  let ziel: string;
  try {
    const r = await checkoutStarten({
      tenantId: verein.id,
      email,
      plan: d.data.plan,
      vereinsUrl: `${origin}/${verein.slug}`,
      abbruchUrl: `${origin}/registrieren?abbruch=1`,
    });
    if ("fehler" in r) return { fehler: r.fehler, werte };
    ziel = r.url;
  } catch (e) {
    console.error("[stripe] Checkout bei Registrierung", e);
    return { fehler: "Die Zahlung konnte nicht gestartet werden. Bitte versuch es in einem Moment nochmals.", werte };
  }
  redirect(ziel);
}

/** Ist eine Vereinsadresse frei? Für die Anzeige im Formular. */
export async function slugPruefen(roh: string): Promise<"frei" | "vergeben" | "ungueltig"> {
  const s = slugSchema.safeParse(roh.trim().toLowerCase());
  if (!s.success) return "ungueltig";
  const supabase = await createClient();
  const { data } = await supabase.rpc("slug_frei", { p_slug: s.data });
  return data ? "frei" : "vergeben";
}
