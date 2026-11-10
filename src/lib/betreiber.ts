/**
 * Angaben zum Betreiber für Impressum, Datenschutz und Kontakt.
 * Fehlende Angaben stehen als null; der Test tests/website.test.ts schlägt fehl,
 * solange etwas fehlt (Impressumspflicht, Art. 3 Abs. 1 lit. s UWG).
 */
export const BETREIBER = {
  firma: "Simpleapps.ch GmbH",
  strasse: null as string | null,
  ort: null as string | null, // z. B. "6300 Zug"
  land: "Schweiz",
  uid: null as string | null, // CHE-123.456.789
  email: null as string | null, // Funktionsadresse, z. B. hallo@coachlab.com
  vertreten: null as string | null, // Geschäftsführung, Name
};

export const fehlendeAngaben = () =>
  Object.entries(BETREIBER)
    .filter(([, wert]) => wert === null)
    .map(([feld]) => feld);

/** Für Seiten: Angabe oder deutlich sichtbarer Platzhalter. */
export const angabe = (wert: string | null, feld: string) => wert ?? `[${feld} fehlt]`;
