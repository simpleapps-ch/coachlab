import "server-only";

import { getDocumentProxy } from "unpdf";
import { dokumentAusSeiten, type Dokument, type Seite } from "./aufbereiten";

/** Höchstens so viele Seiten werden gelesen (Schutz vor sehr grossen Dateien). */
export const MAX_SEITEN = 200;

/** PDF lesen und in Abschnitte aufbereiten. Läuft auf dem Server (Netlify-Funktion). */
export async function pdfAufbereiten(bytes: Uint8Array): Promise<{ dokument: Dokument; seiten: number }> {
  const pdf = await getDocumentProxy(bytes);
  try {
    const anzahl = Math.min(pdf.numPages, MAX_SEITEN);
    const seiten: Seite[] = [];
    for (let i = 1; i <= anzahl; i++) {
      const p = await pdf.getPage(i);
      const vp = p.getViewport({ scale: 1 });
      const tc = await p.getTextContent();
      seiten.push({
        breite: vp.width,
        hoehe: vp.height,
        items: tc.items
          .filter((t) => "str" in t)
          .map((t) => ({ s: t.str, x: t.transform[4], y: t.transform[5], h: t.height, w: t.width, eol: t.hasEOL })),
      });
    }
    return { dokument: dokumentAusSeiten(seiten), seiten: pdf.numPages };
  } finally {
    await pdf.cleanup();
  }
}
