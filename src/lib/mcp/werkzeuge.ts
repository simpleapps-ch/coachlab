import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { uebungPruefen } from "./pruefen";
import { ANIMATIONS_STANDARD, SERVER_ANLEITUNG } from "./regeln";
import { KATEGORIEN, SFV_STUFEN, SPIELPHASEN, uebung, uebungsSlug } from "@/lib/uebung-schema";

/**
 * Werkzeuge des Coachlab-Connectors. Alle Abfragen laufen mit dem Token des Benutzers,
 * also unter Row Level Security: Der Connector sieht und darf nie mehr als die Person
 * auf der Website. Gespeichert wird immer als Entwurf, freigeben geht nur auf der Website.
 */

export type Kontext = {
  supabase: SupabaseClient;
  benutzerId: string;
  /** Adresse der Website, z. B. https://coachlab-ch.netlify.app (für Links) */
  origin: string;
};

type VereinsZugang = {
  id: string;
  name: string;
  slug: string;
  rolle: "owner" | "admin" | "trainer";
  verwalten: boolean;
  abo_status: string;
};

const ROLLEN_TEXT = { owner: "Technische Leitung", admin: "Admin", trainer: "Trainer" } as const;

const KARTEN_SPALTEN =
  "slug, status, titel, stufen, spieler_min, spieler_max, mit_torhueter, kategorie, spielphase, dauer_min, intensitaet, geaendert_am";

function text(inhalt: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: typeof inhalt === "string" ? inhalt : JSON.stringify(inhalt, null, 2) }],
  };
}

function fehler(meldung: string): CallToolResult {
  return { content: [{ type: "text", text: meldung }], isError: true };
}

