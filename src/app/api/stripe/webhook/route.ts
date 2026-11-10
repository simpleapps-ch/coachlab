import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, stripeKonfiguriert } from "@/lib/stripe/client";
import { ereignisVerarbeiten } from "@/lib/stripe/webhook";

export const dynamic = "force-dynamic";

/**
 * Stripe-Webhook (CLAUDE.md, Regel 6): jede Nachricht signaturgeprüft, jedes Ereignis
 * genau einmal verarbeitet (Tabelle stripe_events). Der Proxy lässt /api/stripe aus.
 */
export async function POST(request: Request) {
  const geheimnis = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKonfiguriert() || !geheimnis) {
    return Response.json({ fehler: "Stripe ist nicht konfiguriert" }, { status: 503 });
  }

  const signatur = request.headers.get("stripe-signature");
  if (!signatur) return Response.json({ fehler: "Signatur fehlt" }, { status: 400 });

  const roh = await request.text();
  let event;
  try {
    event = await stripe().webhooks.constructEventAsync(roh, signatur, geheimnis);
  } catch {
    return Response.json({ fehler: "Signatur ungültig" }, { status: 400 });
  }

  try {
    const r = await ereignisVerarbeiten({ stripe: stripe(), db: createAdminClient() }, event);
    return Response.json({ erhalten: true, ...r });
  } catch (fehler) {
    console.error(`[stripe] ${event.type} ${event.id} fehlgeschlagen:`, fehler);
    // 500: Stripe versucht es später erneut.
    return Response.json({ fehler: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }
}
