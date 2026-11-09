import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TENANT_HEADER, slugAusHost } from "@/lib/tenant";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  supabaseKonfiguriert,
} from "@/lib/supabase/env";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "coachlab.localhost:3000";

export async function proxy(request: NextRequest) {
  // 1. Verein aus der Subdomain erkennen und als Header weitergeben.
  //    Ein vom Browser mitgeschickter Header wird immer überschrieben.
  const requestHeaders = new Headers(request.headers);
  const slug = slugAusHost(request.headers.get("host"), ROOT_DOMAIN);
  if (slug) requestHeaders.set(TENANT_HEADER, slug);
  else requestHeaders.delete(TENANT_HEADER);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // 2. Supabase-Session erneuern (erst sobald Supabase konfiguriert ist).
  if (supabaseKonfiguriert()) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
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
  // Alles ausser statischen Dateien, Bildern und Stripe-Webhooks.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