export async function meineVereine(k: Kontext): Promise<VereinsZugang[]> {
  const { data, error } = await k.supabase
    .from("memberships")
    .select("rolle, status, tenants(id, name, slug, abo_status)")
    .eq("user_id", k.benutzerId)
    .eq("status", "aktiv");
  if (error) throw new Error(`Vereine konnten nicht geladen werden: ${error.message}`);
  type Zeile = {
    rolle: VereinsZugang["rolle"];
    tenants: { id: string; name: string; slug: string; abo_status: string } | null;
  };
  return ((data ?? []) as unknown as Zeile[])
    .filter((z) => z.tenants)
    .map((z) => ({
      ...z.tenants!,
      rolle: z.rolle,
      verwalten: z.rolle === "owner" || z.rolle === "admin",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
}

/** Verein per Slug; ohne Angabe der einzige Verein der Person. */
async function vereinWaehlen(k: Kontext, slug: string | undefined): Promise<VereinsZugang | string> {
  const vereine = await meineVereine(k);
  if (vereine.length === 0) {
    return "Du bist in keinem Verein aktives Mitglied. Bitte die Technische Leitung um eine Einladung.";
  }
  if (!slug) {
    if (vereine.length === 1) return vereine[0];
    return `Du bist in mehreren Vereinen. Bitte «verein» angeben: ${vereine.map((v) => v.slug).join(", ")}`;
  }
  const v = vereine.find((x) => x.slug === slug);
  return v ?? `Kein Zugang zum Verein «${slug}». Deine Vereine: ${vereine.map((x) => x.slug).join(", ")}`;
}

const aboAktiv = (v: VereinsZugang) => ["trialing", "active", "past_due"].includes(v.abo_status);

function link(k: Kontext, v: VereinsZugang, id: string) {
  return `${k.origin}/${v.slug}/uebungen/${id}`;
}

const vereinParam = z
  .string()
  .optional()
  .describe("Slug des Vereins, z. B. zug94. Nur nötig, wenn du in mehreren Vereinen bist.");

const uebungParam = z
  .looseObject({})
  .describe("Die vollständige Übung im Coachlab-Pflichtformat (siehe coachlab_uebungsformat).");

export function erstelleServer(k: Kontext): McpServer {
  const server = new McpServer(
    { name: "coachlab", title: "Coachlab", version: "1.0.0" },
    { instructions: SERVER_ANLEITUNG },
  );

  server.registerTool(
    "coachlab_vereine",
    {
      title: "Meine Vereine",
      description: "Listet deine Vereine bei Coachlab mit Rolle. Speichern dürfen nur Technische Leitung und Admins.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const vereine = await meineVereine(k);
      if (!vereine.length) return text("Du bist in keinem Verein aktives Mitglied.");
      return text(
        vereine.map((v) => ({
          verein: v.slug,
          name: v.name,
          rolle: ROLLEN_TEXT[v.rolle],
          darf_speichern: v.verwalten,
          abo_aktiv: aboAktiv(v),
          bibliothek: `${k.origin}/${v.slug}/uebungen`,
        })),
      );
    },
  );

  server.registerTool(
    "coachlab_uebungen_suchen",
    {
      title: "Übungen suchen",
      description:
        "Sucht Übungen des Vereins (Volltext und Filter). Trainer sehen freigegebene Übungen, Technische Leitung und Admins auch Entwürfe.",
      inputSchema: {
        verein: vereinParam,
        suche: z.string().max(200).optional().describe("Suchbegriffe, z. B. «Rondo Gegenpressing»"),
        stufe: z.enum(SFV_STUFEN).optional().describe("SFV-Stufe"),
        kategorie: z.enum(KATEGORIEN).optional(),
        spielphase: z.enum(SPIELPHASEN).optional(),
        spieler: z.number().int().min(1).max(40).optional().describe("Anzahl Spieler, die mitmachen"),
        status: z.enum(["alle", "entwurf", "freigegeben"]).default("alle"),
        anzahl: z.number().int().min(1).max(100).default(30),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (p) => {
      const v = await vereinWaehlen(k, p.verein);
      if (typeof v === "string") return fehler(v);
      let q = k.supabase.from("exercises").select(KARTEN_SPALTEN).eq("tenant_id", v.id);
      if (p.status !== "alle") q = q.eq("status", p.status);
      if (p.stufe) q = q.contains("stufen", [p.stufe]);
      if (p.kategorie) q = q.eq("kategorie", p.kategorie);
      if (p.spielphase) q = q.eq("spielphase", p.spielphase);
      if (p.spieler !== undefined) q = q.lte("spieler_min", p.spieler).gte("spieler_max", p.spieler);
      if (p.suche) q = q.textSearch("suche", p.suche, { config: "german", type: "websearch" });
      const { data, error } = await q.order("titel").limit(p.anzahl);
      if (error) return fehler(`Suche fehlgeschlagen: ${error.message}`);
      const liste = (data ?? []) as Array<Record<string, unknown> & { slug: string }>;
      return text({
        verein: v.slug,
        anzahl: liste.length,
        uebungen: liste.map(({ slug, ...rest }) => ({ id: slug, ...rest, link: link(k, v, slug) })),
      });
    },
  );

  server.registerTool(
    "coachlab_uebung_lesen",
    {
      title: "Übung lesen",
      description: "Liest eine Übung vollständig im Pflichtformat, inkl. Animation. Gute Vorlage für neue Übungen.",
      inputSchema: { verein: vereinParam, id: uebungsSlug.describe("ID (Slug) der Übung") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (p) => {
      const v = await vereinWaehlen(k, p.verein);
      if (typeof v === "string") return fehler(v);
      const { data, error } = await k.supabase
        .from("exercises")
        .select("status, daten, geaendert_am, freigegeben_am")
        .eq("tenant_id", v.id)
        .eq("slug", p.id)
        .maybeSingle();
      if (error) return fehler(`Übung konnte nicht geladen werden: ${error.message}`);
      if (!data) return fehler(`Keine Übung «${p.id}» im Verein ${v.slug} (oder kein Zugriff auf Entwürfe).`);
      return text({ verein: v.slug, link: link(k, v, p.id), ...data });
    },
  );

  server.registerTool(
    "coachlab_uebungsformat",
    {
      title: "Pflichtformat und Animationsstandard",
      description:
        "Liefert das Pflichtformat einer Übung (JSON-Schema) und den Coachlab-Animationsstandard. Vor dem Erfassen einer Übung einmal lesen.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      text({
        animationsstandard: ANIMATIONS_STANDARD,
        schema: z.toJSONSchema(uebung, { io: "input", unrepresentable: "any" }),
      }),
  );

  server.registerTool(
    "coachlab_uebung_pruefen",
    {
      title: "Übung prüfen",
      description:
        "Prüft eine Übung gegen Pflichtformat und Animationsstandard, ohne zu speichern. Fehler müssen behoben werden, Hinweise mit der Person besprechen.",
      inputSchema: { uebung: uebungParam },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (p) => {
      const r = uebungPruefen(p.uebung);
      return text(
        r.ok
          ? { gueltig: true, hinweise: r.hinweise }
          : { gueltig: false, fehler: r.fehler, hinweise: r.hinweise },
      );
    },
  );

  server.registerTool(
    "coachlab_uebung_speichern",
    {
      title: "Übung als Entwurf speichern",
      description:
        "Speichert eine Übung als Entwurf im Verein (nur Technische Leitung und Admins). Prüft vorher Format und Animationsstandard. " +
        "Eine bestehende Übung mit gleicher ID wird nur mit ueberschreiben: true ersetzt und ist danach wieder Entwurf.",
      inputSchema: {
        verein: vereinParam,
        uebung: uebungParam,
        ueberschreiben: z
          .boolean()
          .default(false)
          .describe("true, um eine bestehende Übung mit gleicher ID zu ersetzen (vorher mit der Person klären)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (p) => {
      const v = await vereinWaehlen(k, p.verein);
      if (typeof v === "string") return fehler(v);
      if (!v.verwalten) {
        return fehler(
          `Als ${ROLLEN_TEXT[v.rolle]} kannst du Übungen lesen, aber nicht speichern. Das dürfen Technische Leitung und Admins.`,
        );
      }
      const r = uebungPruefen(p.uebung);
      if (!r.ok) {
        return {
          ...text({ gespeichert: false, fehler: r.fehler, hinweise: r.hinweise }),
          isError: true,
        };
      }
      const u = r.uebung;

      const { data: bestehend, error: e1 } = await k.supabase
        .from("exercises")
        .select("id, status")
        .eq("tenant_id", v.id)
        .eq("slug", u.id)
        .maybeSingle();
      if (e1) return fehler(`Speichern fehlgeschlagen: ${e1.message}`);

      if (bestehend && !p.ueberschreiben) {
        return fehler(
          `Im Verein gibt es schon eine Übung «${u.id}» (${bestehend.status}). ` +
            "Andere ID wählen oder mit ueberschreiben: true ersetzen (die Übung wird dann wieder Entwurf).",
        );
      }

      const { error: e2 } = bestehend
        ? await k.supabase.from("exercises").update({ daten: u, status: "entwurf" }).eq("id", bestehend.id)
        : await k.supabase.from("exercises").insert({ tenant_id: v.id, daten: u, status: "entwurf" });
      if (e2) return fehler(`Speichern fehlgeschlagen: ${e2.message}`);

      return text({
        gespeichert: true,
        status: "entwurf",
        ersetzt: Boolean(bestehend),
        war_freigegeben: bestehend?.status === "freigegeben",
        vorschau: link(k, v, u.id),
        freigabe: `${k.origin}/${v.slug}/admin/uebungen`,
        hinweise: r.hinweise,
        naechster_schritt: "Die Technische Leitung prüft die Vorschau und gibt die Übung unter «Entwürfe & Freigabe» frei.",
      });
    },
  );

  return server;
}
