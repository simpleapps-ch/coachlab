import { createServerClient } from "@supabase/ssr";
import { alsSitzungsCookie } from "@/lib/supabase/sitzungs-cookie";
import { NextResponse, type NextRequest } from "next/server";
import { TENANT_HEADER, slugAusHost } from "@/lib/tenant";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  supabaseKonfiguriert,
} from "@/lib/supabase/env";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "coachlab.localhost:3000";

/** Pfade, die auf jeder Subdomain gleich bleiben und nicht zum Verein umgeleitet werden. */
const GLOBALE_PFADE = ["/auth", "/api", "/oauth"];

/**
 * 1. Verein erkennen: zug94.coachlab.com/uebungen  ->  intern /zug94/uebungen
 *    Ohne Subdomain (z. B. auf *.netlify.app) ist der Verein direkt unter /zug94 erreichbar.
 * 2. Supabase-Session erneuern.
 */
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const slug = slugAusHost(request.headers.get("host"), ROOT_DOMAIN);

  // Ein vom Browser mitgeschickter Header wird immer überschrieben.
  if (slug) requestHeaders.set(TENANT_HEADER, slug);
  else requestHeaders.delete(TENANT_HEADER);

  const pfad = request.nextUrl.pathname;
  const umleiten = slug && !GLOBALE_PFADE.some((p) => pfad === p || pfad.startsWith(`${p}/`));

  const weiter = () => {
    if (umleiten) {
      const ziel = request.nextUrl.clone();
      ziel.pathname = `/${slug}${pfad === "/" ? "" : pfad}`;
      return NextResponse.rewrite(ziel, { request: { headers: requestHeaders } });
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  };

  let response = weiter();

  if (supabaseKonfiguriert()) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = weiter();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, alsSitzungsCookie(options));
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    });
    await supabase.auth.getClaims();
  }

  return response;
}

export const config = {
  // Alles ausser statischen Dateien, Bildern, Stripe-Webhooks und dem Connector (eigenes Token,
  // keine Cookies; /.well-known bleibt so auch auf Vereins-Subdomains global).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe|api/mcp|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
