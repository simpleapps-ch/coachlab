import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RESERVIERTE_SUBDOMAINS } from "@/lib/tenant";
import { TEST_DATABASE_URL, als, frischeDatenbank } from "./db/datenbank";

const VEREIN_A = "aaaaaaaa-0000-0000-0000-000000000001";
const VEREIN_B = "bbbbbbbb-0000-0000-0000-000000000001";
const OWNER_A = "aaaaaaaa-0000-0000-0000-0000000000a1";
const TRAINER_A = "aaaaaaaa-0000-0000-0000-0000000000a3";
const OWNER_B = "bbbbbbbb-0000-0000-0000-0000000000b1";
const NEU = "dddddddd-0000-0000-0000-0000000000d1";
const NEU2 = "dddddddd-0000-0000-0000-0000000000d2";

const CODE_PERSOENLICH = "11111111111111111111111111111111";
const CODE_VEREIN = "22222222222222222222222222222222";
const CODE_ABGELAUFEN = "33333333333333333333333333333333";
const CODE_B = "44444444444444444444444444444444";
const CODE_ADMIN = "55555555555555555555555555555555";

let db: Client;

describe.skipIf(!TEST_DATABASE_URL)("Einladungen und Mitgliederliste", () => {
  beforeAll(async () => {
    db = await frischeDatenbank("einladungen");
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values
         ($1, 'owner-a@test.ch', '{"name":"Owner A"}'), ($2, 'trainer-a@test.ch', '{}'),
         ($3, 'owner-b@test.ch', '{}'), ($4, 'Neu@Test.ch', '{"name":"Neu"}'),
         ($5, 'neu2@test.ch', '{}')`,
      [OWNER_A, TRAINER_A, OWNER_B, NEU, NEU2],
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
    await db.query(
      `insert into invitations (tenant_id, email, code, rolle, gueltig_bis) values
         ($1, 'neu@test.ch', $2, 'trainer', now() + interval '1 day'),
         ($1, null,          $3, 'trainer', now() + interval '1 day'),
         ($1, 'x@test.ch',   $4, 'trainer', now() - interval '1 day'),
         ($5, null,          $6, 'trainer', now() + interval '1 day'),
         ($1, 'neu2@test.ch',$7, 'admin',   now() + interval '1 day')`,
      [VEREIN_A, CODE_PERSOENLICH, CODE_VEREIN, CODE_ABGELAUFEN, VEREIN_B, CODE_B, CODE_ADMIN],
    );
  });

  afterAll(async () => {
    await db?.end();
  });

  describe("einladung_pruefen (ohne Login)", () => {
    it("zeigt Verein und Rolle, aber keine E-Mail", async () => {
      const rows = await als(db, null, "select * from einladung_pruefen($1)", [CODE_PERSOENLICH]);
      expect(rows).toEqual([
        { verein_name: "FC Alpha", verein_slug: "fc-alpha", rolle: "trainer", persoenlich: true },
      ]);
    });

    it("abgelaufene oder unbekannte Codes liefern nichts", async () => {
      expect(await als(db, null, "select * from einladung_pruefen($1)", [CODE_ABGELAUFEN])).toEqual([]);
      expect(await als(db, null, "select * from einladung_pruefen('gibtsnicht')")).toEqual([]);
    });

    it("anonym kann keine Einladung annehmen", async () => {
      await expect(
        als(db, null, "select * from einladung_annehmen($1)", [CODE_VEREIN]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe("einladung_annehmen", () => {
    it("persönliche Einladung: nur für die richtige E-Mail, danach sofort aktiv", async () => {
      await expect(
        als(db, NEU2, "select * from einladung_annehmen($1)", [CODE_PERSOENLICH]),
      ).rejects.toThrow(/andere E-Mail/);

      // Gross-/Kleinschreibung der E-Mail spielt keine Rolle.
      await db.query("begin");
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: NEU })]);
      const r = await db.query("select * from einladung_annehmen($1)", [CODE_PERSOENLICH]);
      expect(r.rows).toEqual([{ verein_slug: "fc-alpha", status: "aktiv" }]);
      // Zweites Mal: bereits verbraucht.
      await expect(db.query("select * from einladung_annehmen($1)", [CODE_PERSOENLICH])).rejects.toThrow(
        /ungültig/,
      );
      await db.query("rollback");
    });

    it("Vereinscode: Mitglied wartet auf Freischaltung und sieht noch nichts", async () => {
      await db.query("begin");
      try {
        await db.query("set local role authenticated");
        await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: NEU2 })]);
        const r = await db.query("select * from einladung_annehmen($1)", [CODE_VEREIN]);
        expect(r.rows).toEqual([{ verein_slug: "fc-alpha", status: "wartet" }]);
        const t = await db.query("select * from tenants");
        expect(t.rows).toEqual([]);
      } finally {
        await db.query("rollback");
      }
    });

    it("bestehende Mitgliedschaft wird nicht ausgeweitet", async () => {
      await db.query("begin");
      try {
        await db.query("insert into memberships (user_id, tenant_id, rolle, status) values ($1, $2, 'trainer', 'gesperrt')", [NEU2, VEREIN_A]);
        await db.query("set local role authenticated");
        await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: NEU2 })]);
        const r = await db.query("select * from einladung_annehmen($1)", [CODE_ADMIN]);
        expect(r.rows).toEqual([{ verein_slug: "fc-alpha", status: "gesperrt" }]);
      } finally {
        await db.query("rollback");
      }
    });

    it("Code eines fremden Vereins macht nicht zum Mitglied von Verein A", async () => {
      const rows = await als(db, NEU2, "select * from einladung_annehmen($1)", [CODE_B]);
      expect(rows).toEqual([{ verein_slug: "fc-beta", status: "wartet" }]);
    });

    it("Vereinscode nur für Trainer", async () => {
      await expect(
        db.query("insert into invitations (tenant_id, email, rolle) values ($1, null, 'admin')", [VEREIN_A]),
      ).rejects.toThrow(/invitations_vereinscode_nur_trainer/);
    });
  });

  describe("mitglieder_liste", () => {
    it("Owner sieht Namen und E-Mails der eigenen Mitglieder", async () => {
      const rows = await als<{ email: string; rolle: string }>(
        db,
        OWNER_A,
        "select email, rolle from mitglieder_liste($1)",
        [VEREIN_A],
      );
      expect(rows.map((r) => r.email).sort()).toEqual(["owner-a@test.ch", "trainer-a@test.ch"]);
    });

    it("Verein A sieht die Mitglieder von Verein B nicht", async () => {
      expect(await als(db, OWNER_A, "select * from mitglieder_liste($1)", [VEREIN_B])).toEqual([]);
    });

    it("Trainer sieht keine Mitgliederliste", async () => {
      expect(await als(db, TRAINER_A, "select * from mitglieder_liste($1)", [VEREIN_A])).toEqual([]);
    });
  });

  describe("Tarif und Subdomains", () => {
    it("Gratis-Verein: kein Stripe, immer aktiv", async () => {
      await db.query("begin");
      try {
        await db.query("update tenants set plan = 'gratis', abo_status = 'active' where id = $1", [VEREIN_A]);
        await expect(
          db.query("update tenants set stripe_customer_id = 'cus_x' where id = $1", [VEREIN_A]),
        ).rejects.toThrow(/tenants_gratis_ohne_stripe/);
      } finally {
        await db.query("rollback");
      }
    });

    it("reservierte Subdomains sind in Datenbank und Code identisch", () => {
      const ordner = join(__dirname, "..", "supabase/migrations");
      const sql = readdirSync(ordner)
        .sort()
        .map((d) => readFileSync(join(ordner, d), "utf8"))
        .join("\n");
      // Die neueste Migration mit dem Constraint gilt.
      const bloecke = [...sql.matchAll(/tenants_slug_nicht_reserviert[\s\S]*?not in \(([\s\S]*?)\)\);/g)];
      expect(bloecke.length).toBeGreaterThan(0);
      const block = bloecke.at(-1)!;
      const inDb = [...block[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]).sort();
      expect(inDb).toEqual([...RESERVIERTE_SUBDOMAINS].sort());
    });

    it("reservierte Subdomain kann nicht als Verein angelegt werden", async () => {
      await expect(
        db.query("insert into tenants (name, slug) values ('Preise', 'preise')"),
      ).rejects.toThrow(/tenants_slug_nicht_reserviert/);
    });
  });
});
