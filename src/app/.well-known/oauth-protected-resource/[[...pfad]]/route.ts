import { originAus, ressourcenMetadaten } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

/**
 * Protected Resource Metadata (RFC 9728) für den Connector unter /api/mcp.
 * Erreichbar unter /.well-known/oauth-protected-resource und …/api/mcp.
 */
export async function GET(request: Request) {
  return Response.json(ressourcenMetadaten(originAus(request)), {
    headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" },
  });
}
