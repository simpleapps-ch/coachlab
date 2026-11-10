"use server";

import { redirect } from "next/navigation";
import { slug as slugSchema, bezahlterPlan } from "@/lib/schema";
import { checkoutStarten, portalOeffnen } from "@/lib/stripe/checkout";
import { aktuelleOrigin, nurVerwalter, vereinsBasis } from "@/lib/verein";

/** Abo abschliessen (nach Abbruch, Ablauf oder Kündigung). Nur Technische Leitung und Admins. */
export async function aboAbschliessen(formData: FormData) {
  const slug = slugSchema.parse(formData.get("verein"));
  const plan = bezahlterPlan.catch("monat").parse(formData.get("plan"));
  const z = await nurVerwalter(slug);
  const basis = await vereinsBasis(slug);
  const r = await checkoutStarten({
    tenantId: z.verein.id,
    email: z.benutzer.email ?? "",
    plan,
    vereinsUrl: `${await aktuelleOrigin()}${basis}`,
    abbruchUrl: `${await aktuelleOrigin()}${basis}/admin/abo`,
  });
  if ("fehler" in r) redirect(`${basis}/admin/abo?fehler=${encodeURIComponent(r.fehler)}`);
  redirect(r.url);
}

/** Stripe-Kundenportal öffnen. */
export async function aboVerwalten(formData: FormData) {
  const slug = slugSchema.parse(formData.get("verein"));
  const z = await nurVerwalter(slug);
  const basis = await vereinsBasis(slug);
  const r = await portalOeffnen(z.verein.id, `${await aktuelleOrigin()}${basis}/admin/abo`);
  if ("fehler" in r) redirect(`${basis}/admin/abo?fehler=${encodeURIComponent(r.fehler)}`);
  redirect(r.url);
}
