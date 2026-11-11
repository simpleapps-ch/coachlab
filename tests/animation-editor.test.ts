import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aktionEntfernen,
  ballVorSchritt,
  balltempoSetzen,
  type Balltempo,
  bewegungEntfernen,
  bewegungSetzen,
  feldAendern,
  grenzenLesen,
  insFeld,
  neueId,
  objektEntfernen,
  objektHinzufuegen,
  passSetzen,
  schrittDuplizieren,
  schrittEinfuegen,
  schrittLoeschen,
  schrittVerschieben,
  schussSetzen,
  startSetzen,
  zonenAendern,
} from "@/components/animation/bearbeiten";
import { alleZustaende, BALLFAKTOR, schrittDauer, TEMPO } from "@/components/animation/engine";
import { uebungPruefen } from "@/lib/mcp/pruefen";
import { animation as animationSchema, uebung, type Animation } from "@/lib/uebung-schema";

const ORDNER = join(__dirname, "fixtures/uebungen");
const rondo = () => uebung.parse(JSON.parse(readFileSync(join(ORDNER, "rondo-4v2-umschalten.json"), "utf8")));

/** Kleine, übersichtliche Animation für die Tests. */
function klein(): Animation {
  return animationSchema.parse({
    feld: { breite: 20, laenge: 20 },
    objekte: [
      { id: "A1", typ: "spieler", team: "A", x: 2, y: 2 },
      { id: "A2", typ: "spieler", team: "A", x: 18, y: 2 },
      { id: "B1", typ: "spieler", team: "B", x: 10, y: 15 },
      { id: "ball", typ: "ball", bei: "A1" },
      { id: "h1", typ: "huetchen", x: 0, y: 0 },
    ],
    automatik: false,
    schritte: [
      { dauer: 2, text: "Pass", aktionen: [{ art: "pass", von: "A1", zu: "A2" }] },
      { dauer: 2, text: "Lauf", aktionen: [{ art: "lauf", id: "B1", x: 12, y: 8 }] },
    ],
  });
}

