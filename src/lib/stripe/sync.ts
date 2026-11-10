import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { aboAusSubscription, istAktuellesAbo } from "./abo";

/**
 * Abo-Status aus Stripe in die Tabelle tenants übernehmen.
 * Holt das Abo immer frisch bei Stripe: Die Reihenfolge der Webhook-Ereignisse spielt
 * so keine Rolle, und mehrfaches Ausführen ergibt dasselbe (idempotent).
 * db ist der Service-Role-Client (Abo-Felder darf kein Benutzer schreiben).
 */

export type Abhaengigkeiten = { stripe: Stripe; db: SupabaseClient };

type VereinZeile = {
  id: string;
  slug: string;
  plan: string | null;
  abo_status: string;
  stripe_subscription_id: string | null;
};

export type SyncErgebnis =
  | { art: "aktualisiert"; tenantId: string; status: string }
  | { art: "uebersprungen"; tenantId?: string; grund: string };

const SPALTEN = "id, slug, plan, abo_status, stripe_subscription_id";

/** Verein zu einem Stripe-Kunden (Zuordnung über tenants.stripe_customer_id). */
export async function vereinZuKunde(db: SupabaseClient, kunde: string): Promise<VereinZeile | null> {
  const { data, error } = await db.from("tenants").select(SPALTEN).eq("stripe_customer_id", kunde).maybeSingle();
  if (error) throw new Error(`Verein zu Kunde ${kunde}: ${error.message}`);
  return (data as VereinZeile | null) ?? null;
}

const kundenId = (c: string | Stripe.Customer | Stripe.DeletedCustomer) => (typeof c === "string" ? c : c.id);

export async function aboSynchronisieren(d: Abhaengigkeiten, subscriptionId: string): Promise<SyncErgebnis> {
  const sub = await d.stripe.subscriptions.retrieve(subscriptionId);
  const verein = await vereinZuKunde(d.db, kundenId(sub.customer));
  if (!verein) return { art: "uebersprungen", grund: `kein Verein für Kunde ${kundenId(sub.customer)}` };
  // Unverhandelbar: Gratis-Vereine werden nie abgerechnet und nie verändert.
  if (verein.plan === "gratis") return { art: "uebersprungen", tenantId: verein.id, grund: "Tarif gratis" };

  const felder = aboAusSubscription(sub);
  if (!istAktuellesAbo(verein, felder)) {
    return { art: "uebersprungen", tenantId: verein.id, grund: `altes Abo ${sub.id}` };
  }

  const { error } = await d.db
    .from("tenants")
    .update({ ...felder, plan: felder.plan ?? verein.plan })
    .eq("id", verein.id); // zusätzlich schützt der Constraint tenants_gratis_ohne_stripe
  if (error) throw new Error(`Abo von ${verein.slug} nicht gespeichert: ${error.message}`);
  return { art: "aktualisiert", tenantId: verein.id, status: felder.abo_status };
}
