import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, als, frischeDatenbank } from "./db/datenbank";

const VEREIN_A = "aaaaaaaa-0000-0000-0000-000000000001";
const VEREIN_B = "bbbbbbbb-0000-0000-0000-000000000001";
const OWNER_A = "aaaaaaaa-0000-0000-0000-0000000000a1";
const TRAINER_A = "aaaaaaaa-0000-0000-0000-0000000000a3";
const OWNER_B = "bbbbbbbb-0000-0000-0000-0000000000b1";

const beispiel = (name: string) =>
  readFileSync(join(__dirname, "fixtures/uebungen", `${name}.json`), "utf8");

let db: Client;

describe.skipIf(!TEST_DATABASE_URL)("Übungen in der Datenbank", () => {
  beforeAll(async () => {
    db = await frischeDatenbank("uebungen");
    await db.query(
      `insert into auth.users (id, email) values ($1, 'owner-a@test.ch'), ($2, 'trainer-a@test.ch'), ($3, 'owner-b@test.ch')`,
      [OWNER_A, TRAINER_A, OWNER_B],
    );
    await db.query(
      `insert into tenants (id, name, slug) values ($1, 'FC Alpha', 'fc-alpha'), ($2, 'FC Beta', 'fc-beta')`,
      [VEREIN_A, VEREIN_B],
    );
    await db.query(
      `insert into memberships (user_id, tenant_id, rolle, status) values
         ($1, $4, 'owner', 'aktiv'), ($2, $4, 'trainer', 'aktiv'), ($3, $5, 'owner', 'aktiv')`,
      [OWNER_A, TRAINER_A, OWNER_B, VEREIN_A, VEREIN_B],
    );
    // Verein A: eine freigegebene, eine Entwurf; Verein B: eine freigegebene.
    await db.query(
      `insert into exercises (tenant_id, daten, status) values
         ($1, $3::jsonb, 'freigegeben'), ($1, $4::jsonb, 'entwurf'), ($2, $5::jsonb, 'freigegeben')`,
      [VEREIN_A, VEREIN_B, beispiel("rondo-4v2-umschalten"), beispiel("passdreieck-nachlaufen"), beispiel("2-gegen-1-auf-tor")],
    );
  });

  afterAll(async () => {
    await db?.end();
  });

  it("Filterspalten werden aus den Daten abgeleitet", async () => {
    const { rows } = await db.query(
      "select slug, titel, stufen, spieler_min, spieler_max, kategorie, dauer_min from exercises where slug = 'rondo-4v2-umschalten'",
    );
    expect(rows[0]).toEqual({
      slug: "rondo-4v2-umschalten",
      titel: "Rondo 4 gegen 2 mit Umschalten",
      stufen: ["E", "D", "C"],
      spieler_min: 6,
      spieler_max: 18,
      kategorie: "Taktik",
      dauer_min: 15,
    });
  });

  it("Volltextsuche findet deutsche Wortformen", async () => {
    const { rows } = await db.query(
      "select slug from exercises where suche @@ websearch_to_tsquery('german', 'Umschalten Ball')",
    );
    expect(rows.map((r) => r.slug)).toContain("rondo-4v2-umschalten");
  });

  it("Verein A sieht keine Übungen von Verein B", async () => {
    const a = await als(db, OWNER_A, "select slug from exercises order by slug");
    expect(a.map((r) => r.slug)).toEqual(["passdreieck-nachlaufen", "rondo-4v2-umschalten"]);
    const b = await als(db, OWNER_B, "select slug from exercises");
    expect(b.map((r) => r.slug)).toEqual(["2-gegen-1-auf-tor"]);
  });

  it("Trainer sieht nur freigegebene Übungen", async () => {
    const rows = await als(db, TRAINER_A, "select slug, status from exercises");
    expect(rows).toEqual([{ slug: "rondo-4v2-umschalten", status: "freigegeben" }]);
  });

  it("Trainer kann keine Übungen erfassen oder ändern", async () => {
    await expect(
      als(db, TRAINER_A, "insert into exercises (tenant_id, daten) values ($1, $2::jsonb)", [
        VEREIN_A,
        beispiel("2-gegen-1-auf-tor"),
      ]),
    ).rejects.toThrow(/row-level security/);
    const upd = await als(db, TRAINER_A, "update exercises set status = 'entwurf' returning id");
    expect(upd).toEqual([]);
  });

  it("Owner kann keine Übung in einen fremden Verein schreiben oder verschieben", async () => {
    await expect(
      als(db, OWNER_A, "insert into exercises (tenant_id, daten) values ($1, $2::jsonb)", [
        VEREIN_B,
        beispiel("2-gegen-1-auf-tor"),
      ]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      als(db, OWNER_A, "update exercises set tenant_id = $1", [VEREIN_B]),
    ).rejects.toThrow(/permission denied/);
  });

  it("Freigabe-Felder und abgeleitete Spalten setzt nur die Datenbank", async () => {
    await expect(
      als(db, OWNER_A, "update exercises set titel = 'x', freigegeben_von = $1", [OWNER_A]),
    ).rejects.toThrow(/permission denied/);
  });

  it("Freigeben setzt wer und wann; Änderung macht wieder zum Entwurf; Verlauf wird geschrieben", async () => {
    await db.query("begin");
    try {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: OWNER_A })]);

      const f = await db.query(
        "update exercises set status = 'freigegeben' where slug = 'passdreieck-nachlaufen' returning freigegeben_von, freigegeben_am is not null as gesetzt",
      );
      expect(f.rows[0]).toEqual({ freigegeben_von: OWNER_A, gesetzt: true });

      const g = await db.query(
        "update exercises set daten = jsonb_set(daten, '{titel}', '\"Passdreieck neu\"') where slug = 'passdreieck-nachlaufen' returning status, titel, freigegeben_am",
      );
      expect(g.rows[0]).toEqual({ status: "entwurf", titel: "Passdreieck neu", freigegeben_am: null });

      const v = await db.query(
        "select aktion, wer, nachher ->> 'status' as status from content_versions order by id desc limit 2",
      );
      expect(v.rows).toEqual([
        { aktion: "geaendert", wer: OWNER_A, status: "entwurf" },
        { aktion: "geaendert", wer: OWNER_A, status: "freigegeben" },
      ]);
    } finally {
      await db.query("rollback");
    }
  });

  it("Verlauf: nur Owner/Admins des eigenen Vereins, nie direkt schreibbar", async () => {
    const a = await als<{ tenant_id: string }>(db, OWNER_A, "select tenant_id from content_versions");
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((r) => r.tenant_id === VEREIN_A)).toBe(true);
    expect(await als(db, TRAINER_A, "select * from content_versions")).toEqual([]);
    await expect(
      als(db, OWNER_A, "insert into content_versions (tenant_id, tabelle, datensatz_id, aktion) values ($1, 'x', $1, 'erstellt')", [VEREIN_A]),
    ).rejects.toThrow(/permission denied/);
  });

  it("Gekündigtes Abo: Trainer sieht keine Übungen mehr, Owner schon", async () => {
    await db.query("begin");
    try {
      await db.query("update tenants set abo_status = 'canceled' where id = $1", [VEREIN_A]);
      for (const [wer, erwartet] of [[TRAINER_A, 0], [OWNER_A, 2]] as const) {
        await db.query("savepoint s");
        await db.query("set local role authenticated");
        await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: wer })]);
        const r = await db.query("select count(*)::int as n from exercises");
        expect(r.rows[0].n).toBe(erwartet);
        await db.query("rollback to savepoint s");
        await db.query("reset role");
      }
    } finally {
      await db.query("rollback");
    }
  });

  it("unvollständige Übung wird abgelehnt", async () => {
    await expect(
      db.query("insert into exercises (tenant_id, daten) values ($1, $2::jsonb)", [
        VEREIN_A,
        JSON.stringify({ titel: "ohne id" }),
      ]),
    ).rejects.toThrow(/unvollständig/);
  });
});
