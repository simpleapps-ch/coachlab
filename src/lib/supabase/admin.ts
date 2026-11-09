import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Service-Role-Client: umgeht Row Level Security.
 * NUR für Stripe-Webhooks und Wartungsaufgaben verwenden – nie im Browser,
 * nie für normale Seitenabfragen (CLAUDE.md, Regel 5).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error("SUPABASE_SECRET_KEY oder NEXT_PUBLIC_SUPABASE_URL fehlt.");
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
