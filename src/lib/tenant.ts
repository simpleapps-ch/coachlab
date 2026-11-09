/**
 * Mandanten-Erkennung über die Subdomain.
 *
 * fc-beispiel.coachlab.com        -> "fc-beispiel"
 * fc-beispiel.coachlab.localhost  -> "fc-beispiel" (lokale Entwicklung)
 * coachlab.com, www.coachlab.com  -> null (öffentliche Seiten)
 */

/** Header, über den Seiten den erkannten Verein lesen (setzt src/proxy.ts). */
export const TENANT_HEADER = "x-coachlab-tenant";

/** Subdomains, die kein Verein registrieren darf. */
export const RESERVIERTE_SUBDOMAINS = new Set([
  // Gleiche Liste wie Constraint tenants_slug_nicht_reserviert in supabase/migrations.
  // Sie deckt auch die öffentlichen Pfade ab (/preise, /registrieren, /auth ...),
  // weil Vereine ohne Subdomain unter /<slug> erreichbar sind.
  "www", "app", "admin", "api", "mcp", "auth", "login", "docs", "hilfe", "support",
  "status", "mail", "staging", "preview", "preise", "registrieren", "impressum",
  "datenschutz", "agb", "konto", "einladung", "verein", "vereine", "coachlab",
]);

/** Gültiger Slug: 3–40 Zeichen, Kleinbuchstaben, Ziffern, Bindestrich, nicht am Rand. */
const SLUG_MUSTER = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function istGueltigerSlug(slug: string): boolean {
  return SLUG_MUSTER.test(slug) && !RESERVIERTE_SUBDOMAINS.has(slug);
}

/**
 * Liest den Vereins-Slug aus dem Host-Header.
 * @param host z. B. "fc-beispiel.coachlab.com:3000"
 * @param rootDomain z. B. "coachlab.com" oder "coachlab.localhost"
 */
export function slugAusHost(
  host: string | null | undefined,
  rootDomain: string,
): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  const root = rootDomain.split(":")[0].toLowerCase();

  if (hostname === root || !hostname.endsWith(`.${root}`)) return null;

  const sub = hostname.slice(0, -(root.length + 1));
  if (sub.includes(".")) return null; // nur eine Ebene erlaubt
  return istGueltigerSlug(sub) ? sub : null;
}
