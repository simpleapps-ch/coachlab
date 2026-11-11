import type { Aktion, Animation, AnimationsObjekt, Schritt } from "@/lib/uebung-schema";
import { alleZustaende, massstab, type Punkt } from "./engine";

/**
 * Reine Bearbeitungsfunktionen für den Animations-Editor. Jede Funktion gibt eine neue
 * Animation zurück und lässt die alte unverändert (Rückgängig = alte Fassung behalten).
 * Ob das Ergebnis dem Pflichtformat und dem Standard entspricht, prüft uebungPruefen().
 */

export const MAX_OBJEKTE = 40;
export const MAX_SCHRITTE = 30;

/** Auf 10 cm runden und ins Feld holen. */
export function insFeld(a: Animation, p: Punkt): Punkt {
  const r = (v: number) => Math.round(v * 10) / 10;
  return {
    x: r(Math.min(a.feld.breite, Math.max(0, p.x))),
    y: r(Math.min(a.feld.laenge, Math.max(0, p.y))),
  };
}

const mitSchritt = (a: Animation, i: number, f: (s: Schritt) => Schritt): Animation => ({
  ...a,
  schritte: a.schritte.map((s, k) => (k === i ? f(s) : s)),
});

/** Wer hat den Ball zu Beginn von Schritt i (0-basiert)? */
export function ballVorSchritt(a: Animation, i: number): string | null {
  return alleZustaende(a)[i]?.ballBei ?? null;
}

// ---------------------------------------------------------------------------
// Aufstellung
// ---------------------------------------------------------------------------

/**
 * Startposition eines Objekts setzen. Den Ball legt man einem Spieler vor die Füsse,
 * indem man ihn auf den Spieler zieht; sonst bleibt er frei liegen.
 */
export function startSetzen(a: Animation, id: string, ziel: Punkt): Animation {
  const p = insFeld(a, ziel);
  const o = a.objekte.find((x) => x.id === id);
  if (!o) return a;
  if (o.typ !== "ball") {
    return { ...a, objekte: a.objekte.map((x) => (x.id === id ? { ...x, x: p.x, y: p.y } : x)) };
  }
  const fang = 1.2 * massstab(a.feld.breite, a.feld.laenge);
  let naechster: { id: string; d: number } | null = null;
  for (const s of a.objekte) {
    if (s.typ !== "spieler") continue;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d <= fang && (!naechster || d < naechster.d)) naechster = { id: s.id, d };
  }
  const ball: AnimationsObjekt = naechster
    ? { id: o.id, typ: "ball", bei: naechster.id }
    : { id: o.id, typ: "ball", x: p.x, y: p.y };
  return { ...a, objekte: a.objekte.map((x) => (x.id === id ? ball : x)) };
}

/** Freie, kurze ID: A1, A2 … für Spieler, h1 … für Hütchen, t1 … für Tore. */
export function neueId(a: Animation, praefix: string): string {
  const belegt = new Set(a.objekte.map((o) => o.id));
  for (let n = 1; ; n++) if (!belegt.has(`${praefix}${n}`)) return `${praefix}${n}`;
}

export type NeuesObjekt =
  | { typ: "spieler"; team: "A" | "B" | "C" | "N" }
  | { typ: "huetchen" }
  | { typ: "tor" }
  | { typ: "ball" };

/** Neues Objekt in die Feldmitte (leicht versetzt, damit es nicht auf einem anderen liegt). */
export function objektHinzufuegen(a: Animation, neu: NeuesObjekt): { animation: Animation; id: string | null } {
  if (a.objekte.length >= MAX_OBJEKTE) return { animation: a, id: null };
  if (neu.typ === "ball" && a.objekte.some((o) => o.typ === "ball")) return { animation: a, id: null };
  const mitte = { x: a.feld.breite / 2, y: a.feld.laenge / 2 };
  const m = massstab(a.feld.breite, a.feld.laenge);
  let p = mitte;
  for (let k = 0; k < 12; k++) {
    const frei = a.objekte.every((o) => o.typ === "ball" || Math.hypot(o.x - p.x, o.y - p.y) > 1.5 * m);
    if (frei) break;
    const w = (k * Math.PI) / 3;
    const r = 2 * m * (1 + Math.floor(k / 6));
    p = { x: mitte.x + Math.cos(w) * r, y: mitte.y + Math.sin(w) * r };
  }
  p = insFeld(a, p);
  let o: AnimationsObjekt;
  if (neu.typ === "spieler") {
    o = { id: neueId(a, neu.team), typ: "spieler", team: neu.team, x: p.x, y: p.y, rolle: "feld" };
  } else if (neu.typ === "huetchen") {
    o = { id: neueId(a, "h"), typ: "huetchen", x: p.x, y: p.y };
  } else if (neu.typ === "tor") {
    o = { id: neueId(a, "t"), typ: "tor", x: p.x, y: 0, breite: 2, ausrichtung: "oben" };
  } else {
    o = { id: neueId(a, "ball"), typ: "ball", x: p.x, y: p.y };
  }
  return { animation: { ...a, objekte: [...a.objekte, o] }, id: o.id };
}

