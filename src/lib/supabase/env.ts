/**
 * Öffentliche Supabase-Werte (dürfen in den Browser).
 * NEXT_PUBLIC_-Variablen werden beim Build fest eingebaut: nach einer Änderung in
 * Netlify neu deployen.
 */
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
export const SUPABASE_PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

/** Prüft die Werte und nennt verständlich, was fehlt oder falsch ist. */
export function supabaseProbleme(
  url: string = SUPABASE_URL,
  key: string = SUPABASE_PUBLISHABLE_KEY,
): string[] {
  const probleme: string[] = [];
  if (!url) {
    probleme.push("NEXT_PUBLIC_SUPABASE_URL fehlt.");
  } else {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.hostname !== "127.0.0.1" && u.hostname !== "localhost") {
        probleme.push("NEXT_PUBLIC_SUPABASE_URL muss mit https:// beginnen.");
      }
    } catch {
      probleme.push("NEXT_PUBLIC_SUPABASE_URL ist keine gültige Adresse.");
    }
  }
  if (!key) {
    probleme.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt.");
  } else if (key.startsWith("sb_secret_")) {
    probleme.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY enthält den Secret Key. Sofort ersetzen und den Secret Key in Supabase neu erzeugen.",
    );
  } else if (!key.startsWith("sb_publishable_") && !key.startsWith("eyJ")) {
    probleme.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY hat nicht das erwartete Format (sb_publishable_…).");
  }
  return probleme;
}

export function supabaseKonfiguriert(): boolean {
  return supabaseProbleme().length === 0;
}

/** Wirft einen verständlichen Fehler, statt dass Supabase mit einer allgemeinen Meldung abbricht. */
export function supabasePruefen(): void {
  const probleme = supabaseProbleme();
  if (probleme.length > 0) {
    throw new Error(`Supabase ist nicht konfiguriert: ${probleme.join(" ")}`);
  }
}
