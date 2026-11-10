import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { aboErlaubtZugriff, INTEGRATION_ID, PREIS_LOOKUP, TESTPHASE_TAGE, type BezahlterPlan } from "./abo";
import { stripe } from "./client";
import { aboSynchronisieren } from "./sync";

/**
 * Checkout und Kundenportal. Aufrufer prüfen vorher, dass die Person den Verein verwalten
 * darf (nurVerwalter bzw. verein_registrieren). Abo-Felder schreibt nur der Server.
 */

type Verein = {
  id: string;
  name: string;
  slug: string;
  plan: string | null;
  abo_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ende: string | null;
};

async function ladeVerein(tenantId: string): Promise<Verein> {
  const { data, error } = await createAdminClient()
    .from("tenants")
    .select("id, name, slug, plan, abo_status, stripe_customer_id, stripe_subscription_id, trial_ende")
    .eq("id", tenantId)
    .single();
  if (error || !data) throw new Error(`Verein nicht gefunden: ${error?.message ?? tenantId}`);
  return data as Verein;
}

export type CheckoutErgebnis = { url: string } | { fehler: string };

/** Stripe-Kunde des Vereins (einmal angelegt, dann über tenants.stripe_customer_id zugeordnet). */
async function kundeSicherstellen(v: Verein, email: string): Promise<string> {
  if (v.stripe_customer_id) return v.stripe_customer_id;
  const kunde = await stripe().customers.create(
    { name: v.name, email, metadata: { tenant_id: v.id, verein: v.slug } },
    { idempotencyKey: `coachlab-kunde-${v.id}` },
  );
  const { error } = await createAdminClient()
    .from("tenants")
    .update({ stripe_customer_id: kunde.id })
    .eq("id", v.id)
    .is("stripe_customer_id", null);
  if (error) throw new Error(`Kunde nicht gespeichert: ${error.message}`);
  return kunde.id;
}

export async function checkoutStarten(p: {
  tenantId: string;
  email: string;
  plan: BezahlterPlan;
  /** Absolute Adresse der Vereinsseiten: https://zug94.coachlab.com oder https://…/zug94 */
  vereinsUrl: string;
  /** Absolute Adresse für den Abbruch, z. B. …/registrieren oder …/admin/abo */
  abbruchUrl: string;
}): Promise<CheckoutErgebnis> {
  const v = await ladeVerein(p.tenantId);
  if (v.plan === "gratis") return { fehler: "Dieser Verein nutzt Coachlab gratis und braucht kein Abo." };
  if (v.stripe_subscription_id && aboErlaubtZugriff(v.abo_status)) {
    return { fehler: "Der Verein hat bereits ein Abo. Änderungen gehen über «Abo verwalten»." };
  }

  const kunde = await kundeSicherstellen(v, p.email);
  const preise = await stripe().prices.list({ lookup_keys: [PREIS_LOOKUP[p.plan]], active: true, limit: 1 });
  const preis = preise.data[0];
  if (!preis) throw new Error(`Preis ${PREIS_LOOKUP[p.plan]} fehlt in Stripe.`);

  // Testphase nur beim ersten Abo eines Vereins.
  const testphase = !v.stripe_subscription_id && !v.trial_ende;

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: kunde,
    client_reference_id: v.id,
    line_items: [{ price: preis.id, quantity: 1 }],
    subscription_data: {
      ...(testphase ? { trial_period_days: TESTPHASE_TAGE } : {}),
      metadata: { tenant_id: v.id, verein: v.slug },
    },
    billing_address_collection: "required",
    customer_update: { name: "auto", address: "auto" },
    locale: "de",
    integration_identifier: INTEGRATION_ID,
    success_url: `${p.vereinsUrl}/admin/abo?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: p.abbruchUrl,
  });
  if (!session.url) throw new Error("Stripe hat keine Checkout-Adresse geliefert.");
  return { url: session.url };
}

/** Kundenportal: Zahlungsmittel, Rechnungen, Planwechsel, Kündigung. */
export async function portalOeffnen(tenantId: string, rueckweg: string): Promise<CheckoutErgebnis> {
  const v = await ladeVerein(tenantId);
  if (!v.stripe_customer_id) return { fehler: "Für diesen Verein gibt es noch kein Abo." };
  const s = await stripe().billingPortal.sessions.create({ customer: v.stripe_customer_id, return_url: rueckweg, locale: "de" });
  return { url: s.url };
}

/**
 * Nach der Rückkehr aus dem Checkout sofort abgleichen, damit die Seite den neuen Status
 * zeigt, auch wenn der Webhook noch unterwegs ist. Gleiche Funktion wie im Webhook.
 */
export async function nachCheckoutAbgleichen(tenantId: string, sessionId: string): Promise<void> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return;
  const s = await stripe().checkout.sessions.retrieve(sessionId);
  if (s.client_reference_id !== tenantId || !s.subscription) return;
  const sub = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
  await aboSynchronisieren({ stripe: stripe(), db: createAdminClient() }, sub);
}
