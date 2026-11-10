import { z } from "zod";

/**
 * Format der aufbereiteten Philosophie (Spalte philosophien.dokument).
 * Gleiche Struktur wie dokumentAusSeiten() in aufbereiten.ts.
 */
const text = z.string().trim().min(1).max(4000);
const kurz = z.string().trim().min(1).max(300);

export const inhalt = z.discriminatedUnion("art", [
  z.object({ art: z.literal("text"), text }),
  z.object({ art: z.literal("feld"), name: kurz, wert: text }),
  z.object({ art: z.literal("liste"), punkte: z.array(text).min(1).max(50) }),
  z.object({ art: z.literal("zitat"), text }),
]);

export const karte = z.object({
  marke: kurz.optional(),
  titel: kurz.optional(),
  inhalt: z.array(inhalt).max(30),
});

export const block = z.discriminatedUnion("art", [
  ...inhalt.options,
  z.object({ art: z.literal("zwischentitel"), text: kurz }),
  z.object({ art: z.literal("leitsatz"), text }),
  z.object({ art: z.literal("label"), text: kurz }),
  z.object({ art: z.literal("karten"), karten: z.array(karte).min(1).max(20) }),
  z.object({ art: z.literal("tabelle"), zeilen: z.array(z.array(z.string().max(1000)).min(1).max(8)).min(1).max(60) }),
  z.object({
    art: z.literal("nummern"),
    punkte: z.array(z.object({ nr: kurz, titel: kurz, text: text.optional() })).min(1).max(30),
  }),
]);

export const abschnitt = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,70}$/),
  seite: z.number().int().min(1).max(300),
  kapitel: z.number().int().min(1).max(30).nullable(),
  titel: kurz,
  bloecke: z.array(block).max(60),
});

export const philosophieDokument = z
  .object({
    titel: kurz,
    untertitel: kurz.optional(),
    kapitel: z
      .array(z.object({ nr: z.number().int().min(1), zeichen: z.string().max(3), titel: kurz, untertitel: kurz.optional() }))
      .max(30),
    abschnitte: z.array(abschnitt).min(1, "Im PDF wurde kein lesbarer Text gefunden.").max(300),
  })
  .superRefine((d, ctx) => {
    const ids = new Set<string>();
    d.abschnitte.forEach((a, i) => {
      if (ids.has(a.id)) ctx.addIssue({ code: "custom", path: ["abschnitte", i, "id"], message: `ID ${a.id} doppelt` });
      ids.add(a.id);
      if (a.kapitel !== null && !d.kapitel.some((k) => k.nr === a.kapitel)) {
        ctx.addIssue({ code: "custom", path: ["abschnitte", i, "kapitel"], message: "Kapitel fehlt" });
      }
    });
  });

export type PhilosophieDokument = z.infer<typeof philosophieDokument>;
export type PhilosophieBlock = z.infer<typeof block>;
export type PhilosophieInhalt = z.infer<typeof inhalt>;
