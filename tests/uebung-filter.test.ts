import { describe, expect, it } from "vitest";
import { filterAlsQuery, filterLesen, passt } from "@/lib/uebung-filter";

const rondo = {
  stufen: ["E", "D", "C"],
  spieler_min: 6,
  spieler_max: 18,
  mit_torhueter: false,
  kategorie: "Taktik",
  spielphase: "Umschalten",
  intensitaet: "hoch",
  dauer_min: 15,
};

describe("Übungsfilter", () => {
  it("liest teilbare Links", () => {
    const f = filterLesen({ stufe: ["D", "E"], spieler: "14", kategorie: "Taktik", q: " pressing " });
    expect(f).toMatchObject({ stufen: ["D", "E"], spieler: 14, kategorien: ["Taktik"], q: "pressing" });
    expect(filterAlsQuery(f)).toBe("?stufe=D&stufe=E&spieler=14&kategorie=Taktik&q=pressing");
  });

  it("ignoriert ungültige Werte", () => {
    const f = filterLesen({ stufe: ["U13", "D"], spieler: "abc", kategorie: "Gibts nicht", dauer: "999" });
    expect(f).toMatchObject({ stufen: ["D"], spieler: undefined, kategorien: [], dauerMax: undefined });
  });

  it("Spielerzahl: min ≤ n ≤ max", () => {
    expect(passt(rondo, filterLesen({ spieler: "14" }))).toBe(true);
    expect(passt(rondo, filterLesen({ spieler: "6" }))).toBe(true);
    expect(passt(rondo, filterLesen({ spieler: "5" }))).toBe(false);
    expect(passt(rondo, filterLesen({ spieler: "19" }))).toBe(false);
  });

  it("Stufen: Mehrfachauswahl, eine Übereinstimmung genügt", () => {
    expect(passt(rondo, filterLesen({ stufe: ["G", "D"] }))).toBe(true);
    expect(passt(rondo, filterLesen({ stufe: ["G", "F"] }))).toBe(false);
  });

  it("mit Torhüter", () => {
    expect(passt(rondo, filterLesen({ torhueter: "1" }))).toBe(false);
    expect(passt({ ...rondo, mit_torhueter: true }, filterLesen({ torhueter: "1" }))).toBe(true);
  });
});
