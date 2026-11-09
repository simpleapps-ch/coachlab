import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sichererPfad } from "@/lib/pfad";

/**
 * Ziel der Links in Bestätigungs-E-Mails von Supabase.
 * Tauscht den Code gegen eine Session und leitet auf ?weiter= um.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const weiter = sichererPfad(url.searchParams.get("weiter"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(weiter, url.origin));
  }

  const fehler = new URL(weiter, url.origin);
  fehler.searchParams.set("fehler", "link");
  return NextResponse.redirect(fehler);
}
