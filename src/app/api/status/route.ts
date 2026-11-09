import { NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseProbleme } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/**
 * Betriebsstatus für die Fehlersuche. Zeigt nur öffentliche Werte und ob geheime
 * Werte gesetzt sind, nie deren Inhalt.
 */
export async function GET() {
  const probleme = supabaseProbleme();

  let supabaseErreichbar: number | string = "nicht geprüft";
  if (probleme.length === 0) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      supabaseErreichbar = r.status;
    } catch (e) {
      supabaseErreichbar = `Fehler: ${e instanceof Error ? e.message : "unbekannt"}`;
    }
  }

  return NextResponse.json(
    {
      ok: probleme.length === 0 && supabaseErreichbar === 200,
      probleme,
      supabase_url: SUPABASE_URL || null,
      publishable_key: SUPABASE_PUBLISHABLE_KEY
        ? `${SUPABASE_PUBLISHABLE_KEY.slice(0, 15)}… (${SUPABASE_PUBLISHABLE_KEY.length} Zeichen)`
        : null,
      secret_key_gesetzt: Boolean(process.env.SUPABASE_SECRET_KEY),
      root_domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? null,
      supabase_erreichbar: supabaseErreichbar,
      commit: process.env.COMMIT_REF?.slice(0, 7) ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
