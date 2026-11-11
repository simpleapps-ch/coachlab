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

export const weich = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const mischen = (a: Punkt, b: Punkt, t: number): Punkt => ({
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
/** Ballgeschwindigkeit (Pass/Schuss mit «tempo»): Faktor auf TEMPO.pass bzw. TEMPO.schuss. */
export const BALLFAKTOR = { langsam: 0.65, mittel: 1, scharf: 1.7 } as const;
/** Kürzeste Dauer eines Schritts mit gewählter Ballgeschwindigkeit. */
export const KUERZESTE_DAUER = 0.6;

const distanz = (p: Punkt, q: Punkt) => Math.hypot(q.x - p.x, q.y - p.y);

/**
 * Tatsächliche Dauer eines Schritts: die angegebene Dauer, aber mindestens so lang,
 * dass Pässe, Läufe und Dribblings im Darstellungstempo ankommen.
 * Hat der Pass oder Schuss eine Ballgeschwindigkeit («tempo»), bestimmt sie die Dauer:
 * Der Schritt dauert so lange, wie der Ball unterwegs ist (Läufe brauchen höchstens länger).
 */
export function schrittDauer(a: Zustand, b: Zustand, s: Schritt): number {
  const gewaehlt = s.aktionen.some((ak) => (ak.art === "pass" || ak.art === "schuss") && ak.tempo);
  let noetig = gewaehlt ? KUERZESTE_DAUER : MINDESTDAUER;
  for (const ak of s.aktionen) {
    if (ak.art === "pass" && a.pos[ak.von] && b.pos[ak.zu]) {
      const v = TEMPO.pass * BALLFAKTOR[ak.tempo ?? "mittel"];
      noetig = Math.max(noetig, distanz(a.pos[ak.von], b.pos[ak.zu]) / v);
    } else if (ak.art === "schuss" && a.pos[ak.von]) {
      const v = TEMPO.schuss * BALLFAKTOR[ak.tempo ?? "mittel"];
      noetig = Math.max(noetig, distanz(a.pos[ak.von], ak) / v);
    } else if ((ak.art === "lauf" || ak.art === "dribbling") && a.pos[ak.id]) {
      noetig = Math.max(noetig, distanz(a.pos[ak.id], ak) / TEMPO[ak.art]);
    }
  }
  const gerundet = Math.round(noetig * 10) / 10;
  return gewaehlt ? gerundet : Math.max(s.dauer, gerundet);
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

/**
 * Massstab für Spieler, Ball, Hütchen und Pfeile: Auf grossen Feldern (z. B. 60 × 45 m)
 * wären sie in echter Grösse zu klein, darum wachsen sie ab etwa 30 m mit.
 */
export function massstab(breite: number, laenge: number): number {
  return Math.max(1, Math.max(breite, laenge) / 30);
}

export type PassKonflikt = {
  schritt: number; // 1-basiert
  von: string;
  zu: string; // Empfänger-ID oder "Tor"
  spieler: string;
  abstand: number; // kleinster Abstand Ball–Spieler in Metern
};

/**
 * Prüft, ob ein Pass oder Schuss durch oder über einen Spieler läuft.
 * Ball und Spieler bewegen sich dabei wie im Player (Ball gleichmässig, Spieler weich).
 * Mindestabstand: 1,1 m × Massstab, also deutlich ausserhalb des gezeichneten Spielers.
 * Ausgenommen sind Passgeber und Empfänger, bei Schüssen auch die Torhüter.
 */
export function passKonflikte(a: Animation, mindestabstand?: number): PassKonflikt[] {
  const grenze = mindestabstand ?? 1.1 * massstab(a.feld.breite, a.feld.laenge);
  const torhueter = new Set(
    a.objekte.filter((o) => o.typ === "spieler" && o.rolle === "torhueter").map((o) => o.id),
  );
  const spieler = a.objekte.filter((o) => o.typ === "spieler").map((o) => o.id);
  const z = alleZustaende(a);
  const liste: PassKonflikt[] = [];

  a.schritte.forEach((s, i) => {
    const vorher = z[i];
    const nachher = z[i + 1];
    for (const ak of s.aktionen) {
      if (ak.art !== "pass" && ak.art !== "schuss") continue;
      const start = vorher.ball;
      const ziel = ak.art === "pass" ? nachher.pos[ak.zu] : { x: ak.x, y: ak.y };
      if (!start || !ziel) continue;
      const ausgenommen = new Set([ak.von, ...(ak.art === "pass" ? [ak.zu] : torhueter)]);
      for (const id of spieler) {
        if (ausgenommen.has(id)) continue;
        let kleinster = Infinity;
        for (let k = 0; k <= 50; k++) {
          const t = k / 50;
          const ball = mischen(start, ziel, t);
          // Die ersten 0,8 m löst sich der Ball erst vom Fuss.
          if (distanz(ball, start) < 0.8) continue;
          const w = weich(t);
          const p = mischen(vorher.pos[id], nachher.pos[id], w);
          kleinster = Math.min(kleinster, distanz(ball, p));
        }
        if (kleinster < grenze) {
          liste.push({
            schritt: i + 1,
            von: ak.von,
            zu: ak.art === "pass" ? ak.zu : "Tor",
            spieler: id,
            abstand: Math.round(kleinster * 10) / 10,
          });
        }
      }
    }
  });
  return liste;
}
