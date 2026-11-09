import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, als, frischeDatenbank } from "./db/datenbank";

/**
 * Unverhandelbare Regel 3: «Verein A sieht nichts von Verein B».
 * Läuft gegen eine echte Postgres-Datenbank mit allen Migrationen.
 */

const VEREIN_A = "aaaaaaaa-0000-0000-0000-000000000001";
const VEREIN_B = "bbbbbbbb-0000-0000-0000-000000000001";

const OWNER_A = "aaaaaaaa-0000-0000-0000-0000000000a1";
const ADMIN_A = "aaaaaaaa-0000-0000-0000-0000000000a2";
const TRAINER_A = "aaaaaaaa-0000-0000-0000-0000000000a3";
const WARTET_A = "aaaaaaaa-0000-0000-0000-0000000000a4";
const OWNER_B = "bbbbbbbb-0000-0000-0000-0000000000b1";
const FREMD = "cccccccc-0000-0000-0000-0000000000c1";

let db: Client;

describe.skipIf(!TEST_DATABASE_URL)("Row Level Security", () => {
  beforeAll(async () => {
    db = await frischeDatenbank();
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values
         ($1, 'owner-a@test.ch',   '{"name":"Owner A"}'),
         ($2, 'admin-a@test.ch',   '{}'),
         ($3, 'trainer-a@test.ch', '{}'),
         ($4, 'wartet-a@test.ch',  '{}'),
         ($5, 'owner-b@test.ch',   '{}'),
         ($6, 'fremd@test.ch',     '{}')`,
      [OWNER_A, ADMIN_A, TRAINER_A, WARTET_A, OWNER_B, FREMD],
    );
    await db.query(
      `insert into public.tenants (id, name, slug, abo_status, stripe_customer_id) values
         ($1, 'FC Alpha', 'fc-alpha', 'active', 'cus_alpha'),
         ($2, 'FC Beta',  'fc-beta',  'trialing', 'cus_beta')`,
      [VEREIN_A, VEREIN_B],
    );
    await db.query(
      `insert into public.memberships (user_id, tenant_id, rolle, status) values
         ($1, $6, 'owner',   'aktiv'),
         ($2, $6, 'admin',   'aktiv'),
         ($3, $6, 'trainer', 'aktiv'),
         ($4, $6, 'trainer', 'wartet'),
         ($5, $7, 'owner',   'aktiv')`,
      [OWNER_A, ADMIN_A, TRAINER_A, WARTET_A, OWNER_B, VEREIN_A, VEREIN_B],
    );
    await db.query(
      `insert into public.invitations (tenant_id, email, rolle) values
         ($1, 'neu-a@test.ch', 'trainer'),
         ($2, 'neu-b@test.ch', 'trainer')`,
      [VEREIN_A, VEREIN_B],
    );
  });

  afterAll(async () => {
    await db?.end();
  });

  describe("Verein A sieht nichts von Verein B", () => {
    it("Vereine: jeder sieht nur den eigenen", async () => {
      const a = await als(db, OWNER_A, "select slug from tenants");
      const b = await als(db, OWNER_B, "select slug from tenants");
      expect(a.map((r) => r.slug)).toEqual(["fc-alpha"]);
      expect(b.map((r) => r.slug)).toEqual(["fc-beta"]);
    });

    it("Mitgliedschaften: keine fremden Mitglieder", async () => {
      const rows = await als(db, OWNER_A, "select tenant_id from memberships");
      expect(rows.length).toBe(4);
      expect(rows.every((r) => r.tenant_id === VEREIN_A)).toBe(true);
    });

    it("Einladungen: keine fremden Einladungen", async () => {
      const rows = await als(db, OWNER_A, "select email from invitations");
      expect(rows.map((r) => r.email)).toEqual(["neu-a@test.ch"]);
    });

    it("kann im fremden Verein keine Einladung anlegen", async () => {
      await expect(
        als(db, OWNER_A, "insert into invitations (tenant_id, email) values ($1, 'x@test.ch')", [
          VEREIN_B,
        ]),
      ).rejects.toThrow(/row-level security/);
    });

    it("kann sich nicht selbst in einen fremden Verein eintragen", async () => {
      await expect(
        als(
          db,
          OWNER_A,
          "insert into memberships (user_id, tenant_id, rolle, status) values ($1, $2, 'admin', 'aktiv')",
          [OWNER_A, VEREIN_B],
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it("kann fremde Vereinsdaten nicht ändern", async () => {
      const rows = await als(
        db,
        OWNER_A,
        "update tenants set name = 'gehackt' where id = $1 returning id",
        [VEREIN_B],
      );
      expect(rows).toEqual([]);
    });

    it("Hilfsfunktionen geben für fremde Vereine false", async () => {
      const [r] = await als(
        db,
        OWNER_A,
        "select private.darf_lesen($1) as lesen, private.darf_verwalten($1) as verwalten",
        [VEREIN_B],
      );
      expect(r).toEqual({ lesen: false, verwalten: false });
    });
  });

  describe("Ohne Mitgliedschaft", () => {
    it("Benutzer ohne Verein sieht nichts", async () => {
      expect(await als(db, FREMD, "select * from tenants")).toEqual([]);
      expect(await als(db, FREMD, "select * from memberships")).toEqual([]);
      expect(await als(db, FREMD, "select * from invitations")).toEqual([]);
    });

    it("anonyme Anfragen werden abgelehnt", async () => {
      await expect(als(db, null, "select * from tenants")).rejects.toThrow(/permission denied/);
      await expect(als(db, null, "select * from memberships")).rejects.toThrow(
        /permission denied/,
      );
    });

    it("Mitglied mit Status «wartet» sieht den Verein noch nicht", async () => {
      expect(await als(db, WARTET_A, "select * from tenants")).toEqual([]);
      const [r] = await als(db, WARTET_A, "select private.darf_lesen($1) as lesen", [VEREIN_A]);
      expect(r.lesen).toBe(false);
    });

    it("öffentliche Vereinsdaten zeigen keine Abo-Details", async () => {
      const rows = await als(db, null, "select * from verein_oeffentlich('FC-Alpha')");
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0]).sort()).toEqual(["farben", "id", "logo_url", "name", "slug"]);
    });
  });

  describe("Rollen im eigenen Verein", () => {
    it("Trainer sieht nur die eigene Mitgliedschaft", async () => {
      const rows = await als(db, TRAINER_A, "select user_id from memberships");
      expect(rows.map((r) => r.user_id)).toEqual([TRAINER_A]);
    });

    it("Trainer kann weder einladen noch Vereinsdaten ändern", async () => {
      await expect(
        als(db, TRAINER_A, "insert into invitations (tenant_id) values ($1)", [VEREIN_A]),
      ).rejects.toThrow(/row-level security/);
      const rows = await als(
        db,
        TRAINER_A,
        "update tenants set name = 'x' where id = $1 returning id",
        [VEREIN_A],
      );
      expect(rows).toEqual([]);
    });

    it("Admin kann einladen und Logo ändern", async () => {
      const inv = await als(
        db,
        ADMIN_A,
        "insert into invitations (tenant_id, email) values ($1, 'neu@test.ch') returning code",
        [VEREIN_A],
      );
      expect(inv[0].code).toMatch(/^[0-9a-f]{32}$/);
      const upd = await als(
        db,
        ADMIN_A,
        "update tenants set logo_url = 'logo.png' where id = $1 returning id",
        [VEREIN_A],
      );
      expect(upd).toHaveLength(1);
    });

    it("Admin kann den Owner weder ändern noch entfernen", async () => {
      const upd = await als(
        db,
        ADMIN_A,
        "update memberships set status = 'gesperrt' where user_id = $1 returning user_id",
        [OWNER_A],
      );
      expect(upd).toEqual([]);
      const del = await als(
        db,
        ADMIN_A,
        "delete from memberships where user_id = $1 returning user_id",
        [OWNER_A],
      );
      expect(del).toEqual([]);
    });

    it("niemand kann Abo-Felder selbst setzen", async () => {
      await expect(
        als(db, OWNER_A, "update tenants set abo_status = 'active' where id = $1", [VEREIN_A]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        als(db, OWNER_A, "update tenants set stripe_customer_id = 'x' where id = $1", [VEREIN_A]),
      ).rejects.toThrow(/permission denied/);
    });

    it("niemand kann Vereine direkt anlegen oder Tabellen leeren", async () => {
      await expect(
        als(db, OWNER_A, "insert into tenants (name, slug) values ('Neu', 'neu-verein')"),
      ).rejects.toThrow(/permission denied/);
      await expect(als(db, OWNER_A, "truncate memberships")).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  describe("Abo-Status steuert den Zugriff", () => {
    it("gekündigt: Trainer gesperrt, Owner und Admin dürfen noch lesen", async () => {
      await db.query("update tenants set abo_status = 'canceled' where id = $1", [VEREIN_A]);
      try {
        const lesen = async (u: string) =>
          (await als(db, u, "select private.darf_lesen($1) as l", [VEREIN_A]))[0].l;
        expect(await lesen(TRAINER_A)).toBe(false);
        expect(await lesen(OWNER_A)).toBe(true);
        expect(await lesen(ADMIN_A)).toBe(true);
      } finally {
        await db.query("update tenants set abo_status = 'active' where id = $1", [VEREIN_A]);
      }
    });

    it("past_due: Zugriff bleibt während der Mahnfrist", async () => {
      await db.query("update tenants set abo_status = 'past_due' where id = $1", [VEREIN_A]);
      try {
        const [r] = await als(db, TRAINER_A, "select private.darf_lesen($1) as l", [VEREIN_A]);
        expect(r.l).toBe(true);
      } finally {
        await db.query("update tenants set abo_status = 'active' where id = $1", [VEREIN_A]);
      }
    });
  });

  describe("Profile", () => {
    it("Profil wird bei der Registrierung angelegt, jeder sieht nur seines", async () => {
      const rows = await als(db, OWNER_A, "select user_id, name from profiles");
      expect(rows).toEqual([{ user_id: OWNER_A, name: "Owner A" }]);
    });

    it("fremdes Profil kann nicht geändert werden", async () => {
      const rows = await als(
        db,
        OWNER_A,
        "update profiles set name = 'x' where user_id = $1 returning user_id",
        [OWNER_B],
      );
      expect(rows).toEqual([]);
    });
  });
});
