import type Stripe from "stripe";
import { aboSynchronisieren, vereinZuKunde, type Abhaengigkeiten } from "./sync";

/**
 * Verarbeitung der Stripe-Ereignisse (CLAUDE.md, Regel 6: signaturgeprüft und idempotent).
 * Die Signatur prüft die Route; hier geht es um Idempotenz und Inhalt.
 *
 * Abonnierte Ereignisse (im Stripe-Dashboard beim Webhook-Endpunkt eintragen):
 */
export const EREIGNISSE = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.dispute.created",
  "charge.refunded",
  "radar.early_fraud_warning.created",
] as const;

export type Verarbeitung = { art: "verarbeitet" | "doppelt" | "ignoriert"; tenantId?: string; notiz?: string };

const id = (x: string | { id: string } | null | undefined) => (x ? (typeof x === "string" ? x : x.id) : null);

/** Welches Abo betrifft das Ereignis? null = kein Abo-Ereignis. */
function subscriptionAus(event: Stripe.Event): string | null {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      return s.mode === "subscription" ? id(s.subscription) : null;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return event.data.object.id;
    case "invoice.paid":
    case "invoice.payment_failed": {
      const inv = event.data.object;
      return id(inv.parent?.subscription_details?.subscription ?? null);
    }
    default:
      return null;
  }
}

/** Kunde bei Rückerstattung, Streitfall oder Betrugswarnung (über die Zahlung). */
async function kundeBeiRisiko(d: Abhaengigkeiten, event: Stripe.Event): Promise<string | null> {
  switch (event.type) {
    case "charge.refunded":
      return id(event.data.object.customer);
    case "charge.dispute.created": {
      const charge = await d.stripe.charges.retrieve(id(event.data.object.charge)!);
      return id(charge.customer);
    }
    case "radar.early_fraud_warning.created": {
      const charge = await d.stripe.charges.retrieve(id(event.data.object.charge)!);
      return id(charge.customer);
    }
    default:
      return null;
  }
}

export async function ereignisVerarbeiten(d: Abhaengigkeiten, event: Stripe.Event): Promise<Verarbeitung> {
  if (!event.id.startsWith("evt_")) throw new Error("Ungültige Ereignis-ID");

  // Idempotenz: Jedes Ereignis wird genau einmal verarbeitet. Schlägt die Verarbeitung
  // fehl, wird der Eintrag wieder entfernt, damit Stripe es erneut schicken kann.
  const { data: neu, error: e1 } = await d.db
    .from("stripe_events")
    .upsert({ id: event.id, typ: event.type }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (e1) throw new Error(`stripe_events: ${e1.message}`);
  if (!neu?.length) return { art: "doppelt" };

  try {
    const ergebnis = await verarbeiten(d, event);
    if (ergebnis.tenantId) {
      await d.db.from("stripe_events").update({ tenant_id: ergebnis.tenantId }).eq("id", event.id);
    }
    return ergebnis;
  } catch (fehler) {
    await d.db.from("stripe_events").delete().eq("id", event.id);
    throw fehler;
  }
}

async function verarbeiten(d: Abhaengigkeiten, event: Stripe.Event): Promise<Verarbeitung> {
  const sub = subscriptionAus(event);
  if (sub) {
    const r = await aboSynchronisieren(d, sub);
    return r.art === "aktualisiert"
      ? { art: "verarbeitet", tenantId: r.tenantId, notiz: r.status }
      : { art: "ignoriert", tenantId: r.tenantId, notiz: r.grund };
  }

  if (event.type === "charge.dispute.created" || event.type === "charge.refunded" || event.type === "radar.early_fraud_warning.created") {
    const kunde = await kundeBeiRisiko(d, event);
    const verein = kunde ? await vereinZuKunde(d.db, kunde) : null;
    // Stripe meldet Streitfälle und Betrugswarnungen zusätzlich per E-Mail an die Konto-Admins.
    // Hier nur protokollieren und dem Verein zuordnen; das Abo selbst steuert Stripe.
    console.warn(`[stripe] ${event.type} für Verein ${verein?.slug ?? "unbekannt"} (${event.id})`);
    return { art: "verarbeitet", tenantId: verein?.id, notiz: "protokolliert" };
  }

  return { art: "ignoriert", notiz: `nicht abonniert: ${event.type}` };
}