describe("Animations-Editor: Bearbeitungsfunktionen", () => {
  it("verändert die alte Fassung nie (Rückgängig)", () => {
    const a = klein();
    const kopie = structuredClone(a);
    bewegungSetzen(a, 0, "A1", { x: 5, y: 5 });
    startSetzen(a, "A2", { x: 1, y: 1 });
    objektEntfernen(a, "A1");
    schrittLoeschen(a, 0);
    expect(a).toEqual(kopie);
  });

  it("holt Punkte ins Feld und rundet auf 10 cm", () => {
    expect(insFeld(klein(), { x: -3, y: 25.04 })).toEqual({ x: 0, y: 20 });
    expect(insFeld(klein(), { x: 3.456, y: 7.04 })).toEqual({ x: 3.5, y: 7 });
  });

  it("legt den Ball einem Spieler vor die Füsse, wenn man ihn auf ihn zieht", () => {
    const a = startSetzen(klein(), "ball", { x: 17.6, y: 2.5 });
    expect(a.objekte.find((o) => o.id === "ball")).toEqual({ id: "ball", typ: "ball", bei: "A2" });
    const frei = startSetzen(a, "ball", { x: 10, y: 10 });
    expect(frei.objekte.find((o) => o.id === "ball")).toEqual({ id: "ball", typ: "ball", x: 10, y: 10 });
  });

  it("Laufweg mit Ball wird zum Dribbling, ohne Ball zum Lauf; ein neuer ersetzt den alten", () => {
    let a = bewegungSetzen(klein(), 0, "A1", { x: 5, y: 5 });
    expect(a.schritte[0].aktionen).toContainEqual({ art: "dribbling", id: "A1", x: 5, y: 5 });
    a = bewegungSetzen(a, 0, "A1", { x: 6, y: 6 });
    expect(a.schritte[0].aktionen.filter((ak) => ak.art === "dribbling")).toHaveLength(1);
    a = bewegungSetzen(a, 1, "A1", { x: 3, y: 3 });
    expect(a.schritte[1].aktionen).toContainEqual({ art: "lauf", id: "A1", x: 3, y: 3 });
    a = bewegungEntfernen(a, 1, "A1");
    expect(a.schritte[1].aktionen.some((ak) => "id" in ak && ak.id === "A1")).toBe(false);
  });

  it("Pass und Schuss gehen vom Ballführenden aus und ersetzen einander", () => {
    const a = klein();
    expect(ballVorSchritt(a, 1)).toBe("A2");
    const pass = passSetzen(a, 1, "A1");
    expect(pass.ok && pass.animation.schritte[1].aktionen).toContainEqual({ art: "pass", von: "A2", zu: "A1" });
    if (!pass.ok) throw new Error();
    const schuss = schussSetzen(pass.animation, 1, { x: 10, y: 0 });
    if (!schuss.ok) throw new Error();
    expect(schuss.animation.schritte[1].aktionen.filter((ak) => ak.art === "pass" || ak.art === "schuss")).toEqual([
      { art: "schuss", von: "A2", x: 10, y: 0 },
    ]);
    expect(passSetzen(a, 1, "A2")).toMatchObject({ ok: false });
    const ohneBall = schuss.animation;
    expect(passSetzen(ohneBall, 1, "B1").ok).toBe(true); // in Schritt 2 hat A2 den Ball weiterhin zu Beginn
  });

  it("neue Objekte bekommen freie IDs und liegen nicht aufeinander", () => {
    const a = klein();
    expect(neueId(a, "A")).toBe("A3");
    const r1 = objektHinzufuegen(a, { typ: "spieler", team: "A" });
    const r2 = objektHinzufuegen(r1.animation, { typ: "spieler", team: "A" });
    expect([r1.id, r2.id]).toEqual(["A3", "A4"]);
    const [p, q] = ["A3", "A4"].map((id) => r2.animation.objekte.find((o) => o.id === id) as { x: number; y: number });
    expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(1);
    expect(objektHinzufuegen(a, { typ: "ball" }).id).toBeNull(); // nur ein Ball
    expect(animationSchema.safeParse(r2.animation).success).toBe(true);
  });

  it("Entfernen eines Spielers räumt Aktionen und Ball auf", () => {
    const a = objektEntfernen(klein(), "A1");
    expect(a.objekte.find((o) => o.id === "ball")).toEqual({ id: "ball", typ: "ball", x: 2, y: 2 });
    expect(a.schritte[0].aktionen).toEqual([]);
    expect(aktionEntfernen(klein(), 1, 0).schritte[1].aktionen).toEqual([]);
  });

  it("Schritte einfügen, duplizieren, verschieben und löschen", () => {
    const a = klein();
    expect(schrittEinfuegen(a, 0).schritte.map((s) => s.text)).toEqual(["Pass", "Neuer Schritt", "Lauf"]);
    expect(schrittDuplizieren(a, 1).schritte.map((s) => s.text)).toEqual(["Pass", "Lauf", "Lauf"]);
    expect(schrittVerschieben(a, 0, 1).schritte.map((s) => s.text)).toEqual(["Lauf", "Pass"]);
    expect(schrittVerschieben(a, 0, -1)).toBe(a);
    const einer = schrittLoeschen(a, 0);
    expect(einer.schritte).toHaveLength(1);
    expect(schrittLoeschen(einer, 0)).toBe(einer); // mindestens ein Schritt bleibt
  });

  it("kleineres Feld holt Objekte, Ziele und Zonen hinein", () => {
    const a = feldAendern(zonenAendern(klein(), { x: [10, 15] }), 12.4, 14);
    expect(a.feld).toMatchObject({ breite: 12, laenge: 14 });
    expect(a.objekte.find((o) => o.id === "A2")).toMatchObject({ x: 12, y: 2 });
    expect(a.zonen?.x).toEqual([10]);
    expect(animationSchema.safeParse(a).success).toBe(true);
  });

  it("liest Zonengrenzen tolerant", () => {
    expect(grenzenLesen("20; 10, 10 abc 35 0", 30)).toEqual([10, 20]);
    expect(zonenAendern(klein(), { x: [] }).zonen).toBeUndefined();
  });

  it("bearbeitete Beispielübung besteht die gleiche Prüfung wie beim Connector", () => {
    const u = rondo();
    const halter = ballVorSchritt(u.animation, 0)!;
    const a = bewegungSetzen(u.animation, 0, halter, u.animation.objekte.find((o) => o.id === halter) as { x: number; y: number });
    const p = uebungPruefen({ ...u, animation: a });
    expect(p.ok).toBe(true);
    expect(alleZustaende(a)).toHaveLength(a.schritte.length + 1);
  });

  it("ein leerer neuer Schritt blockiert das Speichern, bis er eine Aktion hat", () => {
    const u = rondo();
    const a = schrittEinfuegen(u.animation, u.animation.schritte.length - 1);
    expect(uebungPruefen({ ...u, animation: a }).ok).toBe(false);
  });
});

describe("Ballgeschwindigkeit", () => {
  it("bestimmt die Schrittdauer: scharf schneller als mittel, langsam langsamer", () => {
    const a = klein(); // Pass A1 → A2 über 16 m
    const z = alleZustaende(a);
    const dauer = (t?: Balltempo) => schrittDauer(z[0], z[1], balltempoSetzen(a, 0, t).schritte[0]);
    expect(dauer()).toBe(Math.max(2, Math.round((16 / TEMPO.pass) * 10) / 10)); // Auto wie bisher
    expect(dauer("mittel")).toBeCloseTo(16 / TEMPO.pass, 1);
    expect(dauer("scharf")).toBeCloseTo(16 / (TEMPO.pass * BALLFAKTOR.scharf), 1);
    expect(dauer("scharf")).toBeLessThan(dauer("mittel"));
    expect(dauer("langsam")).toBeGreaterThan(dauer("mittel"));
  });

  it("wird im Format akzeptiert, bleibt beim Ersetzen des Passes erhalten und lässt sich entfernen", () => {
    const a = balltempoSetzen(klein(), 1, "scharf");
    expect(a.schritte[1].aktionen.some((ak) => "tempo" in ak)).toBe(false); // Schritt 2 hat keinen Pass
    const b = balltempoSetzen(klein(), 0, "scharf");
    expect(animationSchema.safeParse(b).success).toBe(true);
    const r = passSetzen(b, 0, "B1");
    expect(r.ok && r.animation.schritte[0].aktionen).toContainEqual({ art: "pass", von: "A1", zu: "B1", tempo: "scharf" });
    expect(balltempoSetzen(b, 0, undefined).schritte[0].aktionen[0]).toEqual({ art: "pass", von: "A1", zu: "A2" });
    expect(animationSchema.safeParse({ ...b, schritte: [{ ...b.schritte[0], aktionen: [{ art: "pass", von: "A1", zu: "A2", tempo: "rasend" }] }] }).success).toBe(false);
  });
});
