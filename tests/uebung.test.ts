import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MINDESTDAUER, TEMPO, alleDauern, alleZustaende, pfeile, schrittDauer, zwischen } from "@/components/animation/engine";
import { uebung, type Uebung } from "@/lib/uebung-schema";

const ORDNER = join(__dirname, "fixtures/uebungen");
export const BEISPIELE: Uebung[] = readdirSync(ORDNER)
  .filter((d) => d.endsWith(".json"))
  .map((d) => uebung.parse(JSON.parse(readFileSync(join(ORDNER, d), "utf8"))));

const roh = () => JSON.parse(readFileSync(join(ORDNER, "rondo-4v2-umschalten.json"), "utf8"));

describe("Übungsschema", () => {
  it("alle Beispielübungen sind gültig", () => {
    expect(BEISPIELE).toHaveLength(3);
  });

  it("fehlende Pflichtfelder werden abgelehnt", () => {
    const u = roh();
    delete u.coachingpunkte;
    expect(uebung.safeParse(u).success).toBe(false);
  });

  it("3 bis 5 Coachingpunkte", () => {
    const u = roh();
    u.coachingpunkte = ["nur einer"];
    expect(uebung.safeParse(u).success).toBe(false);
  });

  it("nur SFV-Stufen", () => {
    const u = roh();
    u.stufen = ["U13"];
    expect(uebung.safeParse(u).success).toBe(false);
  });

  it("Spielerbereich min ≤ max", () => {
    const u = roh();
    u.spieler.min = 20;
    const r = uebung.safeParse(u);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/min darf nicht/);
  });

  it("Feld und Animationsfeld müssen übereinstimmen", () => {
    const u = roh();
    u.feld = "20x20";
    expect(JSON.stringify(uebung.safeParse(u).error?.issues)).toMatch(/passt nicht/);
  });

  it("Animation: unbekannte Spieler und Ziele ausserhalb des Feldes", () => {
    const u = roh();
    u.animation.schritte[0].aktionen[0] = { art: "pass", von: "A1", zu: "X9" };
    u.animation.schritte[1].aktionen[1] = { art: "lauf", id: "B2", x: 30, y: 5 };
    const text = JSON.stringify(uebung.safeParse(u).error?.issues);
    expect(text).toMatch(/Unbekannter Spieler X9/);
    expect(text).toMatch(/ausserhalb des Feldes/);
  });

  it("Animation: doppelte IDs", () => {
    const u = roh();
    u.animation.objekte.push({ id: "A1", typ: "spieler", team: "A", x: 1, y: 1 });
    expect(JSON.stringify(uebung.safeParse(u).error?.issues)).toMatch(/A1 doppelt/);
  });
});

describe("Optionale Details", () => {
  it("Belastung, Regeln, Fehlerbilder, Leitsatz und Team C sind erlaubt", () => {
    const u = roh();
    u.belastung = "4 × 3 Min., 1 Min. Pause";
    u.regeln = ["Neutrale höchstens 2 Ballkontakte"];
    u.fehlerbilder = ["Alle laufen zum Ball"];
    u.leitsatz = "Wer richtig steht, muss weniger laufen.";
    u.animation.objekte.push({ id: "C1", typ: "spieler", team: "C", x: 3, y: 3 });
    const r = uebung.safeParse(u);
    expect(r.success).toBe(true);
    expect(r.data?.regeln).toEqual(["Neutrale höchstens 2 Ballkontakte"]);
  });

  it("ohne Details: leere Listen", () => {
    const r = uebung.parse(roh());
    expect(r.regeln).toEqual([]);
    expect(r.fehlerbilder).toEqual([]);
  });

  it("höchstens 6 Fehlerbilder", () => {
    const u = roh();
    u.fehlerbilder = Array.from({ length: 7 }, (_, i) => `Fehler ${i}`);
    expect(uebung.safeParse(u).success).toBe(false);
  });
});

