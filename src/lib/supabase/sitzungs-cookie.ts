/**
 * Anmelde-Cookies als Sitzungs-Cookies: Wer den Browser schliesst, ist abgemeldet.
 * @supabase/ssr setzt immer maxAge = 400 Tage; das entfernen wir hier für alle Stellen,
 * die Cookies schreiben (Server, Proxy, Browser). Löschen (maxAge <= 0) bleibt unverändert.
 */
export function alsSitzungsCookie<T extends { maxAge?: number; expires?: Date }>(optionen: T): T;
export function alsSitzungsCookie<T extends { maxAge?: number; expires?: Date }>(optionen: T | undefined): T | undefined;
export function alsSitzungsCookie<T extends { maxAge?: number; expires?: Date }>(optionen: T | undefined) {
  if (!optionen) return optionen;
  const loeschen =
    (optionen.maxAge !== undefined && optionen.maxAge <= 0) ||
    (optionen.expires !== undefined && optionen.expires.getTime() <= Date.now());
  if (loeschen) return optionen;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { maxAge, expires, ...rest } = optionen;
  return rest as T;
}
