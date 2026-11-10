import { passKonflikte } from "@/components/animation/engine";
import {
  dreieckLuecken,
  gegenpressingLuecken,
  nachStandard,
  standardAktiv,
} from "@/components/animation/standard";
import { uebung, type Uebung } from "@/lib/uebung-schema";

/**
 * Prüft eine Übung so, wie der Connector sie vor dem Speichern prüft:
 *  1. Pflichtformat (Zod, gleiches Schema wie Website und Tests)
 *  2. Animationsstandard: Kein Pass durch oder über einen Spieler, nachdem der Standard
 *     die übrigen Spieler bewegt hat (blockiert das Speichern).
 *  3. Dreiecke und Gegenpressing: nur Hinweise, die Technische Leitung entscheidet.
 * Reine Funktion, keine Datenbank.
 */

export type PruefErgebnis =
  | { ok: true; uebung: Uebung; hinweise: string[] }
  | { ok: false; fehler: string[]; hinweise: string[] };

export function uebungPruefen(daten: unknown): PruefErgebnis {
  const geparst = uebung.safeParse(daten);
  if (!geparst.success) {
    return {
      ok: false,
      fehler: geparst.error.issues.map((i) => `${i.path.join(".") || "(Übung)"}: ${i.message}`),
      hinweise: [],
    };
  }
  const u = geparst.data;
  const a = u.animation;
  const hinweise: string[] = [];
  const fehler: string[] = [];

  const mitStandard = standardAktiv(a) ? nachStandard(a) : a;
  for (const k of passKonflikte(mitStandard)) {
    fehler.push(
      `animation.schritte.${k.schritt - 1}: ${k.von === k.zu ? "Ball" : `Pass ${k.von} → ${k.zu}`} läuft durch oder über ${k.spieler} ` +
        `(Abstand ${k.abstand.toFixed(1)} m). Position von ${k.spieler} oder Passweg ändern.`,
    );
  }

  if (standardAktiv(a)) {
    const teams = new Set(a.objekte.flatMap((o) => (o.typ === "spieler" && o.team !== "N" ? [o.team] : [])));
    // Wer ohne Ball beginnt, verteidigt zuerst.
    const ball = a.objekte.find((o) => o.typ === "ball");
    const halterTeam =
      ball && ball.typ === "ball" && ball.bei
        ? a.objekte.find((o) => o.typ === "spieler" && o.id === ball.bei)
        : undefined;
    const verteidigt =
      halterTeam && halterTeam.typ === "spieler" && halterTeam.team !== "N"
        ? [...teams].find((t) => t !== halterTeam.team) ?? "B"
        : "B";
    for (const h of dreieckLuecken(mitStandard, verteidigt)) hinweise.push(`Schritt ${h.schritt}: ${h.text}`);
    for (const h of gegenpressingLuecken(mitStandard)) hinweise.push(`Schritt ${h.schritt}: ${h.text}`);

    if (!hatBallverlust(a)) {
      hinweise.push(
        "Kein Ballverlust in der Animation: Der Standard verlangt einen ganzen Spielzug inkl. Ballverlust und Umschalten (Gegenpressing).",
      );
    }
  }

  if (fehler.length) return { ok: false, fehler, hinweise };
  return { ok: true, uebung: u, hinweise };
}

/** Wechselt der Ball irgendwann von einem Team zum anderen (Neutrale zählen nicht)? */
export function hatBallverlust(a: Uebung["animation"]): boolean {
  const team = (id: string | null) => {
    const o = id ? a.objekte.find((x) => x.id === id) : undefined;
    return o && o.typ === "spieler" && o.team !== "N" ? o.team : null;
  };
  const ball = a.objekte.find((o) => o.typ === "ball");
  let halter: string | null = ball && ball.typ === "ball" ? (ball.bei ?? null) : null;
  let letztesTeam = team(halter);
  for (const s of a.schritte) {
    for (const x of s.aktionen) if (x.art === "dribbling") halter = x.id;
    for (const x of s.aktionen) {
      if (x.art === "pass") halter = x.zu;
      if (x.art === "schuss") halter = null;
    }
    const t = team(halter);
    if (t && letztesTeam && t !== letztesTeam) return true;
    if (t) letztesTeam = t;
  }
  return false;
}
