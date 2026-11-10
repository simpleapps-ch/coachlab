import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { nichtAngemeldet, originAus, tokenAus, tokenPruefen } from "@/lib/mcp/auth";
import { erstelleServer } from "@/lib/mcp/werkzeuge";
import { supabaseProbleme } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Coachlab-Connector für Claude (Model Context Protocol, Streamable HTTP, ohne Sitzungen).
 * Jede Anfrage bringt ihr OAuth-Token mit; Server und Transport leben nur für diese Anfrage.
 */
export async function POST(request: Request) {
  const origin = originAus(request);
  if (supabaseProbleme().length) {
    return Response.json({ error: "Coachlab ist nicht konfiguriert" }, { status: 503 });
  }

  const token = tokenAus(request);
  if (!token) return nichtAngemeldet(origin);
  let angemeldet;
  try {
    angemeldet = await tokenPruefen(token);
  } catch {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Anmeldung vorübergehend nicht prüfbar, bitte nochmals versuchen" }, id: null },
      { status: 503, headers: { "retry-after": "5" } },
    );
  }
  if (!angemeldet) return nichtAngemeldet(origin, "Token ungültig oder abgelaufen");

  const server = erstelleServer({ ...angemeldet, origin });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Bei JSON-Antworten ist alles geschrieben, sobald handleRequest zurückkehrt.
    void server.close();
  }
}

/** Ohne Sitzungen gibt es keinen Ereignis-Stream (GET) und nichts zu beenden (DELETE). */
function nichtErlaubt() {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Methode nicht erlaubt" }, id: null }),
    { status: 405, headers: { allow: "POST", "content-type": "application/json" } },
  );
}

export async function GET(request: Request) {
  // Ohne Token zeigt auch GET den Weg zur Anmeldung (manche Clients prüfen so).
  if (!tokenAus(request)) return nichtAngemeldet(originAus(request));
  return nichtErlaubt();
}

export const DELETE = nichtErlaubt;