/** Eigenschaften eines Objekts ändern (Team, Rolle, Torbreite, Ausrichtung). Position und ID nicht. */
export function objektAendern(a: Animation, id: string, felder: Partial<AnimationsObjekt>): Animation {
  return {
    ...a,
    objekte: a.objekte.map((o) =>
      o.id === id ? ({ ...o, ...felder, id: o.id, typ: o.typ } as AnimationsObjekt) : o,
    ),
  };
}

/**
 * Objekt entfernen, samt allen Aktionen, die es betreffen. Hatte es den Ball,
 * bleibt der Ball an seiner Stelle liegen.
 */
export function objektEntfernen(a: Animation, id: string): Animation {
  const o = a.objekte.find((x) => x.id === id);
  if (!o) return a;
  const objekte = a.objekte
    .filter((x) => x.id !== id)
    .map((x) =>
      x.typ === "ball" && x.bei === id && o.typ === "spieler"
        ? ({ id: x.id, typ: "ball", x: o.x, y: o.y } as AnimationsObjekt)
        : x,
    );
  const betrifft = (ak: Aktion) =>
    (ak.art === "pass" && (ak.von === id || ak.zu === id)) ||
    (ak.art === "schuss" && ak.von === id) ||
    ((ak.art === "lauf" || ak.art === "dribbling") && ak.id === id);
  return {
    ...a,
    objekte,
    schritte: a.schritte.map((s) => ({ ...s, aktionen: s.aktionen.filter((ak) => !betrifft(ak)) })),
  };
}

// ---------------------------------------------------------------------------
// Aktionen in einem Schritt
// ---------------------------------------------------------------------------

/**
 * Laufweg setzen: Spieler läuft in Schritt i an den Zielpunkt. Hat er zu Beginn
 * des Schritts den Ball, wird daraus ein Dribbling.
 */
export function bewegungSetzen(a: Animation, i: number, id: string, ziel: Punkt): Animation {
  const p = insFeld(a, ziel);
  const art = ballVorSchritt(a, i) === id ? "dribbling" : "lauf";
  return mitSchritt(a, i, (s) => ({
    ...s,
    aktionen: [
      ...s.aktionen.filter((ak) => !((ak.art === "lauf" || ak.art === "dribbling") && ak.id === id)),
      { art, id, x: p.x, y: p.y },
    ],
  }));
}

/** Laufweg oder Dribbling eines Spielers in Schritt i entfernen (der Standard übernimmt wieder). */
export function bewegungEntfernen(a: Animation, i: number, id: string): Animation {
  return mitSchritt(a, i, (s) => ({
    ...s,
    aktionen: s.aktionen.filter((ak) => !((ak.art === "lauf" || ak.art === "dribbling") && ak.id === id)),
  }));
}

/** Pro Schritt gibt es höchstens einen Pass oder Schuss: Ein neuer ersetzt den alten. */
const ohneBall = (s: Schritt) => s.aktionen.filter((ak) => ak.art !== "pass" && ak.art !== "schuss");

export type BallErgebnis = { ok: true; animation: Animation } | { ok: false; grund: string };

/** Pass in Schritt i vom Ballführenden zu Spieler «zu». */
export function passSetzen(a: Animation, i: number, zu: string): BallErgebnis {
  const von = ballVorSchritt(a, i);
  if (!von) return { ok: false, grund: "Zu Beginn dieses Schritts hat niemand den Ball." };
  if (von === zu) return { ok: false, grund: "Wähle einen anderen Spieler als den Ballführenden." };
  return {
    ok: true,
    animation: mitSchritt(a, i, (s) => ({ ...s, aktionen: [...ohneBall(s), { art: "pass", von, zu }] })),
  };
}

/** Schuss in Schritt i vom Ballführenden auf den Zielpunkt. */
export function schussSetzen(a: Animation, i: number, ziel: Punkt): BallErgebnis {
  const von = ballVorSchritt(a, i);
  if (!von) return { ok: false, grund: "Zu Beginn dieses Schritts hat niemand den Ball." };
  const p = insFeld(a, ziel);
  return {
    ok: true,
    animation: mitSchritt(a, i, (s) => ({ ...s, aktionen: [...ohneBall(s), { art: "schuss", von, x: p.x, y: p.y }] })),
  };
}

