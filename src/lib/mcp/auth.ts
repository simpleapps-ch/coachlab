import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Anmeldung für den Connector (OAuth 2.1, Autorisierungsserver ist Supabase Auth).
 * Claude holt sich mit Zustimmung der Person ein Zugriffstoken; damit läuft jede Abfrage
 * unter Row Level Security wie auf der Website.
 */

export const MCP_PFAD = "/api/mcp";
export const METADATEN_PFAD = "/.well-known/oauth-protected-resource";

/** Öffentliche Adresse der Anfrage (hinter Netlify über x-forwarded-*). */
export function originAus(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    (host.includes("localhost") ? "http" : url.protocol.replace(":", ""));
  return `${proto}://${host}`;
}

/** Protected Resource Metadata (RFC 9728): sagt Claude, wo es das Token holt. */
export function ressourcenMetadaten(origin: string, supabaseUrl = SUPABASE_URL) {
  return {
    resource: `${origin}${MCP_PFAD}`,
    authorization_servers: [`${supabaseUrl}/auth/v1`],
    bearer_methods_supported: ["header"],
    resource_name: "Coachlab",
    resource_documentation: `${origin}/`,
  };
}

/** Antwort ohne gültiges Token: zeigt Claude den Weg zur Anmeldung. */
export function nichtAngemeldet(origin: string, grund?: string): Response {
  const teile = [`resource_metadata="${origin}${METADATEN_PFAD}${MCP_PFAD}"`];
  if (grund) teile.push(`error="invalid_token"`, `error_description="${grund.replace(/"/g, "'")}"`);
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: grund ?? "Anmeldung bei Coachlab nötig" },
      id: null,
    }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": `Bearer ${teile.join(", ")}`,
        "cache-control": "no-store",
      },
    },
  );
}

/** Liest das Bearer-Token aus dem Authorization-Header. */
export function tokenAus(request: Request): string | null {
  const h = request.headers.get("authorization");
  const m = h?.match(/^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i);
  return m ? m[1] : null;
}

export type Angemeldet = { supabase: SupabaseClient; benutzerId: string };

/**
 * Prüft das Token bei Supabase (Signatur, Ablauf) und liefert einen Client, der mit diesem
 * Token arbeitet, also unter RLS. Nie der Service-Role-Key (CLAUDE.md, Regel 5).
 */
export async function tokenPruefen(token: string): Promise<Angemeldet | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let ergebnis: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
  try {
    ergebnis = await supabase.auth.getClaims(token);
  } catch {
    return null; // kein lesbares JWT
  }
  const { data, error } = ergebnis;
  // Supabase nicht erreichbar ist kein ungültiges Token: Fehler statt neuer Anmeldung.
  if (error?.name === "AuthRetryableFetchError") throw new Error("Supabase Auth nicht erreichbar");
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== "authenticated") return null;
  if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) return null;
  return { supabase, benutzerId: claims.sub };
}
