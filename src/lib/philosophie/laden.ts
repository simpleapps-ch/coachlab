import "server-only";

import { createClient } from "@/lib/supabase/server";
import { philosophieDokument, type PhilosophieDokument } from "./schema";

/** Datenzugriff Philosophie. Läuft mit dem Login, also unter RLS. */

export type Philosophie = {
  id: string;
  status: "entwurf" | "freigegeben";
  dokument: PhilosophieDokument;
  datei: string;
  dateiname: string | null;
  seiten: number | null;
  geaendert_am: string;
  freigegeben_am: string | null;
};

export async function ladePhilosophien(tenantId: string): Promise<{ entwurf?: Philosophie; freigegeben?: Philosophie }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("philosophien")
    .select("id, status, dokument, datei, dateiname, seiten, geaendert_am, freigegeben_am")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`Philosophie konnte nicht geladen werden: ${error.message}`);
  const aus: { entwurf?: Philosophie; freigegeben?: Philosophie } = {};
  for (const z of (data ?? []) as Array<Philosophie & { dokument: unknown }>) {
    const d = philosophieDokument.safeParse(z.dokument);
    if (d.success) aus[z.status] = { ...z, dokument: d.data };
  }
  return aus;
}

/**
 * Sehr kurz gültiger Link auf das Original-PDF (Storage-Policies prüfen den Zugriff beim Erstellen).
 * Kurz, damit ein kopierter Link ohne Login praktisch nicht nutzbar ist. Für «Original ansehen»
 * gibt es die Route …/philosophie/original, die bei jedem Klick den Login prüft.
 */
export async function originalLink(datei: string, sekunden = 120): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("philosophie").createSignedUrl(datei, sekunden);
  return data?.signedUrl ?? null;
}
