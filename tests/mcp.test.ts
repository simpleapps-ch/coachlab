import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { nichtAngemeldet, ressourcenMetadaten, tokenAus } from "@/lib/mcp/auth";
import { hatBallverlust, uebungPruefen } from "@/lib/mcp/pruefen";
import { erstelleServer } from "@/lib/mcp/werkzeuge";

const ORDNER = join(__dirname, "fixtures/uebungen");
const roh = (name: string) => JSON.parse(readFileSync(join(ORDNER, `${name}.json`), "utf8"));
const NAMEN = ["2-gegen-1-auf-tor", "passdreieck-nachlaufen", "rondo-4v2-umschalten"];

describe("Connector: Übung prüfen", () => {
  it("alle Beispielübungen bestehen die Prüfung", () => {
    for (const n of NAMEN) {
      const r = uebungPruefen(roh(n));
      expect(r.ok, `${n}: ${!r.ok ? r.fehler.join("; ") : ""}`).toBe(true);
    }
  });

  it("fehlende Pflichtfelder werden mit Pfad gemeldet", () => {
    const u = roh("rondo-4v2-umschalten");
    delete u.coachingpunkte;
    u.titel = "";
    const r = uebungPruefen(u);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.some((f) => f.startsWith("coachingpunkte"))).toBe(true);
      expect(r.fehler.some((f) => f.startsWith("titel"))).toBe(true);
    }
  });

  it("ein Pass durch einen Spieler blockiert das Speichern", () => {
    const u = {
      ...roh("passdreieck-nachlaufen"),
      animation: {
        feld: { breite: 20, laenge: 20 },
        automatik: false,
        objekte: [
          { id: "A1", typ: "spieler", team: "A", x: 2, y: 10 },
          { id: "A2", typ: "spieler", team: "A", x: 18, y: 10 },
          { id: "A3", typ: "spieler", team: "A", x: 10, y: 10 },
          { id: "ball", typ: "ball", bei: "A1" },
        ],
        schritte: [{ dauer: 2, text: "A1 auf A2", aktionen: [{ art: "pass", von: "A1", zu: "A2" }] }],
      },
      feld: "20x20",
    };
    const r = uebungPruefen(u);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler[0]).toMatch(/A1 → A2 läuft durch oder über A3/);
  });

  it("Spielform ohne Ballverlust bekommt einen Hinweis", () => {
    const u = roh("rondo-4v2-umschalten");
    expect(hatBallverlust(u.animation)).toBe(true);
    const ohne = {
      feld: { breite: 20, laenge: 20 },
      objekte: [
        { id: "A1", typ: "spieler", team: "A", x: 4, y: 4 },
        { id: "A2", typ: "spieler", team: "A", x: 16, y: 4 },
        { id: "B1", typ: "spieler", team: "B", x: 10, y: 14 },
        { id: "ball", typ: "ball", bei: "A1" },
      ],
      schritte: [{ dauer: 2, text: "A1 auf A2", aktionen: [{ art: "pass", von: "A1", zu: "A2" }] }],
    };
    expect(hatBallverlust(ohne as never)).toBe(false);
    const r = uebungPruefen({ ...u, animation: ohne, feld: "20x20" });
    expect(r.hinweise.some((h) => h.includes("Kein Ballverlust"))).toBe(true);
  });
});

