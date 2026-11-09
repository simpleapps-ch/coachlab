"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slug as vereinsSlug, uebungsSlug } from "@/lib/schema";
import { createClient } from "@/lib/supabase/server";
import { nurVerwalter } from "@/lib/verein";

/**
 * Freigabe im Admin-Bereich. Jede Aktion prüft Owner/Admin (nurVerwalter),
 * die Datenbank prüft es per RLS ein zweites Mal.
 */

const eingabe = z.object({
  verein: vereinsSlug,
  uebung: uebungsSlug,
  aktion: z.enum(["freigeben", "zurueckziehen", "loeschen"]),
});

export async function uebungAendern(formData: FormData): Promise<void> {
  const daten = eingabe.safeParse(Object.fromEntries(formData));
  if (!daten.success) return;
  const { verein, uebung, aktion } = daten.data;
  const zg = await nurVerwalter(verein);
  const supabase = await createClient();
  const zeile = supabase.from("exercises");

  if (aktion === "loeschen") {
    // Nur Entwürfe löschen; Freigegebenes zuerst zurückziehen.
    await zeile.delete().eq("tenant_id", zg.verein.id).eq("slug", uebung).eq("status", "entwurf");
  } else {
    await zeile
      .update({ status: aktion === "freigeben" ? "freigegeben" : "entwurf" })
      .eq("tenant_id", zg.verein.id)
      .eq("slug", uebung);
  }

  revalidatePath("/[verein]/admin/uebungen", "page");
  revalidatePath("/[verein]/uebungen", "page");
  revalidatePath("/[verein]/uebungen/[uebung]", "page");
}
