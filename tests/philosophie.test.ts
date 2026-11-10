import { describe, expect, it } from "vitest";
import { dokumentAusSeiten, type Seite, type Stueck } from "@/lib/philosophie/aufbereiten";
import { philosophieDokument } from "@/lib/philosophie/schema";

/**
 * Erkennung von Abschnitten aus einer Foliensammlung (synthetische Folien 960x540,
 * Aufbau wie ein Export aus Google Slides: vor jedem Absatz ein leeres Stück).
 */

const absatz = (x: number, y: number, h: number, ...zeilen: string[]): Stueck[] => [
  { s: "", x, y, h: 0, w: 0, eol: true },
  ...zeilen.map((s, i) => ({ s, x, y: y - i * h * 1.2, h, w: s.length * h * 0.5, eol: i < zeilen.length - 1 })),
];
const fuss = (n: number): Stueck[] => [
  { s: "FC Test · Philosophie", x: 43, y: 21, h: 10, w: 120, eol: false },
  ...absatz(905, 23, 10, String(n)),
];
const seite = (...items: Stueck[][]): Seite => ({ breite: 960, hoehe: 540, items: items.flat() });

const SEITEN: Seite[] = [
  seite(absatz(57, 340, 52, "Spielphilosophie"), absatz(57, 205, 18, "Ein roter Faden von G bis A")),
  seite(fuss(2), absatz(43, 470, 34, "Warum eine Philosophie?"),
    absatz(65, 372, 22, "1"), absatz(65, 340, 18, "Eine Sprache"), absatz(65, 300, 14, "Alle Trainer verwenden", "dieselben Begriffe."),
    absatz(360, 372, 22, "2"), absatz(360, 340, 18, "Ein roter Faden"), absatz(360, 300, 14, "Jede Stufe baut auf", "der vorherigen auf."),
    absatz(65, 120, 14, "Unser Ziel: Kinder, die gerne Fussball spielen.")),
  seite([{ s: "A", x: 93, y: 312, h: 22, w: 15, eol: false }, { s: " ", x: 108, y: 312, h: 0, w: 5, eol: false }, { s: "Spielidee", x: 158, y: 324, h: 40, w: 200, eol: false }],
    absatz(158, 285, 18, "Wie wir Fussball spielen wollen")),
  seite(fuss(4), absatz(43, 470, 34, "Im Training"),
    [{ s: "", x: 45, y: 378, h: 0, w: 0, eol: true }, { s: "•", x: 45, y: 378, h: 15, w: 5, eol: false }, { s: "Jedes Kind hat einen Ball", x: 70, y: 378, h: 15, w: 200, eol: true },
      { s: "•", x: 45, y: 354, h: 15, w: 5, eol: false }, { s: "Viel 1 gegen 1 und kleine", x: 70, y: 354, h: 15, w: 200, eol: true }, { s: "Spiele auf Tore", x: 70, y: 336, h: 15, w: 120, eol: false }]),
  seite(fuss(5), absatz(43, 470, 34, "Glossar"),
    [{ s: "", x: 51, y: 400, h: 0, w: 0, eol: true }, { s: "Dreieck", x: 51, y: 400, h: 14, w: 50, eol: false }, { s: "Drei Spieler auf unterschiedlichen Höhen", x: 296, y: 400, h: 14, w: 280, eol: false }],
    [{ s: "", x: 51, y: 362, h: 0, w: 0, eol: true }, { s: "Schulterblick", x: 51, y: 362, h: 14, w: 90, eol: false }, { s: "Vor der Ballannahme umschauen", x: 296, y: 362, h: 14, w: 200, eol: false }]),
];

describe("Philosophie aus PDF aufbereiten", () => {
  const d = dokumentAusSeiten(SEITEN);

  it("Titelseite, Kapitel und Abschnitte", () => {
    expect(d.titel).toBe("Spielphilosophie");
    expect(d.untertitel).toBe("Ein roter Faden von G bis A");
    expect(d.kapitel).toEqual([{ nr: 1, zeichen: "A", titel: "Spielidee", untertitel: "Wie wir Fussball spielen wollen" }]);
    expect(d.abschnitte.map((a) => [a.titel, a.kapitel])).toEqual([
      ["Warum eine Philosophie?", null],
      ["Im Training", 1],
      ["Glossar", 1],
    ]);
    expect(philosophieDokument.safeParse(d).success).toBe(true);
  });

  it("nummerierte Karten mit Titel und Text, Fusszeile entfernt", () => {
    const [karten, ziel] = d.abschnitte[0].bloecke;
    expect(karten).toEqual({
      art: "karten",
      karten: [
        { marke: "1", titel: "Eine Sprache", inhalt: [{ art: "text", text: "Alle Trainer verwenden dieselben Begriffe." }] },
        { marke: "2", titel: "Ein roter Faden", inhalt: [{ art: "text", text: "Jede Stufe baut auf der vorherigen auf." }] },
      ],
    });
    expect(ziel).toEqual({ art: "text", text: "Unser Ziel: Kinder, die gerne Fussball spielen." });
    expect(JSON.stringify(d)).not.toContain("FC Test · Philosophie");
  });

  it("Aufzählung: Folgezeilen gehören zum Punkt", () => {
    expect(d.abschnitte[1].bloecke).toEqual([
      { art: "liste", punkte: ["Jedes Kind hat einen Ball", "Viel 1 gegen 1 und kleine Spiele auf Tore"] },
    ]);
  });

  it("Zweispaltige Zeilen werden eine Tabelle", () => {
    expect(d.abschnitte[2].bloecke).toEqual([
      {
        art: "tabelle",
        zeilen: [
          ["Dreieck", "Drei Spieler auf unterschiedlichen Höhen"],
          ["Schulterblick", "Vor der Ballannahme umschauen"],
        ],
      },
    ]);
  });

  it("ein PDF ohne Text ergibt kein gültiges Dokument", () => {
    const leer = dokumentAusSeiten([seite([])]);
    expect(philosophieDokument.safeParse(leer).success).toBe(false);
  });
});
