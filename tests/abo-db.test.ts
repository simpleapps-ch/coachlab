import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, als, frischeDatenbank } from "./db/datenbank";

/** Phase 4: Registrierung neuer Vereine und Abo-Felder (gegen echte Postgres-Datenbank). */

const NEU = "dddddddd-0000-0000-0000-0000000000d1";
const ANDERE = "dddddddd-0000-0000-0000-0000000000d2";
const OWNER_GRATIS = "dddddddd-0000-0000-0000-0000000000d3";
const GRATIS = "eeeeeeee-0000-0000-0000-000000000001";

let db: Client;

/** Mehrere Abfragen als derselbe Benutzer in einer Transaktion (danach zurückgerollt). */
async function alsMehrere(userId: string, schritte: Array<[string, unknown[]?]>) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    const ergebnisse = [];
    for (const [sql, p] of schritte) ergebnisse.push((await db.query(sql, p ?? [])).rows);
    return ergebnisse;
  } finally {
    await db.query("rollback");
  }
}

describe.skipIf(!TEST_DATABASE_URL)("Abo und Registrierung", () => {
  beforeAll(async () => {
    db = await frischeDatenbank("abo");
    await db.query(
      `insert into auth.users (id, email) values ($1, 'neu@test.ch'), ($2, 'andere@test.ch'), ($3, 'gratis@test.ch')`,
      [NEU, ANDERE, OWNER_GRATIS],
    );
    await db.query(
      `insert into public.tenants (id, name, slug, plan, abo_status) values ($1, 'Zug Test', 'zug-test', 'gratis', 'active')`,
      [GRATIS],
    );
    await db.query(`insert into public.memberships values ($1, $2, 'owner', 'aktiv')`, [OWNER_GRATIS, GRATIS]);
  });

  afterAll(async () => {
    await db?.end();
  });

  it("legt einen Verein ohne Abo an, die Person wird Technische Leitung", async () => {
    const [reg, verein, mitglied] = await alsMehrere(NEU, [
      ["select * from verein_registrieren('FC Neu', 'FC-Neu')"],
      ["select slug, abo_status, plan from tenants"],
      ["select rolle, status from memberships"],
    ]);
    expect(reg[0]).toMatchObject({ slug: "fc-neu", neu: true });
    expect(verein).toEqual([{ slug: "fc-neu", abo_status: "incomplete", plan: null }]);
    expect(mitglied).toEqual([{ rolle: "owner", status: "aktiv" }]);
  });

  it("pro Person nur ein Verein ohne Abo: zweiter Aufruf übernimmt den ersten", async () => {
    const [a, b, alle] = await alsMehrere(NEU, [
      ["select * from verein_registrieren('FC Neu', 'fc-neu')"],
      ["select * from verein_registrieren('FC Neu 2', 'fc-neu-2')"],
      ["select name, slug from tenants order by slug"],
    ]);
    expect(b[0].id).toBe(a[0].id);
    expect(b[0].neu).toBe(false);
    expect(alle).toEqual([{ name: "FC Neu 2", slug: "fc-neu-2" }]);
  });

  it("ohne Login, mit reserviertem oder vergebenem Slug: Fehler", async () => {
    await expect(als(db, null, "select * from verein_registrieren('FC X', 'fc-x')")).rejects.toThrow();
    await expect(als(db, ANDERE, "select * from verein_registrieren('FC X', 'oauth')")).rejects.toThrow(
      /tenants_slug_nicht_reserviert/,
    );
    await expect(als(db, ANDERE, "select * from verein_registrieren('FC X', 'zug-test')")).rejects.toThrow(
      /tenants_slug_key/,
    );
  });

  it("slug_frei auch ohne Login", async () => {
    expect((await als<{ frei: boolean }>(db, null, "select slug_frei('zug-test') as frei"))[0].frei).toBe(false);
    expect((await als<{ frei: boolean }>(db, null, "select slug_frei('fc-frei') as frei"))[0].frei).toBe(true);
  });

  it("Abo-Felder kann kein Benutzer ändern, auch nicht die Technische Leitung", async () => {
    await expect(
      als(db, OWNER_GRATIS, "update tenants set abo_status = 'active', stripe_subscription_id = 'sub_x'"),
    ).rejects.toThrow(/permission denied/);
    await expect(als(db, OWNER_GRATIS, "update tenants set abo_gekuendigt = true")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("stripe_events ist für Benutzer unsichtbar", async () => {
    await db.query("insert into stripe_events (id, typ) values ('evt_test1', 'invoice.paid')");
    await expect(als(db, OWNER_GRATIS, "select * from stripe_events")).rejects.toThrow(/permission denied/);
    await expect(als(db, null, "select * from stripe_events")).rejects.toThrow(/permission denied/);
  });

  it("Gratis-Vereine bekommen nie ein Stripe-Abo", async () => {
    await expect(
      db.query("update tenants set stripe_subscription_id = 'sub_x' where id = $1", [GRATIS]),
    ).rejects.toThrow(/tenants_gratis_ohne_stripe/);
  });
});
