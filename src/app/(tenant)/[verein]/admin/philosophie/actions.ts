"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pdfAufbereiten } from "@/lib/philosophie/pdf";
import { philosophieDokument } from "@/lib/philosophie/schema";
import { slug as vereinsSlug } from "@/lib/schema";
import { createClient } from "@/lib/supabase/server";
import { nurVerwalter } from "@/lib/verein";

/**
 * Philosophie verwalten. Das PDF lädt der Browser direkt in den Storage (kein Grössenlimit
 * der Server-Funktion); hier wird es gelesen, aufbereitet und als Entwurf gespeichert.
 * Jede Aktion prüft Owner/Admin, die Datenbank prüft es per RLS ein zweites Mal.
 */

export type Ergebnis = { fehler?: string; ok?: boolean; abschnitte?: number };

const MAX_BYTES = 25 * 1024 * 1024;

const aufbereitung = z.object({
  verein: vereinsSlug,
  datei: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/),
  dateiname: z.string().max(200).optional(),
});

function neuLaden() {
  revalidatePath("/[verein]/philosophie", "page");
  revalidatePath("/[verein]/admin/philosophie", "page");
}

export async function aufbereiten(eingabe: z.input<typeof aufbereitung>): Promise<Ergebnis> {
  const e = aufbereitung.safeParse(eingabe);
  if (!e.success) return { fehler: "Ungültige Datei." };
  const zg = await nurVerwalter(e.data.verein);
  if (!e.data.datei.startsWith(`${zg.verein.id}/`)) return { fehler: "Die Datei gehört nicht zu deinem Verein." };

  const supabase = await createClient();
  const { data: blob, error } = await supabase.storage.from("philosophie").download(e.data.datei);
  if (error || !blob) return { fehler: "Die Datei konnte nicht gelesen werden. Bitte nochmals hochladen." };
  if (blob.size > MAX_BYTES) return { fehler: "Die Datei ist grösser als 25 MB." };

  let ergebnis;
  try {
    ergebnis = await pdfAufbereiten(new Uint8Array(await blob.arrayBuffer()));
  } catch (fehler) {
    console.error("[philosophie] PDF nicht lesbar", fehler);
    await supabase.storage.from("philosophie").remove([e.data.datei]);
    return { fehler: "Das PDF konnte nicht gelesen werden. Ist es geschützt oder beschädigt?" };
  }

  const dok = philosophieDokument.safeParse(ergebnis.dokument);
  if (!dok.success) {
    await supabase.storage.from("philosophie").remove([e.data.datei]);
    return {
      fehler:
        "Im PDF wurde kein lesbarer Text gefunden. Gescannte Dokumente (nur Bilder) gehen nicht; bitte das PDF direkt aus Word, Pages, PowerPoint oder Google Slides exportieren.",
    };
  }

  // Bisherigen Entwurf ersetzen (seine Datei wird danach gelöscht)
  const { data: alt } = await supabase
    .from("philosophien")
    .select("datei")
    .eq("tenant_id", zg.verein.id)
    .eq("status", "entwurf")
    .maybeSingle();

  const werte = {
    dokument: dok.data,
    datei: e.data.datei,
    dateiname: e.data.dateiname?.slice(0, 200) ?? null,
    seiten: Math.min(ergebnis.seiten, 300),
  };
  const { error: e2 } = alt
    ? await supabase.from("philosophien").update(werte).eq("tenant_id", zg.verein.id).eq("status", "entwurf")
    : await supabase.from("philosophien").insert({ tenant_id: zg.verein.id, ...werte });
  if (e2) return { fehler: `Speichern fehlgeschlagen: ${e2.message}` };

  if (alt?.datei && alt.datei !== e.data.datei) await supabase.storage.from("philosophie").remove([alt.datei]);
  neuLaden();
  return { ok: true, abschnitte: dok.data.abschnitte.length };
}

const aktion = z.object({ verein: vereinsSlug, aktion: z.enum(["freigeben", "verwerfen"]) });

export async function philosophieAendern(formData: FormData): Promise<void> {
  const e = aktion.safeParse(Object.fromEntries(formData));
  if (!e.success) return;
  const zg = await nurVerwalter(e.data.verein);
  const supabase = await createClient();

  if (e.data.aktion === "freigeben") {
    const { data: altDatei, error } = await supabase.rpc("philosophie_freigeben", { p_tenant: zg.verein.id });
    if (!error && typeof altDatei === "string") await supabase.storage.from("philosophie").remove([altDatei]);
  } else {
    const { data } = await supabase
      .from("philosophien")
      .delete()
      .eq("tenant_id", zg.verein.id)
      .eq("status", "entwurf")
      .select("datei");
    const dateien = (data ?? []).map((d) => d.datei as string);
    if (dateien.length) await supabase.storage.from("philosophie").remove(dateien);
  }
  neuLaden();
}
