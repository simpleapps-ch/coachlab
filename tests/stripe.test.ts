import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aboAusSubscription, istAktuellesAbo, planAusLookup, type AboFelder } from "@/lib/stripe/abo";
import { ereignisVerarbeiten } from "@/lib/stripe/webhook";

vi.mock("server-only", () => ({}));

const T = 1_800_000_000; // Sekunden

function abo(teil: Partial<Stripe.Subscription> & { lookup?: string; ende?: number } = {}): Stripe.Subscription {
  const { lookup = "coachlab_verein_monat", ende = T + 30 * 86400, ...rest } = teil;
  return {
    id: "sub_1",
    object: "subscription",
    customer: "cus_1",
    status: "trialing",
    trial_end: T,
    cancel_at_period_end: false,
    cancel_at: null,
    items: { object: "list", data: [{ price: { lookup_key: lookup }, current_period_end: ende }] },
    ...rest,
  } as unknown as Stripe.Subscription;
}

describe("Stripe-Abo abbilden", () => {
  it("übernimmt Status, Plan, Testphase und Periodenende", () => {
    expect(aboAusSubscription(abo())).toEqual({
      stripe_subscription_id: "sub_1",
      abo_status: "trialing",
      plan: "monat",
      trial_ende: new Date(T * 1000).toISOString(),
      abo_periode_ende: new Date((T + 30 * 86400) * 1000).toISOString(),
      abo_gekuendigt: false,
    });
    expect(aboAusSubscription(abo({ lookup: "coachlab_verein_jahr", status: "active" })).plan).toBe("jahr");
  });

  it("abgelaufene und pausierte Abos geben keinen Zugriff", () => {
    expect(aboAusSubscription(abo({ status: "incomplete_expired" })).abo_status).toBe("canceled");
    expect(aboAusSubscription(abo({ status: "paused" })).abo_status).toBe("unpaid");
  });

  it("Kündigung auf Periodenende wird erkannt", () => {
    expect(aboAusSubscription(abo({ cancel_at_period_end: true })).abo_gekuendigt).toBe(true);
    expect(aboAusSubscription(abo({ cancel_at: T + 99 })).abo_gekuendigt).toBe(true);
  });

  it("unbekannte Preise ergeben keinen Plan", () => {
    expect(planAusLookup("anderes_produkt")).toBeNull();
    expect(planAusLookup(null)).toBeNull();
  });

  it("ein altes, gekündigtes Abo überschreibt nie das neue", () => {
    const neu = (id: string, s: AboFelder["abo_status"]) => ({ ...aboAusSubscription(abo()), stripe_subscription_id: id, abo_status: s });
    expect(istAktuellesAbo({ stripe_subscription_id: null, abo_status: "incomplete" }, neu("sub_1", "trialing"))).toBe(true);
    expect(istAktuellesAbo({ stripe_subscription_id: "sub_1", abo_status: "active" }, neu("sub_1", "canceled"))).toBe(true);
    expect(istAktuellesAbo({ stripe_subscription_id: "sub_2", abo_status: "active" }, neu("sub_1", "canceled"))).toBe(false);
    expect(istAktuellesAbo({ stripe_subscription_id: "sub_1", abo_status: "canceled" }, neu("sub_2", "trialing"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Webhook-Verarbeitung mit Attrappen für Stripe und Datenbank
// ---------------------------------------------------------------------------

type Verein = { id: string; slug: string; plan: string | null; abo_status: string; stripe_subscription_id: string | null; stripe_customer_id: string };

function attrappen(vereine: Verein[], sub = abo()) {
  const events = new Set<string>();
  const updates: Array<{ tabelle: string; werte: Record<string, unknown>; wo: [string, unknown][] }> = [];
  const loeschungen: string[] = [];

  const db = {
    from(tabelle: string) {
      const wo: [string, unknown][] = [];
      let modus: "select" | "update" | "upsert" | "delete" = "select";
      let werte: Record<string, unknown> = {};
      const kette = {
        select: () => kette,
        eq: (k: string, v: unknown) => (wo.push([k, v]), kette),
        upsert: (w: { id: string }) => ((modus = "upsert"), (werte = w), kette),
        update: (w: Record<string, unknown>) => ((modus = "update"), (werte = w), kette),
        delete: () => ((modus = "delete"), kette),
        maybeSingle: async () => {
          const [k, v] = wo[0];
          return { data: vereine.find((x) => (x as Record<string, unknown>)[k] === v) ?? null, error: null };
        },
        then(ok: (r: unknown) => void) {
          if (modus === "upsert") {
            const id = werte.id as string;
            const neu = !events.has(id);
            events.add(id);
            return ok({ data: neu ? [{ id }] : [], error: null });
          }
          if (modus === "update") updates.push({ tabelle, werte, wo });
          if (modus === "delete") {
            loeschungen.push(wo[0][1] as string);
            events.delete(wo[0][1] as string);
          }
          return ok({ data: null, error: null });
        },
      };
      return kette;
    },
  } as unknown as SupabaseClient;

  const stripe = {
    subscriptions: { retrieve: vi.fn(async () => sub) },
    charges: { retrieve: vi.fn(async () => ({ customer: "cus_1" })) },
  } as unknown as Stripe;

  return { d: { stripe, db }, updates, loeschungen, events };
}

const ereignis = (type: string, object: object, id = "evt_1") => ({ id, type, data: { object } }) as unknown as Stripe.Event;

const VEREIN: Verein = { id: "t1", slug: "fc-neu", plan: null, abo_status: "incomplete", stripe_subscription_id: null, stripe_customer_id: "cus_1" };

describe("Stripe-Webhook verarbeiten", () => {
  let a: ReturnType<typeof attrappen>;
  beforeEach(() => {
    a = attrappen([{ ...VEREIN }]);
  });

  it("Checkout abgeschlossen: Abo wird beim Verein gespeichert", async () => {
    const r = await ereignisVerarbeiten(a.d, ereignis("checkout.session.completed", { mode: "subscription", subscription: "sub_1" }));
    expect(r).toMatchObject({ art: "verarbeitet", tenantId: "t1", notiz: "trialing" });
    const u = a.updates.find((x) => x.tabelle === "tenants")!;
    expect(u.werte).toMatchObject({ abo_status: "trialing", plan: "monat", stripe_subscription_id: "sub_1" });
    expect(u.wo).toEqual([["id", "t1"]]);
  });

  it("dasselbe Ereignis zweimal wird nur einmal verarbeitet", async () => {
    const e = ereignis("customer.subscription.updated", { id: "sub_1" });
    await ereignisVerarbeiten(a.d, e);
    expect(await ereignisVerarbeiten(a.d, e)).toEqual({ art: "doppelt" });
    expect(a.updates.filter((x) => x.tabelle === "tenants")).toHaveLength(1);
  });

  it("Rechnung bezahlt oder fehlgeschlagen: Abo über die Rechnung finden", async () => {
    await ereignisVerarbeiten(
      a.d,
      ereignis("invoice.payment_failed", { parent: { subscription_details: { subscription: "sub_1" } } }),
    );
    expect(a.d.stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
  });

  it("Gratis-Vereine werden nie verändert", async () => {
    const g = attrappen([{ ...VEREIN, plan: "gratis", abo_status: "active" }]);
    const r = await ereignisVerarbeiten(g.d, ereignis("customer.subscription.updated", { id: "sub_1" }));
    expect(r).toMatchObject({ art: "ignoriert", notiz: "Tarif gratis" });
    expect(g.updates.filter((x) => x.tabelle === "tenants")).toHaveLength(0);
  });

  it("Fehler bei der Verarbeitung: Ereignis wird freigegeben, damit Stripe es nochmals schickt", async () => {
    (a.d.stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Netz"));
    await expect(ereignisVerarbeiten(a.d, ereignis("customer.subscription.updated", { id: "sub_1" }, "evt_9"))).rejects.toThrow("Netz");
    expect(a.loeschungen).toEqual(["evt_9"]);
    expect(await ereignisVerarbeiten(a.d, ereignis("customer.subscription.updated", { id: "sub_1" }, "evt_9"))).toMatchObject({
      art: "verarbeitet",
    });
  });

  it("Streitfall wird dem Verein zugeordnet und protokolliert", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await ereignisVerarbeiten(a.d, ereignis("charge.dispute.created", { charge: "ch_1" }));
    expect(r).toMatchObject({ art: "verarbeitet", tenantId: "t1" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("fc-neu"));
    warn.mockRestore();
  });

  it("nicht abonnierte Ereignisse werden ignoriert", async () => {
    expect(await ereignisVerarbeiten(a.d, ereignis("customer.created", { id: "cus_1" }))).toMatchObject({ art: "ignoriert" });
  });
});

describe("Stripe-Signatur", () => {
  it("nur korrekt signierte Nachrichten werden akzeptiert", async () => {
    const s = new Stripe("sk_test_dummy");
    const geheim = "whsec_test";
    const roh = JSON.stringify({ id: "evt_1", object: "event", type: "invoice.paid", data: { object: {} } });
    const header = await s.webhooks.generateTestHeaderStringAsync({ payload: roh, secret: geheim });
    await expect(s.webhooks.constructEventAsync(roh, header, geheim)).resolves.toMatchObject({ id: "evt_1" });
    await expect(s.webhooks.constructEventAsync(roh.replace("evt_1", "evt_2"), header, geheim)).rejects.toThrow();
    await expect(s.webhooks.constructEventAsync(roh, header, "whsec_falsch")).rejects.toThrow();
  });
});