export function aktionEntfernen(a: Animation, i: number, k: number): Animation {
  return mitSchritt(a, i, (s) => ({ ...s, aktionen: s.aktionen.filter((_, j) => j !== k) }));
}

/** Verständliche Beschreibung einer Aktion für die Liste im Editor. */
export function aktionText(ak: Aktion): string {
  switch (ak.art) {
    case "pass":
      return `Pass ${ak.von} → ${ak.zu}`;
    case "schuss":
      return `Schuss ${ak.von} auf (${ak.x} | ${ak.y})`;
    case "dribbling":
      return `Dribbling ${ak.id} nach (${ak.x} | ${ak.y})`;
    case "lauf":
      return `Laufweg ${ak.id} nach (${ak.x} | ${ak.y})`;
  }
}

// ---------------------------------------------------------------------------
// Schritte
// ---------------------------------------------------------------------------

export function schrittAendern(a: Animation, i: number, felder: Partial<Pick<Schritt, "text" | "dauer">>): Animation {
  return mitSchritt(a, i, (s) => ({ ...s, ...felder }));
}

/** Neuer, leerer Schritt nach Schritt i. Er braucht danach mindestens eine Aktion. */
export function schrittEinfuegen(a: Animation, i: number): Animation {
  if (a.schritte.length >= MAX_SCHRITTE) return a;
  const neu: Schritt = { dauer: 2, text: "Neuer Schritt", aktionen: [] };
  return { ...a, schritte: [...a.schritte.slice(0, i + 1), neu, ...a.schritte.slice(i + 1)] };
}

export function schrittDuplizieren(a: Animation, i: number): Animation {
  if (a.schritte.length >= MAX_SCHRITTE || !a.schritte[i]) return a;
  const kopie: Schritt = structuredClone(a.schritte[i]);
  return { ...a, schritte: [...a.schritte.slice(0, i + 1), kopie, ...a.schritte.slice(i + 1)] };
}

export function schrittLoeschen(a: Animation, i: number): Animation {
  if (a.schritte.length <= 1) return a;
  return { ...a, schritte: a.schritte.filter((_, k) => k !== i) };
}

/** Schritt i um eine Stelle nach oben (-1) oder unten (+1) schieben. */
export function schrittVerschieben(a: Animation, i: number, richtung: -1 | 1): Animation {
  const j = i + richtung;
  if (j < 0 || j >= a.schritte.length) return a;
  const schritte = [...a.schritte];
  [schritte[i], schritte[j]] = [schritte[j], schritte[i]];
  return { ...a, schritte };
}

// ---------------------------------------------------------------------------
// Feld und Zonen
// ---------------------------------------------------------------------------

/**
 * Feldgrösse ändern (ganze Meter, weil die Übung sie als «BreitexLänge» führt).
 * Objekte, Zielpunkte und Zonen ausserhalb werden an den Rand geholt.
 */
export function feldAendern(a: Animation, breite: number, laenge: number): Animation {
  const b = Math.round(Math.min(75, Math.max(5, breite)));
  const l = Math.round(Math.min(110, Math.max(5, laenge)));
  const neu: Animation = { ...a, feld: { ...a.feld, breite: b, laenge: l } };
  const klemmen = <T extends { x?: number; y?: number }>(o: T): T =>
    o.x === undefined || o.y === undefined ? o : { ...o, ...insFeld(neu, { x: o.x, y: o.y }) };
  return {
    ...neu,
    objekte: a.objekte.map((o) => klemmen(o)),
    schritte: a.schritte.map((s) => ({
      ...s,
      aktionen: s.aktionen.map((ak) => (ak.art === "pass" ? ak : klemmen(ak))),
    })),
    zonen: a.zonen
      ? {
          ...a.zonen,
          x: a.zonen.x.filter((x) => x > 0 && x < b),
          y: a.zonen.y.filter((y) => y > 0 && y < l),
        }
      : undefined,
  };
}

/** Zonengrenzen aus einer Eingabe wie «10, 20» (Meter, höchstens vier, innerhalb des Feldes). */
export function grenzenLesen(eingabe: string, max: number): number[] {
  const werte = eingabe
    .split(/[,;\s]+/)
    .map((t) => Number(t.replace(/[^\d.]/g, "")))
    .filter((v) => Number.isFinite(v) && v > 0 && v < max)
    .map((v) => Math.round(v * 10) / 10);
  return [...new Set(werte)].sort((p, q) => p - q).slice(0, 4);
}

export function zonenAendern(a: Animation, felder: Partial<NonNullable<Animation["zonen"]>>): Animation {
  const alt = a.zonen ?? { x: [], y: [], sperren: true };
  const zonen = { ...alt, ...felder };
  return { ...a, zonen: zonen.x.length || zonen.y.length ? zonen : undefined };
}
