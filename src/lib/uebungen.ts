import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { UebungsFilter } from "@/lib/uebung-filter";
import { uebung, type Uebung } from "@/lib/uebung-schema";

/** Datenzugriff für Übungen. Läuft immer mit dem Login, also unter RLS. */

export type UebungsKarte = {
  id: string;
  slug: string;
  status: "entwurf" | "freigegeben";
  titel: string;
  stufen: string[];
  spieler_min: number;
  spieler_max: number;
  mit_torhueter: boolean;
  kategorie: string;
  spielphase: string;
  dauer_min: number;
  intensitaet: string;
  geaendert_am: string;
  freigegeben_am: string | null;
};

const KARTEN_SPALTEN =
  "id, slug, status, titel, stufen, spieler_min, spieler_max, mit_torhueter, kategorie, spielphase, dauer_min, intensitaet, geaendert_am, freigegeben_am";

/** Freigegebene Übungen eines Vereins mit Filtern (Bibliothek). */
export async function bibliothek(tenantId: string, f: UebungsFilter): Promise<UebungsKarte[]> {
  const supabase = await createClient();
  let abfrage = supabase
    .from("exercises")
    .select(KARTEN_SPALTEN)
    .eq("tenant_id", tenantId)
    .eq("status", "freigegeben");

  if (f.spieler !== undefined) abfrage = abfrage.lte("spieler_min", f.spieler).gte("spieler_max", f.spieler);
  if (f.torhueter) abfrage = abfrage.eq("mit_torhueter", true);
  if (f.stufen.length) abfrage = abfrage.overlaps("stufen", f.stufen);
  if (f.kategorien.length) abfrage = abfrage.in("kategorie", f.kategorien);
  if (f.phasen.length) abfrage = abfrage.in("spielphase", f.phasen);
  if (f.intensitaeten.length) abfrage = abfrage.in("intensitaet", f.intensitaeten);
  if (f.dauerMax !== undefined) abfrage = abfrage.lte("dauer_min", f.dauerMax);
  if (f.q) abfrage = abfrage.textSearch("suche", f.q, { config: "german", type: "websearch" });

  const { data, error } = await abfrage.order("titel");
  if (error) throw new Error(`Übungen konnten nicht geladen werden: ${error.message}`);
  return (data ?? []) as UebungsKarte[];
}

/** Alle Übungen inkl. Entwürfe (Admin-Bereich; RLS lässt nur Owner/Admins Entwürfe sehen). */
export async function alleUebungen(tenantId: string): Promise<UebungsKarte[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select(KARTEN_SPALTEN)
    .eq("tenant_id", tenantId)
    .order("status", { ascending: true })
    .order("geaendert_am", { ascending: false });
  if (error) throw new Error(`Übungen konnten nicht geladen werden: ${error.message}`);
  return (data ?? []) as UebungsKarte[];
}

export type UebungsDetail =
  | { ok: true; karte: UebungsKarte; uebung: Uebung }
  | { ok: false; karte: UebungsKarte; fehler: string[] };

/** Eine Übung; die Daten werden mit dem Zod-Schema geprüft. */
export async function ladeUebung(tenantId: string, slug: string): Promise<UebungsDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select(`${KARTEN_SPALTEN}, daten`)
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Übung konnte nicht geladen werden: ${error.message}`);
  if (!data) return null;
  const { daten, ...karte } = data as UebungsKarte & { daten: unknown };
  const geprueft = uebung.safeParse(daten);
  if (!geprueft.success) {
    return {
      ok: false,
      karte,
      fehler: geprueft.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  return { ok: true, karte, uebung: geprueft.data };
}