describe("Animations-Engine", () => {
  const rondo = BEISPIELE.find((u) => u.id === "rondo-4v2-umschalten")!;
  const zustaende = alleZustaende(rondo.animation);

  it("ein Zustand pro Schritt plus Start", () => {
    expect(zustaende).toHaveLength(rondo.animation.schritte.length + 1);
  });

  it("Ball wandert mit den Pässen", () => {
    expect(zustaende[0].ballBei).toBe("A1");
    expect(zustaende[1].ballBei).toBe("A2");
    expect(zustaende[2].ballBei).toBe("A3");
    expect(zustaende[3].ballBei).toBe("B2");
  });

  it("beim Dribbling bewegen sich Spieler und Ball gemeinsam", () => {
    const ende = zustaende[4];
    expect(ende.pos.B2).toEqual({ x: 9.5, y: 8.5 });
    expect(ende.ball).toEqual({ x: 9.5, y: 8.5 });
  });

  it("Zwischenzustand liegt zwischen Start und Ende", () => {
    const s = rondo.animation.schritte[0];
    const mitte = zwischen(zustaende[0], zustaende[1], s, 0.5);
    expect(mitte.pos.B1.y).toBeGreaterThan(3.5);
    expect(mitte.pos.B1.y).toBeLessThan(6.5);
    expect(zwischen(zustaende[0], zustaende[1], s, 1).pos.B1).toEqual({ x: 5, y: 3.5 });
  });

  it("Pass kommt beim Empfänger an, auch wenn dieser gleichzeitig läuft", () => {
    const dreieck = BEISPIELE.find((u) => u.id === "passdreieck-nachlaufen")!;
    const z = alleZustaende(dreieck.animation);
    expect(z[3].ballBei).toBe("A4");
    expect(z[3].ball).toEqual({ x: 2, y: 12 });
    const p = pfeile(z[2], z[3], dreieck.animation.schritte[2]).find((x) => x.art === "pass")!;
    expect(p.nach).toEqual({ x: 2, y: 12 });
  });

  it("Schuss: Ball verlässt den Spieler", () => {
    const tor = BEISPIELE.find((u) => u.id === "2-gegen-1-auf-tor")!;
    const z = alleZustaende(tor.animation);
    const ende = z[z.length - 1];
    expect(ende.ballBei).toBeNull();
    expect(ende.ball).toEqual({ x: 8.2, y: 0 });
  });
});

describe("Massstab im Spielfeld", () => {
  it("kleine Felder unverändert, grosse Felder grössere Spieler", async () => {
    const { massstab } = await import("@/components/animation/spielfeld");
    expect(massstab(20, 15)).toBe(1);
    expect(massstab(30, 20)).toBe(1);
    expect(massstab(60, 45)).toBe(2);
  });
});

describe("Darstellungstempo", () => {
  it("Pässe fliegen höchstens mit dem Darstellungstempo", () => {
    for (const u of BEISPIELE) {
      const z = alleZustaende(u.animation);
      u.animation.schritte.forEach((s, i) => {
        const d = schrittDauer(z[i], z[i + 1], s);
        for (const ak of s.aktionen) {
          if (ak.art !== "pass") continue;
          const a = z[i].pos[ak.von];
          const b = z[i + 1].pos[ak.zu];
          expect(Math.hypot(b.x - a.x, b.y - a.y) / d).toBeLessThanOrEqual(TEMPO.pass + 0.3);
        }
      });
    }
  });

  it("jeder Schritt dauert mindestens die Mindestdauer und nie weniger als angegeben", () => {
    for (const u of BEISPIELE) {
      alleDauern(u.animation).forEach((d, i) => {
        expect(d).toBeGreaterThanOrEqual(MINDESTDAUER);
        expect(d).toBeGreaterThanOrEqual(u.animation.schritte[i].dauer);
      });
    }
  });
});