describe("Connector: Anmeldung", () => {
  it("Metadaten zeigen auf Supabase Auth und die Connector-Adresse", () => {
    expect(ressourcenMetadaten("https://coachlab.com", "https://x.supabase.co")).toMatchObject({
      resource: "https://coachlab.com/api/mcp",
      authorization_servers: ["https://x.supabase.co/auth/v1"],
    });
  });

  it("ohne Token: 401 mit Verweis auf die Metadaten", () => {
    const r = nichtAngemeldet("https://coachlab.com");
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://coachlab.com/.well-known/oauth-protected-resource/api/mcp"',
    );
  });

  it("liest nur Bearer-Tokens", () => {
    const req = (h?: string) => new Request("https://x", { headers: h ? { authorization: h } : {} });
    expect(tokenAus(req("Bearer abc.def.ghi"))).toBe("abc.def.ghi");
    expect(tokenAus(req("Basic abc"))).toBeNull();
    expect(tokenAus(req())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Werkzeuge mit einer kleinen Supabase-Attrappe (RLS selbst prüfen die DB-Tests).
// ---------------------------------------------------------------------------

type Aufruf = { tabelle: string; methoden: string[]; werte: unknown[] };

function attrappe(antworten: Record<string, unknown>, aufrufe: Aufruf[]): SupabaseClient {
  const abfrage = (tabelle: string) => {
    const a: Aufruf = { tabelle, methoden: [], werte: [] };
    aufrufe.push(a);
    const ergebnis = () => {
      const schluessel = `${tabelle}.${a.methoden.find((m) => ["insert", "update"].includes(m)) ?? "select"}`;
      return { data: antworten[schluessel] ?? null, error: null };
    };
    const kette: object = new Proxy(
      {},
      {
        get(_, name: string) {
          if (name === "then") return (ok: (v: unknown) => void) => ok(ergebnis());
          if (name === "maybeSingle") return async () => ergebnis();
          return (...args: unknown[]) => {
            a.methoden.push(name);
            a.werte.push(args);
            return kette;
          };
        },
      },
    );
    return kette;
  };
  return { from: abfrage } as unknown as SupabaseClient;
}

async function verbinden(antworten: Record<string, unknown>) {
  const aufrufe: Aufruf[] = [];
  const server = erstelleServer({ supabase: attrappe(antworten, aufrufe), benutzerId: "u1", origin: "https://c.test" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(b);
  return { client, aufrufe };
}

const VEREIN = (rolle: string) => [
  { rolle, tenants: { id: "t1", name: "Zug94", slug: "zug94", abo_status: "active" } },
];

const textVon = (r: Awaited<ReturnType<Client["callTool"]>>) =>
  (r.content as Array<{ text: string }>)[0].text;

describe("Connector: Werkzeuge", () => {
  it("bietet die sechs Werkzeuge an", async () => {
    const { client } = await verbinden({});
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "coachlab_uebung_lesen",
      "coachlab_uebung_pruefen",
      "coachlab_uebung_speichern",
      "coachlab_uebungen_suchen",
      "coachlab_uebungsformat",
      "coachlab_vereine",
    ]);
    const speichern = tools.find((t) => t.name === "coachlab_uebung_speichern")!;
    expect(speichern.annotations?.readOnlyHint).toBe(false);
  });

  it("Format liefert Schema und Standard", async () => {
    const { client } = await verbinden({});
    const r = await client.callTool({ name: "coachlab_uebungsformat", arguments: {} });
    const inhalt = JSON.parse(textVon(r));
    expect(inhalt.animationsstandard).toMatch(/Gegenpressing/);
    expect(inhalt.schema.required).toContain("animation");
  });

  it("Trainer dürfen nicht speichern", async () => {
    const { client, aufrufe } = await verbinden({ "memberships.select": VEREIN("trainer") });
    const r = await client.callTool({
      name: "coachlab_uebung_speichern",
      arguments: { uebung: roh("rondo-4v2-umschalten") },
    });
    expect(r.isError).toBe(true);
    expect(textVon(r)).toMatch(/nicht speichern/);
    expect(aufrufe.some((a) => a.tabelle === "exercises")).toBe(false);
  });

  it("speichert immer als Entwurf, im eigenen Verein", async () => {
    const { client, aufrufe } = await verbinden({ "memberships.select": VEREIN("owner") });
    const r = await client.callTool({
      name: "coachlab_uebung_speichern",
      arguments: { uebung: roh("rondo-4v2-umschalten") },
    });
    expect(r.isError).toBeFalsy();
    const antwort = JSON.parse(textVon(r));
    expect(antwort).toMatchObject({ gespeichert: true, status: "entwurf", ersetzt: false });
    expect(antwort.vorschau).toBe("https://c.test/zug94/uebungen/rondo-4v2-umschalten");
    const insert = aufrufe.find((a) => a.methoden.includes("insert"))!;
    const zeile = (insert.werte[0] as [Record<string, unknown>])[0];
    expect(zeile).toMatchObject({ tenant_id: "t1", status: "entwurf" });
  });

  it("überschreibt eine bestehende Übung nur auf ausdrücklichen Wunsch", async () => {
    const antworten = {
      "memberships.select": VEREIN("admin"),
      "exercises.select": { id: "e1", status: "freigegeben" },
    };
    const { client } = await verbinden(antworten);
    const ohne = await client.callTool({
      name: "coachlab_uebung_speichern",
      arguments: { uebung: roh("rondo-4v2-umschalten") },
    });
    expect(ohne.isError).toBe(true);
    expect(textVon(ohne)).toMatch(/ueberschreiben: true/);

    const { client: c2, aufrufe } = await verbinden(antworten);
    const mit = await c2.callTool({
      name: "coachlab_uebung_speichern",
      arguments: { uebung: roh("rondo-4v2-umschalten"), ueberschreiben: true },
    });
    expect(JSON.parse(textVon(mit))).toMatchObject({ ersetzt: true, war_freigegeben: true, status: "entwurf" });
    const update = aufrufe.find((a) => a.methoden.includes("update"))!;
    expect((update.werte[0] as [Record<string, unknown>])[0]).toMatchObject({ status: "entwurf" });
  });

  it("fremde Vereine werden abgelehnt", async () => {
    const { client } = await verbinden({ "memberships.select": VEREIN("owner") });
    const r = await client.callTool({
      name: "coachlab_uebungen_suchen",
      arguments: { verein: "fc-anders" },
    });
    expect(r.isError).toBe(true);
    expect(textVon(r)).toMatch(/Kein Zugang zum Verein «fc-anders»/);
  });
});
