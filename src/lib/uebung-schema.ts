import { z } from "zod";

/**
 * Pflichtformat einer Übung (Projektplan, «Inhaltsmodell»).
 * Gleiches Schema prüft im Claude-Connector, in der Website und in den Tests.
 * Fehlt ein Pflichtfeld, wird nichts gespeichert.
 */

export const SFV_STUFEN = ["G", "F", "E", "D", "C", "B", "A", "Aktive"] as const;
export const SFV_ALTER: Record<(typeof SFV_STUFEN)[number], string> = {
  G: "U7",
  F: "U9",
  E: "U11",
  D: "U13",
  C: "U15",
  B: "U17",
  A: "U19",
  Aktive: "Aktive",
};
export const KATEGORIEN = ["Technik", "Taktik", "Athletik", "Torhüter", "Spielform"] as const;
export const SPIELPHASEN = [
  "Ballbesitz",
  "Gegnerischer Ballbesitz",
  "Umschalten",
  "Standard",
] as const;
export const INTENSITAETEN = ["tief", "mittel", "hoch"] as const;
export const TEAMS = ["A", "B", "N"] as const; // N = neutral / Anspieler

const text = (max = 400) => z.string().trim().min(1).max(max);
const punkte = (min: number, max: number) => z.array(text()).min(min).max(max);

// ---------------------------------------------------------------------------
// Animation: Koordinaten in Metern, Ursprung oben links, x nach rechts, y nach unten.
// ---------------------------------------------------------------------------

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,15}$/, "Kurze ID wie A1, B2, ball, h1");
const meter = z.number().finite().min(0).max(120);

const spielerObjekt = z.object({
  id,
  typ: z.literal("spieler"),
  team: z.enum(TEAMS),
  x: meter,
  y: meter,
  rolle: z.enum(["feld", "torhueter"]).default("feld"),
});
const ballObjekt = z.object({
  id,
  typ: z.literal("ball"),
  bei: id.optional(),
  x: meter.optional(),
  y: meter.optional(),
});
const huetchenObjekt = z.object({ id, typ: z.literal("huetchen"), x: meter, y: meter });
const torObjekt = z.object({
  id,
  typ: z.literal("tor"),
  x: meter,
  y: meter,
  breite: z.number().min(0.5).max(7.32).default(2),
  ausrichtung: z.enum(["oben", "unten", "links", "rechts"]).default("oben"),
});

export const animationsObjekt = z.discriminatedUnion("typ", [
  spielerObjekt,
  ballObjekt,
  huetchenObjekt,
  torObjekt,
]);

export const aktion = z.discriminatedUnion("art", [
  z.object({ art: z.literal("pass"), von: id, zu: id }),
  z.object({ art: z.literal("lauf"), id, x: meter, y: meter }),
  z.object({ art: z.literal("dribbling"), id, x: meter, y: meter }),
  z.object({ art: z.literal("schuss"), von: id, x: meter, y: meter }),
]);

export const schritt = z.object({
  dauer: z.number().min(0.3).max(10),
  text: text(200),
  aktionen: z.array(aktion).min(1).max(8),
});

