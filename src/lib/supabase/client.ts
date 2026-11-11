"use client";

import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabasePruefen } from "./env";
import { alsSitzungsCookie } from "./sitzungs-cookie";

/** Supabase-Client für Client-Komponenten. Arbeitet immer mit RLS. */
export function createClient() {
  supabasePruefen();
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    // Wie die Standard-Cookies der Bibliothek, aber als Sitzungs-Cookies (siehe sitzungs-cookie.ts)
    cookies: {
      getAll() {
        return parseCookieHeader(document.cookie).map(({ name, value }) => ({ name, value: value ?? "" }));
      },
      setAll(liste) {
        for (const { name, value, options } of liste) {
          document.cookie = serializeCookieHeader(name, value, alsSitzungsCookie(options));
        }
      },
    },
  });
}
