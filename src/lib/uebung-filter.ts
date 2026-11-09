import { INTENSITAETEN, KATEGORIEN, SFV_STUFEN, SPIELPHASEN } from "./uebung-schema";

/**
 * Filter der Übungsbibliothek. Alle Filter stehen in der URL, damit Links teilbar sind:
 *   /uebungen?stufe=D&stufe=E&spieler=14&torhueter=1&kategorie=Taktik&q=pressing
 */
export type UebungsFilter = {
  spieler?: number;
  torhueter?: boolean;
  stufen: string[];
  kategorien: string[];
  phasen: string[];
  intensitaeten: string[];
  dauerMax?: number;
  q?: string;
};

type Roh = Record<string, string | string[] | undefined>;

const liste = (wert: string | string[] | undefined): string[] =>
  (Array.isArray(wert) ? wert : wert ? [wert] : []).flatMap((w) => w.split(",")).map((w) => w.trim()).filter(Boolean);

const nur = <T extends string>(erlaubt: readonly T[], werte: string[]): T[] =>
  [...new Set(werte)].filter((w): w is T => (erlaubt as readonly string[]).includes(w));

export function filterLesen(roh: Roh): UebungsFilter {
  const zahl = (w: string | string[] | undefined, min: number, max: number) => {
    const n = Number(Array.isArray(w) ? w[0] : w);
    return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
  };
  const q = (Array.isArray(roh.q) ? roh.q[0] : roh.q)?.trim().slice(0, 100);
  const tw = Array.isArray(roh.torhueter) ? roh.torhueter[0] : roh.torhueter;
  return {
    spieler: zahl(roh.spieler, 1, 40),
    torhueter: tw === "1" || tw === "ja" ? true : undefined,
    stufen: nur(SFV_STUFEN, liste(roh.stufe)),
    kategorien: nur(KATEGORIEN, liste(roh.kategorie)),
    phasen: nur(SPIELPHASEN, liste(roh.phase)),
    intensitaeten: nur(INTENSITAETEN, liste(roh.intensitaet)),
    dauerMax: zahl(roh.dauer, 1, 120),
    q: q || undefined,
  };
}

export function filterAlsQuery(f: UebungsFilter): string {
  const p = new URLSearchParams();
  for (const s of f.stufen) p.append("stufe", s);
  if (f.spieler) p.set("spieler", String(f.spieler));
  if (f.torhueter) p.set("torhueter", "1");
  for (const k of f.kategorien) p.append("kategorie", k);
  for (const ph of f.phasen) p.append("phase", ph);
  for (const i of f.intensitaeten) p.append("intensitaet", i);
  if (f.dauerMax) p.set("dauer", String(f.dauerMax));
  if (f.q) p.set("q", f.q);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function filterAktiv(f: UebungsFilter): boolean {
  return filterAlsQuery(f) !== "";
}

/** Gleiche Logik wie die Datenbankabfrage, für Tests und Anzeige ohne Datenbank. */
export function passt(
  u: {
    stufen: string[];
    spieler_min: number;
    spieler_max: number;
    mit_torhueter: boolean;
    kategorie: string;
    spielphase: string;
    intensitaet: string;
    dauer_min: number;
  },
  f: UebungsFilter,
): boolean {
  if (f.spieler !== undefined && (f.spieler < u.spieler_min || f.spieler > u.spieler_max)) return false;
  if (f.torhueter && !u.mit_torhueter) return false;
  if (f.stufen.length && !f.stufen.some((s) => u.stufen.includes(s))) return false;
  if (f.kategorien.length && !f.kategorien.includes(u.kategorie)) return false;
  if (f.phasen.length && !f.phasen.includes(u.spielphase)) return false;
  if (f.intensitaeten.length && !f.intensitaeten.includes(u.intensitaet)) return false;
  if (f.dauerMax !== undefined && u.dauer_min > f.dauerMax) return false;
  return true;
}
