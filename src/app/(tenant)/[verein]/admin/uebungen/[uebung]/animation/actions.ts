"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SpeichernErgebnis } from "@/components/animation/editor";
import { uebungPruefen } from "@/lib/mcp/pruefen";
import { slug as vereinsSlug, uebungsSlug } from "@/lib/schema";
import { createClient } from "@/lib/supabase/server";
import { ladeUebung } from "@/lib/uebungen";
import { nurVerwalter } from "@/lib/verein";

/**
 * Speichert die Animation aus dem Editor. Gleiche Prüfung wie beim Connector
 * (Pflichtformat + Animationsstandard); die Übung wird dabei immer zum Entwurf.
 * «stand» schützt vor dem Überschreiben, wenn jemand die Übung inzwischen geändert hat.
 */

const eingabe = z.object({
  verein: vereinsSlug,
  uebung: uebungsSlug,
  stand: z.string().min(1),
  animation: z.unknown(),
});


export async function animationSpeichern(daten: { verein: string; uebung: string; stand: string; animation: unknown }): Promise<SpeichernErgebnis> {
  const e = eingabe.safeParse(daten);
  if (!e.success) return { ok: false, fehler: ["Ungültige Anfrage."] };
  const { verein, uebung: slug, stand, animation } = e.data;
  const zg = await nurVerwalter(verein);

  const alt = await ladeUebung(zg.verein.id, slug);
  if (!alt) return { ok: false, fehler: ["Die Übung gibt es nicht mehr."] };
  if (!alt.ok) return { ok: false, fehler: ["Die Übung entspricht nicht dem Pflichtformat.", ...alt.fehler] };
  if (alt.karte.geaendert_am !== stand) {
    return {
      ok: false,
      fehler: ["Die Übung wurde inzwischen geändert (z. B. über Claude). Lade die Seite neu; deine Änderungen gehen dabei verloren."],
    };
  }

  // Die Feldgrösse der Übung folgt dem Animationsfeld («BreitexLänge»).
  const feld = (animation as { feld?: { breite?: unknown; laenge?: unknown } } | null)?.feld;
  const neu = { ...alt.uebung, animation, feld: `${feld?.breite}x${feld?.laenge}` };
  const p = uebungPruefen(neu);
  if (!p.ok) return { ok: false, fehler: p.fehler };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update({ daten: p.uebung, status: "entwurf" })
    .eq("tenant_id", zg.verein.id)
    .eq("slug", slug)
    .eq("geaendert_am", stand)
    .select("geaendert_am")
    .maybeSingle();
  if (error) {
    console.error("[animation] speichern", error);
    return { ok: false, fehler: ["Speichern hat nicht geklappt. Versuche es nochmals."] };
  }
  if (!data) return { ok: false, fehler: ["Die Übung wurde inzwischen geändert. Lade die Seite neu."] };

  revalidatePath("/[verein]/admin/uebungen", "page");
  revalidatePath("/[verein]/uebungen", "page");
  revalidatePath("/[verein]/uebungen/[uebung]", "page");
  return { ok: true, stand: (data as { geaendert_am: string }).geaendert_am, hinweise: p.hinweise };
}
