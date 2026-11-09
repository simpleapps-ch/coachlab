import type { Aktion, Animation, Schritt } from "@/lib/uebung-schema";

/**
 * Reine Berechnung der Animation, ohne React. Ein Zustand beschreibt, wo jedes
 * Objekt am Ende eines Schritts steht und wer den Ball hat.
 */

export type Punkt = { x: number; y: number };

export type Zustand = {
  pos: Record<string, Punkt>;
  ballBei: string | null;
  ball: Punkt | null;
};

export type Pfeil = {
  art: Aktion["art"];
  von: Punkt;
  nach: Punkt;
};

const kopie = (z: Zustand): Zustand => ({
  pos: Object.fromEntries(Object.entries(z.pos).map(([k, p]) => [k, { ...p }])),
  ballBei: z.ballBei,
  ball: z.ball ? { ...z.ball } : null,
});

export function startZustand(a: Animation): Zustand {
  const pos: Record<string, Punkt> = {};
  let ballBei: string | null = null;
  let ball: Punkt | null = null;
  for (const o of a.objekte) {
    if (o.typ === "ball") {
      ballBei = o.bei ?? null;
      if (!o.bei && o.x !== undefined && o.y !== undefined) ball = { x: o.x, y: o.y };
    } else {
      pos[o.id] = { x: o.x, y: o.y };
    }
  }
  if (ballBei && pos[ballBei]) ball = { ...pos[ballBei] };
  return { pos, ballBei, ball };
}

/** Zustand am Ende eines Schritts. Aktionen eines Schritts laufen gleichzeitig. */
export function schrittAnwenden(z: Zustand, s: Schritt): Zustand {
  const n = kopie(z);
  for (const ak of s.aktionen) {
    if (ak.art === "lauf" || ak.art === "dribbling") n.pos[ak.id] = { x: ak.x, y: ak.y };
    if (ak.art === "dribbling") n.ballBei = ak.id;
  }
  for (const ak of s.aktionen) {
    if (ak.art === "pass") n.ballBei = ak.zu;
    if (ak.art === "schuss") {
      n.ballBei = null;
      n.ball = { x: ak.x, y: ak.y };
    }
  }
  if (n.ballBei && n.pos[n.ballBei]) n.ball = { ...n.pos[n.ballBei] };
  return n;
}

/** Alle Zustände: [Start, nach Schritt 1, nach Schritt 2, ...]. */
export function alleZustaende(a: Animation): Zustand[] {
  const liste = [startZustand(a)];
  for (const s of a.schritte) liste.push(schrittAnwenden(liste[liste.length - 1], s));
  return liste;
}

const weich = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const mischen = (a: Punkt, b: Punkt, t: number): Punkt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Zwischenzustand innerhalb eines Schritts, t von 0 bis 1. */
export function zwischen(a: Zustand, b: Zustand, s: Schritt, t: number): Zustand {
  const w = weich(Math.min(1, Math.max(0, t)));
  const pos: Record<string, Punkt> = {};
  for (const k of Object.keys(b.pos)) pos[k] = mischen(a.pos[k] ?? b.pos[k], b.pos[k], w);

  const ballFliegt = s.aktionen.some((ak) => ak.art === "pass" || ak.art === "schuss");
  let ball: Punkt | null = b.ball;
  if (a.ball && b.ball) {
    if (ballFliegt) {
      // Pass und Schuss: gleichmässiger Flug, kommt mit dem Schrittende an.
      ball = mischen(a.ball, b.ball, Math.min(1, Math.max(0, t)));
    } else if (b.ballBei && pos[b.ballBei]) {
      ball = pos[b.ballBei];
    } else {
      ball = mischen(a.ball, b.ball, w);
    }
  }
  return { pos, ballBei: t >= 1 ? b.ballBei : a.ballBei, ball };
}

/** Pfeile eines Schritts: von der Position davor zur Position danach. */
export function pfeile(a: Zustand, b: Zustand, s: Schritt): Pfeil[] {
  return s.aktionen.flatMap((ak): Pfeil[] => {
    if (ak.art === "pass") {
      const von = a.pos[ak.von];
      const nach = b.pos[ak.zu];
      return von && nach ? [{ art: "pass", von, nach }] : [];
    }
    if (ak.art === "schuss") {
      const von = a.pos[ak.von];
      return von ? [{ art: "schuss", von, nach: { x: ak.x, y: ak.y } }] : [];
    }
    const von = a.pos[ak.id];
    return von ? [{ art: ak.art, von, nach: { x: ak.x, y: ak.y } }] : [];
  });
}

/**
 * Darstellungstempo in Metern pro Sekunde (bei Tempo 1×). Bewusst langsamer als in
 * Wirklichkeit, damit man Ball und Laufwege am Bildschirm verfolgen kann.
 */
export const TEMPO = { pass: 6, schuss: 12, lauf: 4, dribbling: 3 } as const;
/** Kein Schritt ist kürzer als das, damit der Text gelesen werden kann. */
export const MINDESTDAUER = 1.6;

const distanz = (p: Punkt, q: Punkt) => Math.hypot(q.x - p.x, q.y - p.y);

/**
 * Tatsächliche Dauer eines Schritts: die angegebene Dauer, aber mindestens so lang,
 * dass Pässe, Läufe und Dribblings im Darstellungstempo ankommen.
 */
export function schrittDauer(a: Zustand, b: Zustand, s: Schritt): number {
  let noetig = MINDESTDAUER;
  for (const ak of s.aktionen) {
    if (ak.art === "pass" && a.pos[ak.von] && b.pos[ak.zu]) {
      noetig = Math.max(noetig, distanz(a.pos[ak.von], b.pos[ak.zu]) / TEMPO.pass);
    } else if (ak.art === "schuss" && a.pos[ak.von]) {
      noetig = Math.max(noetig, distanz(a.pos[ak.von], ak) / TEMPO.schuss);
    } else if ((ak.art === "lauf" || ak.art === "dribbling") && a.pos[ak.id]) {
      noetig = Math.max(noetig, distanz(a.pos[ak.id], ak) / TEMPO[ak.art]);
    }
  }
  return Math.max(s.dauer, Math.round(noetig * 10) / 10);
}

/** Dauer aller Schritte in Sekunden bei Tempo 1. */
export function alleDauern(a: Animation): number[] {
  const z = alleZustaende(a);
  return a.schritte.map((s, i) => schrittDauer(z[i], z[i + 1], s));
}

/** Gesamtdauer in Sekunden bei Tempo 1. */
export function gesamtdauer(a: Animation): number {
  return alleDauern(a).reduce((summe, d) => summe + d, 0);
}
