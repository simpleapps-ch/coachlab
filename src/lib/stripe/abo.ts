import type Stripe from "stripe";

/**
 * Reine Abbildung zwischen Stripe und der Tabelle tenants (ohne Netzwerk, getestet).
 */

export const PREIS_LOOKUP = { monat: "coachlab_verein_monat", jahr: "coachlab_verein_jahr" } as const;
export type BezahlterPlan = keyof typeof PREIS_LOOKUP;

export const TESTPHASE_TAGE = 14;

/** Kennzeichnet Checkout-Sessions von Coachlab im Stripe-Dashboard. */
export const INTEGRATION_ID = "coachlab_abo_qwhmzrtk";

export type AboStatus = "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete";

export type AboFelder = {
  stripe_subscription_id: string;
  abo_status: AboStatus;
  plan: BezahlterPlan | null;
  trial_ende: string | null;
  abo_periode_ende: string | null;
  abo_gekuendigt: boolean;
};

const STATUS: Record<Stripe.Subscription.Status, AboStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  paused: "unpaid",
};

const zeit = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);

export function planAusLookup(lookup: string | null | undefined): BezahlterPlan | null {
  for (const [plan, key] of Object.entries(PREIS_LOOKUP)) if (key === lookup) return plan as BezahlterPlan;
  return null;
}

export function aboAusSubscription(sub: Stripe.Subscription): AboFelder {
  const item = sub.items.data[0];
  return {
    stripe_subscription_id: sub.id,
    abo_status: STATUS[sub.status] ?? "incomplete",
    plan: planAusLookup(item?.price.lookup_key),
    trial_ende: zeit(sub.trial_end),
    abo_periode_ende: zeit(item?.current_period_end),
    abo_gekuendigt: sub.cancel_at_period_end || sub.cancel_at !== null,
  };
}

const BEENDET = new Set<AboStatus>(["canceled"]);

/**
 * Gehört ein Ereignis zum aktuellen Abo des Vereins? Ein Verein hat höchstens ein Abo.
 * Ein neues Abo ersetzt das gespeicherte nur, wenn das alte beendet ist oder keines da ist;
 * Nachzügler-Ereignisse eines alten, gekündigten Abos überschreiben nie das neue.
 */
export function istAktuellesAbo(
  gespeichert: { stripe_subscription_id: string | null; abo_status: string },
  neu: AboFelder,
): boolean {
  if (!gespeichert.stripe_subscription_id) return true;
  if (gespeichert.stripe_subscription_id === neu.stripe_subscription_id) return true;
  return BEENDET.has(gespeichert.abo_status as AboStatus) && !BEENDET.has(neu.abo_status);
}

/** Zugriff wie private.abo_aktiv in der Datenbank. */
export const aboErlaubtZugriff = (status: string) => ["trialing", "active", "past_due"].includes(status);
