import type { Aktion, Animation } from "@/lib/uebung-schema";
import { massstab, mischen, weich, type Punkt } from "./engine";

/**
 * Coachlab-Animationsstandard (gilt für alle Vereine und alle Spielformen, siehe
 * docs/animations-standard.md). In einer Übung werden nur die wichtigen Aktionen
 * gespeichert (Pässe, Schlüssel-Laufwege). Alle anderen Spieler bewegt dieser Standard:
 *
 *  1. Ballbesitz: Die zwei nächsten Mitspieler bilden mit dem Ballempfänger ein Dreieck
 *     (Abstand 6–15 m, Winkel 45–135°, Passweg frei). Die übrigen machen das Feld breit und tief.
 *  2. Gegen den Ball: Der Nächste presst den Ballempfänger, die anderen stellen Passwege zu.
 *  3. Nach Ballverlust (zwei Schritte lang, etwa 5 Sekunden): Gegenpressing mit zwei Spielern
 *     auf den Ball, die übrigen schliessen die nächsten Passwege, grössere Laufwege.
 *  4. Kein Pass und kein Schuss läuft durch oder über einen Spieler (siehe passKonflikte).
 *     Stört eine vorgegebene Position, wird sie minimal verschoben.
 *  5. Linienspieler (End-/Seitenneutrale, Aussenspieler) bewegen sich nur entlang ihrer Linie,
 *     Torhüter nur auf der Torlinie; Zonen (animation.zonen) werden nicht verlassen.
 *
 * Reine Funktion: gleiche Eingabe, gleiche Ausgabe. Läuft im Player, im Server und in Tests.
 */

type PassOderSchuss = Extract<Aktion, { art: "pass" | "schuss" }>;
type Konflikt = { id: string; abstand: number; ak: PassOderSchuss };

const dist = (a: Punkt, b: Punkt) => Math.hypot(a.x - b.x, a.y - b.y);

