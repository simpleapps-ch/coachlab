/**
 * Prüft ein Weiterleitungsziel aus der URL (z. B. ?weiter=/zug94).
 * Erlaubt sind nur Pfade auf derselben Website, nie fremde Adressen.
 */
export function sichererPfad(ziel: string | null | undefined, standard = "/"): string {
  if (!ziel || typeof ziel !== "string") return standard;
  if (!ziel.startsWith("/") || ziel.startsWith("//") || ziel.startsWith("/\\")) return standard;
  if (/[\r\n]/.test(ziel)) return standard;
  return ziel;
}
