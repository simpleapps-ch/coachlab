"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slug as slugSchema } from "@/lib/schema";
import { createClient } from "@/lib/supabase/server";
import { nurVerwalter } from "@/lib/verein";

/**
 * Jede Aktion prüft zuerst, dass der Benutzer Owner oder Admin ist (nurVerwalter).
 * Die Datenbank prüft es per Row Level Security ein zweites Mal.
 */

export type AdminZustand = { fehler?: string; ok?: string };

const AKTIONEN = {
  freischalten: { status: "aktiv" },
  sperren: { status: "gesperrt" },
  entsperren: { status: "aktiv" },
  zu_admin: { rolle: "admin" },
  zu_trainer: { rolle: "trainer" },
} as const;

const mitgliedEingabe = z.object({
  verein: slugSchema,
  user_id: z.uuid(),
  aktion: z.enum([...(Object.keys(AKTIONEN) as (keyof typeof AKTIONEN)[]), "entfernen"]),
});

export async function mitgliedAendern(formData: FormData): Promise<void> {
  const daten = mitgliedEingabe.safeParse(Object.fromEntries(formData));
  if (!daten.success) return;
  const { verein, user_id, aktion } = daten.data;
  const z = await nurVerwalter(verein);
  if (user_id === z.benutzer.id) return; // eigene Rolle nicht selbst ändern

  const supabase = await createClient();
  if (aktion === "entfernen") {
    await supabase
      .from("memberships")
      .delete()
      .eq("tenant_id", z.verein.id)
      .eq("user_id", user_id)
      .neq("rolle", "owner");
  } else {
    await supabase
      .from("memberships")
      .update(AKTIONEN[aktion])
      .eq("tenant_id", z.verein.id)
      .eq("user_id", user_id)
      .neq("rolle", "owner");
  }
  revalidatePath("/[verein]/admin/mitglieder", "page");
}

const einladungEingabe = z.object({
  verein: slugSchema,
  art: z.enum(["persoenlich", "vereinscode"]),
  email: z.string().optional(),
  rolle: z.enum(["admin", "trainer"]).default("trainer"),
});

export async function einladungErstellen(
  _: AdminZustand,
  formData: FormData,
): Promise<AdminZustand> {
  const daten = einladungEingabe.safeParse(Object.fromEntries(formData));
  if (!daten.success) return { fehler: "Ungültige Eingabe." };
  const { verein, art, rolle } = daten.data;
  const z_ = await nurVerwalter(verein);

  let email: string | null = null;
  if (art === "persoenlich") {
    const e = z.email().safeParse(daten.data.email?.trim());
    if (!e.success) return { fehler: "Bitte gib eine gültige E-Mail-Adresse ein." };
    email = e.data.toLowerCase();
  }

  const supabase = await createClient();
  const { error } = await supabase.from("invitations").insert({
    tenant_id: z_.verein.id,
    email,
    rolle: art === "vereinscode" ? "trainer" : rolle,
    erstellt_von: z_.benutzer.id,
    gueltig_bis: new Date(
      Date.now() + (art === "vereinscode" ? 90 : 14) * 24 * 60 * 60 * 1000,
    ).toISOString(),
  });
  if (error) return { fehler: "Einladung konnte nicht erstellt werden." };

  revalidatePath("/[verein]/admin/mitglieder", "page");
  return {
    ok:
      art === "vereinscode"
        ? "Vereinscode erstellt. Teile den Link unten mit deinen Trainern."
        : `Einladung für ${email} erstellt. Kopiere den Link unten und schick ihn per Mail oder WhatsApp.`,
  };
}

export async function einladungLoeschen(formData: FormData): Promise<void> {
  const verein = slugSchema.safeParse(formData.get("verein"));
  const id = z.uuid().safeParse(formData.get("id"));
  if (!verein.success || !id.success) return;
  const z_ = await nurVerwalter(verein.data);

  const supabase = await createClient();
  await supabase.from("invitations").delete().eq("id", id.data).eq("tenant_id", z_.verein.id);
  revalidatePath("/[verein]/admin/mitglieder", "page");
}
