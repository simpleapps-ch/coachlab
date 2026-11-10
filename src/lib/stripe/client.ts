import "server-only";

import Stripe from "stripe";

/**
 * Stripe-Client für den Server. Der Secret Key (bzw. ein eingeschränkter Key rk_…)
 * liegt nur in Netlify (STRIPE_SECRET_KEY), nie im Browser und nie im Repo.
 */
let client: Stripe | null = null;

export function stripeKonfiguriert(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt.");
  if (key.startsWith("pk_")) throw new Error("STRIPE_SECRET_KEY enthält einen Publishable Key (pk_…).");
  client ??= new Stripe(key, {
    appInfo: { name: "Coachlab", url: "https://coachlab.com" },
    maxNetworkRetries: 2,
  });
  return client;
}