export const animation = z
  .object({
    feld: z.object({
      breite: z.number().min(5).max(75),
      laenge: z.number().min(5).max(110),
      ansicht: z.enum(["ausschnitt", "halbfeld", "ganzfeld"]).default("ausschnitt"),
    }),
    objekte: z.array(animationsObjekt).min(1).max(40),
    schritte: z.array(schritt).min(1).max(30),
  })
  .superRefine((a, ctx) => {
    const ids = new Map<string, string>();
    a.objekte.forEach((o, i) => {
      if (ids.has(o.id)) {
        ctx.addIssue({ code: "custom", path: ["objekte", i, "id"], message: `ID ${o.id} doppelt` });
      }
      ids.set(o.id, o.typ);
    });
    const imFeld = (x: number, y: number) => x <= a.feld.breite && y <= a.feld.laenge;
    const spieler = (s: string) => ids.get(s) === "spieler";

    a.objekte.forEach((o, i) => {
      if (o.typ === "ball") {
        if (o.bei ? !spieler(o.bei) : o.x === undefined || o.y === undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["objekte", i],
            message: "Ball braucht «bei» (Spieler-ID) oder x und y",
          });
        }
      }
      if ("x" in o && o.x !== undefined && "y" in o && o.y !== undefined && !imFeld(o.x, o.y)) {
        ctx.addIssue({ code: "custom", path: ["objekte", i], message: `${o.id} liegt ausserhalb des Feldes` });
      }
    });
    if (a.objekte.filter((o) => o.typ === "ball").length > 1) {
      ctx.addIssue({ code: "custom", path: ["objekte"], message: "Nur ein Ball pro Animation" });
    }

    a.schritte.forEach((s, si) =>
      s.aktionen.forEach((ak, ai) => {
        const pfad = ["schritte", si, "aktionen", ai];
        const pruefe = (sid: string) => {
          if (!spieler(sid)) ctx.addIssue({ code: "custom", path: pfad, message: `Unbekannter Spieler ${sid}` });
        };
        if (ak.art === "pass") {
          pruefe(ak.von);
          pruefe(ak.zu);
        }
        if (ak.art === "schuss") pruefe(ak.von);
        if (ak.art === "lauf" || ak.art === "dribbling") pruefe(ak.id);
        if ("x" in ak && !imFeld(ak.x, ak.y)) {
          ctx.addIssue({ code: "custom", path: pfad, message: "Ziel liegt ausserhalb des Feldes" });
        }
      }),
    );
  });

// ---------------------------------------------------------------------------
// Übung
// ---------------------------------------------------------------------------

export const uebungsSlug = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])$/, "Kleinbuchstaben, Ziffern, Bindestriche, z. B. rondo-4v2-pressing");

export const uebung = z
  .object({
    id: uebungsSlug,
    titel: text(120),
    stufen: z.array(z.enum(SFV_STUFEN)).min(1).max(8),
    spieler: z.object({
      min: z.number().int().min(1).max(40),
      max: z.number().int().min(1).max(40),
      mit_torhueter: z.boolean(),
      skalierung: text(200).optional(),
    }),
    kategorie: z.enum(KATEGORIEN),
    spielphase: z.enum(SPIELPHASEN),
    prinzipien: z.array(uebungsSlug).max(10).default([]),
    ziel: text(300),
    feld: z.string().regex(/^\d{1,3}x\d{1,3}$/, "Format BreitexLänge in Metern, z. B. 12x12"),
    dauer_min: z.number().int().min(1).max(120),
    intensitaet: z.enum(INTENSITAETEN),
    material: punkte(1, 15),
    aufbau: punkte(1, 10),
    ablauf: punkte(1, 12),
    coachingpunkte: punkte(3, 5),
    varianten: z.object({ leichter: punkte(1, 3), schwerer: punkte(1, 3) }),
    animation,
    quelle: z.string().max(500).optional(),
    zu_pruefen: z.array(text(200)).max(20).default([]),
  })
  .superRefine((u, ctx) => {
    if (u.spieler.min > u.spieler.max) {
      ctx.addIssue({ code: "custom", path: ["spieler", "min"], message: "min darf nicht grösser als max sein" });
    }
    const [b, l] = u.feld.split("x").map(Number);
    if (b !== u.animation.feld.breite || l !== u.animation.feld.laenge) {
      ctx.addIssue({
        code: "custom",
        path: ["animation", "feld"],
        message: `Animationsfeld (${u.animation.feld.breite}x${u.animation.feld.laenge}) passt nicht zu feld ${u.feld}`,
      });
    }
  });

export type Uebung = z.infer<typeof uebung>;
export type Animation = z.infer<typeof animation>;
export type AnimationsObjekt = z.infer<typeof animationsObjekt>;
export type Aktion = z.infer<typeof aktion>;
export type Schritt = z.infer<typeof schritt>;
