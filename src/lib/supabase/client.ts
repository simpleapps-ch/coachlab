"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabasePruefen } from "./env";

/** Supabase-Client für Client-Komponenten. Arbeitet immer mit RLS. */
export function createClient() {
  supabasePruefen();
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