function segDist(p: Punkt, a: Punkt, b: Punkt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-9) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function winkel(e: Punkt, a: Punkt, b: Punkt): number {
  const w1 = Math.atan2(a.y - e.y, a.x - e.x);
  const w2 = Math.atan2(b.y - e.y, b.x - e.x);
  let d = Math.abs(w1 - w2) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

/** Wie passKonflikte in der Engine, aber für einen einzelnen Schritt mit geplanten Endpositionen. */
function konflikte(
  start: Record<string, Punkt>,
  ende: Record<string, Punkt>,
  ball: Punkt,
  aktionen: PassOderSchuss[],
  ids: string[],
  torhueter: Set<string>,
  grenze: number,
  nur?: Set<string>,
): Konflikt[] {
  const aus: Konflikt[] = [];
  for (const ak of aktionen) {
    const ziel = ak.art === "pass" ? ende[ak.zu] : { x: ak.x, y: ak.y };
    if (!ziel) continue;
    for (const id of ids) {
      if (id === ak.von || (ak.art === "pass" ? id === ak.zu : torhueter.has(id))) continue;
      if (nur && !nur.has(id)) continue;
      let klein = Infinity;
      for (let k = 0; k <= 50; k++) {
        const t = k / 50;
        const b = mischen(ball, ziel, t);
        if (dist(b, ball) < 0.8) continue;
        klein = Math.min(klein, dist(b, mischen(start[id], ende[id], weich(t))));
      }
      if (klein < grenze) aus.push({ id, abstand: klein, ak });
    }
  }
  return aus;
}

/** Ist der Standard für diese Animation aktiv? Ohne Angabe: sobald zwei Teams im Feld stehen. */
export function standardAktiv(a: Animation): boolean {
  if (a.automatik !== undefined) return a.automatik;
  const teams = new Set(a.objekte.flatMap((o) => (o.typ === "spieler" && o.team !== "N" ? [o.team] : [])));
  return teams.size >= 2;
}

type Offen = { schritt: number; id: string; dx: number; dy: number };

/** Animation nach Coachlab-Standard: ergänzt die Bewegungen aller Spieler. */
export function nachStandard(a: Animation): Animation {
  if (!standardAktiv(a)) return a;
  const korrektur = new Map<string, Punkt>();
  let ergebnis = a;
  for (let runde = 0; runde < 20; runde++) {
    const offen: Offen[] = [];
    ergebnis = durchlauf(a, korrektur, offen);
    if (!offen.length) break;
    for (const o of offen) {
      const k = `${o.schritt}|${o.id}`;
      const alt = korrektur.get(k) ?? { x: 0, y: 0 };
      korrektur.set(k, { x: alt.x + o.dx, y: alt.y + o.dy });
    }
  }
  return ergebnis;
}

function durchlauf(a: Animation, korrektur: Map<string, Punkt>, offen: Offen[]): Animation {
  const B = a.feld.breite;
  const L = a.feld.laenge;
  const m = massstab(B, L);
  const grenze = 1.1 * m + 0.05;
  const sicher = grenze + 0.35 * m;
  const s = Math.max(B, L) / 30;
  const zx = a.zonen?.x ?? [];
  const zy = a.zonen?.y ?? [];
  const region = (p: Punkt) => `${zx.filter((c) => p.x > c).length}|${zy.filter((c) => p.y > c).length}`;
  const imFeld = (p: Punkt) => ({ x: Math.min(B, Math.max(0, p.x)), y: Math.min(L, Math.max(0, p.y)) });
  const r2 = (v: number) => Math.round(v * 100) / 100;

  const spieler = new Map(a.objekte.flatMap((o) => (o.typ === "spieler" ? [[o.id, o] as const] : [])));
  const ids = [...spieler.keys()];
  const torhueter = new Set(ids.filter((i) => spieler.get(i)!.rolle === "torhueter"));

  // Startpositionen (mit Korrekturen für Schritt 0)
  let pos: Record<string, Punkt> = {};
  for (const i of ids) {
    const o = spieler.get(i)!;
    const k = korrektur.get(`0|${i}`);
    pos[i] = k ? imFeld({ x: o.x + k.x, y: o.y + k.y }) : { x: o.x, y: o.y };
  }
  const objekte = a.objekte.map((o) => (o.typ === "spieler" ? { ...o, x: r2(pos[o.id].x), y: r2(pos[o.id].y) } : o));
  const pos0 = { ...pos };
  const ballO = a.objekte.find((o) => o.typ === "ball");
  let halter: string | null = ballO && ballO.typ === "ball" ? (ballO.bei ?? null) : null;
  let ball: Punkt =
    halter && pos[halter]
      ? pos[halter]
      : ballO && ballO.typ === "ball" && ballO.x !== undefined && ballO.y !== undefined
        ? { x: ballO.x, y: ballO.y }
        : { x: B / 2, y: L / 2 };

  // Linienspieler
  const linie = new Map<string, "senkrecht" | "waagrecht" | "tor" | null>();
  for (const i of ids) {
    const p = pos0[i];
    if (torhueter.has(i)) linie.set(i, "tor");
    else if (p.x < 1.6 || p.x > B - 1.6) linie.set(i, "senkrecht");
    else if (p.y < 1.6 || p.y > L - 1.6) linie.set(i, "waagrecht");
    else linie.set(i, null);
  }

  const startTeam = halter ? spieler.get(halter)!.team : "A";
  let verteidigt: string = startTeam === "B" ? "A" : "B";
  let gegenpressing = 0; // verbleibende Schritte nach Ballverlust

  const schritte = a.schritte.map((schritt, idx) => {
    const n = idx + 1;
    const akt: Aktion[] = schritt.aktionen.map((x) => ({ ...x }));
    const explizit = new Set(akt.flatMap((x) => (x.art === "lauf" || x.art === "dribbling" ? [x.id] : [])));
    const ende: Record<string, Punkt> = { ...pos };
    for (const x of akt) if (x.art === "lauf" || x.art === "dribbling") ende[x.id] = { x: x.x, y: x.y };
    const passSchuss = akt.filter((x): x is PassOderSchuss => x.art === "pass" || x.art === "schuss");
    const passer = new Set(passSchuss.map((x) => x.von));
    const empfaenger = new Set(passSchuss.flatMap((x) => (x.art === "pass" ? [x.zu] : [])));

    // Ballziel E und künftiger Ballhalter
    let E = ball;
    let neuerHalter = halter;
    for (const x of akt) {
      if (x.art === "dribbling") {
        E = ende[x.id];
        neuerHalter = x.id;
      }
    }
    for (const x of akt) {
      if (x.art === "pass") {
        E = ende[x.zu];
        neuerHalter = x.zu;
      } else if (x.art === "schuss") {
        E = { x: x.x, y: x.y };
        neuerHalter = null;
      }
    }

    const istVerteidiger = (i: string) => spieler.get(i)!.team !== "N" && spieler.get(i)!.team === verteidigt;
    const verteidiger = ids.filter(istVerteidiger);
    const angreifer = ids.filter((i) => !istVerteidiger(i));
    const abfangen = passSchuss.some((x) => x.art === "pass" && verteidiger.includes(x.zu));

    const auto = ids.filter((i) => !explizit.has(i) && !(i === halter && !passer.has(i)));
    const nachBall = (l: string[]) => [...l].sort((p, q) => dist(pos[p], E) - dist(pos[q], E));
    const autoV = nachBall(auto.filter((i) => verteidiger.includes(i)));
    const autoA = nachBall(auto.filter((i) => angreifer.includes(i)));

    // Presser: 1, im Gegenpressing 2
    const presser: string[] = [];
    if (!abfangen) {
      const kand = [...verteidiger]
        .sort((p, q) => dist(ende[p], E) - dist(ende[q], E))
        .slice(0, gegenpressing > 0 ? 2 : 1);
      for (const k of kand) if (autoV.includes(k) && !torhueter.has(k)) presser.push(k);
    }
    const gegnerFrei = angreifer.filter(
      (i) => !empfaenger.has(i) && i !== halter && i !== neuerHalter && spieler.get(i)!.team !== "N",
    );
    const zuordnung = new Map<string, string>();
    for (const d of autoV) {
      if (presser.includes(d) || !gegnerFrei.length) continue;
      gegnerFrei.sort((p, q) => dist(pos[p], pos[d]) - dist(pos[q], pos[d]));
      zuordnung.set(d, gegnerFrei.shift()!);
    }

    const geplant: Record<string, Punkt> = {};
    for (const i of ids) if (explizit.has(i) || !auto.includes(i)) geplant[i] = ende[i];

    const kandidaten = (i: string, laengen: number[]): Punkt[] => {
      const p = pos[i];
      const art = linie.get(i);
      const roh: Punkt[] = [];
      if (art === "senkrecht") for (const l of laengen) for (const v of [1, -1]) roh.push({ x: p.x, y: p.y + v * l });
      else if (art === "waagrecht") for (const l of laengen) for (const v of [1, -1]) roh.push({ x: p.x + v * l, y: p.y });
      else if (art === "tor") for (const l of [0.4, 0.7, 1.0]) for (const v of [1, -1]) roh.push({ x: p.x, y: p.y + v * l });
      else
        for (const l of laengen)
          for (let k = 0; k < 16; k++) {
            const w = (2 * Math.PI * k) / 16;
            roh.push({ x: p.x + l * Math.cos(w), y: p.y + l * Math.sin(w) });
          }
      const rand = art ? 0 : 0.8;
      return roh.filter((c) => {
        if (c.x < rand || c.x > B - rand || c.y < rand || c.y > L - rand) return false;
        if (!art && region(c) !== region(p)) return false;
        if (art === "tor" && Math.abs(c.y - pos0[i].y) > 3) return false;
        if (art === "senkrecht" && Math.abs(c.y - pos0[i].y) > 0.22 * L) return false;
        if (art === "waagrecht" && Math.abs(c.x - pos0[i].x) > 0.22 * B) return false;
        return true;
      });
    };

    const zulaessig = (i: string, c: Punkt) => {
      for (const j of ids) if (j !== i && geplant[j] && dist(c, geplant[j]) < 1.5 * m) return false;
      const probe: Record<string, Punkt> = { ...pos, ...geplant, [i]: c };
      return konflikte(pos, probe, ball, passSchuss, ids, torhueter, sicher, new Set([i])).length === 0;
    };

    // Verteidiger: pressen (Gegenpressing: zwei) und Passwege zustellen
    for (const d of autoV) {
      let ziel: Punkt;
      const pi = presser.indexOf(d);
      if (pi >= 0) {
        const rx = pos[d].x - E.x;
        const ry = pos[d].y - E.y;
        let w = Math.atan2(ry, rx);
        if (pi === 1) w += (70 * Math.PI) / 180; // zweiter Presser von der anderen Seite
        const ab = grenze + 0.7 * m;
        ziel = { x: E.x + Math.cos(w) * ab, y: E.y + Math.sin(w) * ab };
      } else if (zuordnung.has(d)) {
        const g = ende[zuordnung.get(d)!];
        const anteil = gegenpressing > 0 ? 0.5 : 0.4;
        ziel = { x: g.x + anteil * (E.x - g.x), y: g.y + anteil * (E.y - g.y) };
      } else {
        ziel = { x: pos[d].x + 0.25 * (E.x - pos[d].x), y: pos[d].y + 0.25 * (E.y - pos[d].y) };
      }
      const laengen =
        gegenpressing > 0
          ? [1, 2, 3, 4, 5].map((f) => f * s)
          : pi >= 0
            ? [1, 1.8, 2.6, 3.4].map((f) => f * s)
            : [1, 1.8, 2.6].map((f) => f * s);
      let best: [number, Punkt] | null = null;
      for (const c of kandidaten(d, laengen)) {
        if (!zulaessig(d, c)) continue;
        const wert = -dist(c, ziel);
        if (!best || wert > best[0]) best = [wert, c];
      }
      if (best) geplant[d] = best[1];
    }

    // Angreifer: Dreieck um den Ballempfänger, übrige Breite und Tiefe
    const empf = neuerHalter;
    // Dreieck: bevorzugt freie Feldspieler (Linienspieler können sich nur entlang der Linie bewegen)
    const naechste = (l: string[]) => l.sort((p, q) => dist(geplant[p] ?? pos[p], E) - dist(geplant[q] ?? pos[q], E));
    const moeglich = angreifer.filter((i) => i !== empf && !torhueter.has(i));
    const stuetzen = [
      ...naechste(moeglich.filter((i) => !linie.get(i))),
      ...naechste(moeglich.filter((i) => linie.get(i))),
    ].slice(0, 2);
    const reihenfolge = [...autoA.filter((i) => stuetzen.includes(i)), ...autoA.filter((i) => !stuetzen.includes(i))];
    for (const i of reihenfolge) {
      const dreieck = stuetzen.includes(i);
      const partner = stuetzen.find((j) => j !== i);
      let best: [number, Punkt] | null = null;
      const laengen = (dreieck ? [1, 1.8, 2.6, 3.4] : [1, 1.8, 2.6]).map((f) => f * s);
      for (const c of kandidaten(i, laengen)) {
        if (!zulaessig(i, c)) continue;
        const gegner = verteidiger.map((j) => geplant[j] ?? pos[j]);
        const offenRaum = Math.min(7 * s, ...gegner.map((g) => dist(c, g)));
        const weg = Math.min(4 * s, ...gegner.map((g) => segDist(g, E, c)));
        const dE = dist(c, E);
        let strafe = 0;
        let wert: number;
        if (dreieck) {
          if (dE < 6 * s) strafe += (6 * s - dE) * 1.5;
          if (dE > 15 * s) strafe += dE - 15 * s;
          if (weg < grenze + 0.3 * m) strafe += 5 * s; // Passweg zum Ballempfänger muss frei sein
          if (partner) {
            const w = winkel(E, c, geplant[partner] ?? pos[partner]);
            if (w < 45) strafe += (45 - w) * 0.15 * s;
            if (w > 135) strafe += (w - 135) * 0.1 * s;
          }
          wert = 1.5 * weg + 0.4 * offenRaum - strafe;
        } else {
          if (dE < 5 * s) strafe += (5 * s - dE) * 1.5;
          if (dE > 22 * s) strafe += dE - 22 * s;
          for (const j of angreifer)
            if (j !== i && geplant[j] && dist(c, geplant[j]) < 5 * s) strafe += (5 * s - dist(c, geplant[j])) * 1.2;
          wert = 0.6 * offenRaum + 1.3 * weg - strafe;
        }
        if (!linie.get(i)) {
          const r = Math.min(c.x, B - c.x, c.y, L - c.y);
          wert -= (r < 2.5 * s ? 2.5 * s - r : 0) + 0.15 * dist(c, pos0[i]);
        }
        wert += 0.05 * dist(c, pos[i]);
        if (!best || wert > best[0]) best = [wert, c];
      }
      if (best) geplant[i] = best[1];
    }

    for (const i of auto) {
      const g = geplant[i];
      if (g && dist(g, pos[i]) > 0.05) akt.push({ art: "lauf", id: i, x: r2(g.x), y: r2(g.y) });
    }
    for (const i of ids) geplant[i] ??= pos[i];

    // Korrekturen aus früheren Durchläufen (Ende dieses Schritts)
    const setze = (i: string, c: Punkt) => {
      geplant[i] = c;
      const vorhanden = akt.find((x) => (x.art === "lauf" || x.art === "dribbling") && x.id === i);
      if (vorhanden && (vorhanden.art === "lauf" || vorhanden.art === "dribbling")) {
        vorhanden.x = r2(c.x);
        vorhanden.y = r2(c.y);
      } else akt.push({ art: "lauf", id: i, x: r2(c.x), y: r2(c.y) });
    };
    for (const i of ids) {
      const k = korrektur.get(`${n}|${i}`);
      if (k && i !== neuerHalter && !(i === halter && !passer.has(i))) setze(i, imFeld({ x: geplant[i].x + k.x, y: geplant[i].y + k.y }));
    }

    // Endkontrolle: Spieler minimal aus dem Passweg schieben
    for (let runde = 0; runde < 6; runde++) {
      const k = konflikte(pos, geplant, ball, passSchuss, ids, torhueter, grenze);
      if (!k.length) break;
      for (const { id, ak } of k) {
        const z = ak.art === "pass" ? geplant[ak.zu] : { x: ak.x, y: ak.y };
        const l = Math.hypot(z.x - ball.x, z.y - ball.y) || 1;
        const nx = -(z.y - ball.y) / l;
        const ny = (z.x - ball.x) / l;
        const seite = (geplant[id].x - ball.x) * nx + (geplant[id].y - ball.y) * ny >= 0 ? 1 : -1;
        // Erst seitlich aus dem Passweg, sonst den Laufweg verkürzen (läuft sonst quer durch den Pass)
        const versuche: Punkt[] = [];
        for (let q = 1; q < 15; q++)
          versuche.push({ x: geplant[id].x + seite * nx * 0.3 * m * q, y: geplant[id].y + seite * ny * 0.3 * m * q });
        for (const f of [0.8, 0.6, 0.4, 0.2, 0])
          versuche.push({ x: pos[id].x + f * (geplant[id].x - pos[id].x), y: pos[id].y + f * (geplant[id].y - pos[id].y) });
        for (const c of versuche) {
          if (c.x < 0 || c.x > B || c.y < 0 || c.y > L) continue;
          const probe = { ...geplant, [id]: c };
          if (!konflikte(pos, probe, ball, passSchuss, ids, torhueter, grenze, new Set([id])).length) {
            setze(id, c);
            break;
          }
        }
      }
    }
    // Was jetzt noch stört, steht schon zu Beginn im Weg: im vorherigen Schritt verschieben
    for (const { id, ak } of konflikte(pos, geplant, ball, passSchuss, ids, torhueter, grenze)) {
      const z = ak.art === "pass" ? geplant[ak.zu] : { x: ak.x, y: ak.y };
      const l = Math.hypot(z.x - ball.x, z.y - ball.y) || 1;
      const nx = -(z.y - ball.y) / l;
      const ny = (z.x - ball.x) / l;
      const seite = (pos[id].x - ball.x) * nx + (pos[id].y - ball.y) * ny >= 0 ? 1 : -1;
      offen.push({ schritt: n - 1, id, dx: seite * nx * 0.6 * m, dy: seite * ny * 0.6 * m });
    }

    // Zustand für den nächsten Schritt
    if (gegenpressing > 0) gegenpressing--;
    pos = geplant;
    if (neuerHalter) {
      ball = pos[neuerHalter];
      const neu = spieler.get(neuerHalter)!.team;
      if (neu === verteidigt) {
        const alt = halter ? spieler.get(halter)!.team : null;
        if (alt && alt !== "N" && alt !== neu) verteidigt = alt;
        else verteidigt = neu === "A" ? "B" : "A";
        gegenpressing = 2;
      }
    } else {
      for (const x of akt) if (x.art === "schuss") ball = { x: x.x, y: x.y };
    }
    halter = neuerHalter;
    return { ...schritt, aktionen: akt };
  });

  return { ...a, objekte, schritte };
}

// ---------------------------------------------------------------------------
// Prüfungen (für Tests und für die Freigabe-Hinweise)
// ---------------------------------------------------------------------------

export type Hinweis = { schritt: number; text: string };

/**
 * Dreiecke: Nach jedem Pass hat der Ballempfänger mindestens zwei anspielbare Mitspieler
 * (inkl. Neutrale) in 4–20 m, deren Passwege frei sind und die nicht auf einer Linie stehen (30–150°).
 * Ausgenommen sind abgefangene Pässe und Empfänger auf einer Aussenlinie (End-/Seitenspieler).
 */
export function dreieckLuecken(a: Animation, verteidigtStart = "B"): Hinweis[] {
  const B = a.feld.breite;
  const L = a.feld.laenge;
  const s = Math.max(B, L) / 30;
  const m = massstab(B, L);
  const spieler = new Map(a.objekte.flatMap((o) => (o.typ === "spieler" ? [[o.id, o] as const] : [])));
  let pos: Record<string, Punkt> = {};
  for (const [i, o] of spieler) pos[i] = { x: o.x, y: o.y };
  let verteidigt = verteidigtStart;
  let halter: string | null = (() => {
    const b = a.objekte.find((o) => o.typ === "ball");
    return b && b.typ === "ball" ? (b.bei ?? null) : null;
  })();
  const aus: Hinweis[] = [];
  a.schritte.forEach((st, idx) => {
    const neu = { ...pos };
    for (const x of st.aktionen) if (x.art === "lauf" || x.art === "dribbling") neu[x.id] = { x: x.x, y: x.y };
    let neuerHalter = halter;
    for (const x of st.aktionen) if (x.art === "dribbling") neuerHalter = x.id;
    for (const x of st.aktionen) {
      if (x.art === "pass") neuerHalter = x.zu;
      if (x.art === "schuss") neuerHalter = null;
    }
    pos = neu;
    let ballgewinn = false;
    if (neuerHalter && halter && spieler.get(neuerHalter)!.team === verteidigt) {
      const alt = spieler.get(halter)!.team;
      verteidigt = alt !== "N" ? alt : verteidigt === "A" ? "B" : "A";
      ballgewinn = true; // abgefangener Pass: zählt nicht als Pass im eigenen Dreieck
    }
    const pass = st.aktionen.find((x) => x.art === "pass");
    const R0 = neuerHalter ? pos[neuerHalter] : null;
    // Ausgenommen: Empfänger auf einer Aussenlinie (End-/Seitenspieler, z. B. Punkt beim Endspieler)
    const aufLinie = R0 ? R0.x < 1.6 || R0.x > B - 1.6 || R0.y < 1.6 || R0.y > L - 1.6 : false;
    if (pass && !ballgewinn && !aufLinie && neuerHalter && spieler.get(neuerHalter)!.team !== verteidigt) {
      const R = pos[neuerHalter];
      const gegner = [...spieler.keys()].filter((i) => spieler.get(i)!.team === verteidigt).map((i) => pos[i]);
      const optionen = [...spieler.keys()].filter(
        (i) =>
          i !== neuerHalter &&
          spieler.get(i)!.team !== verteidigt &&
          dist(pos[i], R) >= 4 * s &&
          dist(pos[i], R) <= 20 * s &&
          gegner.every((g) => segDist(g, R, pos[i]) >= 1.1 * m),
      );
      let dreieck = false;
      for (let p = 0; p < optionen.length && !dreieck; p++)
        for (let q = p + 1; q < optionen.length && !dreieck; q++)
          if (winkel(R, pos[optionen[p]], pos[optionen[q]]) >= 30 && winkel(R, pos[optionen[p]], pos[optionen[q]]) <= 150)
            dreieck = true; // 30–150°: kein Spieler auf derselben Linie (auch nicht gegenüber)
      if (!dreieck) aus.push({ schritt: idx + 1, text: `${neuerHalter} hat kein Dreieck (zwei freie Anspielstationen)` });
    }
    halter = neuerHalter;
  });
  return aus;
}

/**
 * Gegenpressing: Im Schritt nach einem Ballverlust laufen mindestens zwei Spieler des Teams,
 * das den Ball verloren hat, auf den Ball zu, und der Nächste kommt näher heran.
 */
export function gegenpressingLuecken(a: Animation): Hinweis[] {
  const spieler = new Map(a.objekte.flatMap((o) => (o.typ === "spieler" ? [[o.id, o] as const] : [])));
  let pos: Record<string, Punkt> = {};
  for (const [i, o] of spieler) pos[i] = { x: o.x, y: o.y };
  let halter: string | null = (() => {
    const b = a.objekte.find((o) => o.typ === "ball");
    return b && b.typ === "ball" ? (b.bei ?? null) : null;
  })();
  let verlierer: string | null = null;
  const aus: Hinweis[] = [];
  a.schritte.forEach((st, idx) => {
    const neu = { ...pos };
    for (const x of st.aktionen) if (x.art === "lauf" || x.art === "dribbling") neu[x.id] = { x: x.x, y: x.y };
    let neuerHalter = halter;
    for (const x of st.aktionen) if (x.art === "dribbling") neuerHalter = x.id;
    for (const x of st.aktionen) {
      if (x.art === "pass") neuerHalter = x.zu;
      if (x.art === "schuss") neuerHalter = null;
    }
    if (verlierer && halter) {
      const ballVorher = pos[halter];
      const ballNachher = neu[neuerHalter ?? halter] ?? ballVorher;
      const team = [...spieler.keys()].filter((i) => spieler.get(i)!.team === verlierer && spieler.get(i)!.rolle !== "torhueter");
      // Reaktion auf den Ballverlust: Richtung Ballgewinner (Ort des Ballverlusts) oder Ball
      const naeher = team.filter(
        (i) => Math.min(dist(neu[i], ballVorher), dist(neu[i], ballNachher)) < dist(pos[i], ballVorher) - 0.3,
      );
      if (naeher.length < 2) aus.push({ schritt: idx + 1, text: `Nach Ballverlust pressen nur ${naeher.length} Spieler von Team ${verlierer}` });
      verlierer = null;
    }
    if (halter && neuerHalter) {
      const t1 = spieler.get(halter)!.team;
      const t2 = spieler.get(neuerHalter)!.team;
      if (t1 !== "N" && t2 !== "N" && t1 !== t2) verlierer = t1;
    }
    pos = neu;
    halter = neuerHalter;
  });
  return aus;
}
