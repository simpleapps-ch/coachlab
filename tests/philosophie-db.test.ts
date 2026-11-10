import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, als, frischeDatenbank } from "./db/datenbank";

/** Philosophie: Entwurf, Freigabe, Sichtbarkeit und PDF-Zugriff (gegen echte Postgres-Datenbank). */

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000001";
const OWNER_A = "aaaaaaaa-0000-0000-0000-0000000000a1";
const TRAINER_A = "aaaaaaaa-0000-0000-0000-0000000000a3";
const OWNER_B = "bbbbbbbb-0000-0000-0000-0000000000b1";

const DOK = JSON.stringify({ titel: "Philosophie", kapitel: [], abschnitte: [] });
const datei = (verein: string, n: number) => `${verein}/00000000-0000-0000-0000-00000000000${n}.pdf`;

let db: Client;

/** Mehrere Abfragen als derselbe Benutzer in einer Transaktion (danach zurückgerollt). */
async function alsMehrere(userId: string, schritte: Array<[string, unknown[]?]>) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    const aus = [];
    for (const [sql, p] of schritte) aus.push((await db.query(sql, p ?? [])).rows);
    return aus;
  } finally {
    await db.query("rollback");
  }
}

describe.skipIf(!TEST_DATABASE_URL)("Philosophie", () => {
  beforeAll(async () => {
    db = await frischeDatenbank("philosophie");
    await db.query(`insert into auth.users (id, email) values ($1, 'oa@t.ch'), ($2, 'ta@t.ch'), ($3, 'ob@t.ch')`, [
      OWNER_A,
      TRAINER_A,
      OWNER_B,
    ]);
    await db.query(
      `insert into tenants (id, name, slug, abo_status) values ($1, 'FC A', 'fc-a', 'active'), ($2, 'FC B', 'fc-b', 'active')`,
      [A, B],
    );
    await db.query(
      `insert into memberships values ($1, $4, 'owner', 'aktiv'), ($2, $4, 'trainer', 'aktiv'), ($3, $5, 'owner', 'aktiv')`,
      [OWNER_A, TRAINER_A, OWNER_B, A, B],
    );
    // Freigegebene Fassung von Verein A
    await db.query(
      `insert into philosophien (tenant_id, status, dokument, datei) values ($1, 'freigegeben', $2, $3)`,
      [A, DOK, datei(A, 1)],
    );
    await db.query(`insert into storage.objects (bucket_id, name) values ('philosophie', $1), ('philosophie', $2)`, [
      datei(A, 1),
      datei(A, 2),
    ]);
  });

  afterAll(async () => {
    await db?.end();
  });

  it("Bucket ist privat und nimmt nur PDFs", async () => {
    const { rows } = await db.query("select public, allowed_mime_types from storage.buckets where id = 'philosophie'");
    expect(rows[0]).toEqual({ public: false, allowed_mime_types: ["application/pdf"] });
  });

  it("Technische Leitung legt einen Entwurf an und gibt ihn frei", async () => {
    const [, vorher, alt, nachher] = await alsMehrere(OWNER_A, [
      ["insert into philosophien (tenant_id, dokument, datei, seiten) values ($1, $2, $3, 28)", [A, DOK, datei(A, 2)]],
      ["select status from philosophien order by status"],
      ["select philosophie_freigeben($1) as alt", [A]],
      ["select status, datei, freigegeben_von from philosophien"],
    ]);
    expect(vorher.map((r) => r.status)).toEqual(["entwurf", "freigegeben"]);
    expect(alt[0].alt).toBe(datei(A, 1));
    expect(nachher).toEqual([{ status: "freigegeben", datei: datei(A, 2), freigegeben_von: OWNER_A }]);
  });

  it("Status lässt sich nicht direkt setzen", async () => {
    await expect(
      als(db, OWNER_A, "insert into philosophien (tenant_id, status, dokument, datei) values ($1, 'freigegeben', $2, $3)", [
        A,
        DOK,
        datei(A, 3),
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(als(db, OWNER_A, "update philosophien set status = 'entwurf'")).rejects.toThrow(/permission denied/);
  });

  it("Trainer sehen nur die freigegebene Fassung und können nichts ändern", async () => {
    const [, sicht] = await alsMehrere(OWNER_A, [
      ["insert into philosophien (tenant_id, dokument, datei) values ($1, $2, $3)", [A, DOK, datei(A, 2)]],
      ["select count(*)::int as n from philosophien"],
    ]);
    expect(sicht[0].n).toBe(2);
    expect(await als(db, TRAINER_A, "select status from philosophien")).toEqual([{ status: "freigegeben" }]);
    await expect(
      als(db, TRAINER_A, "insert into philosophien (tenant_id, dokument, datei) values ($1, $2, $3)", [A, DOK, datei(A, 4)]),
    ).rejects.toThrow(/row-level security/);
    await expect(als(db, TRAINER_A, "select philosophie_freigeben($1)", [A])).rejects.toThrow(/Nur Owner und Admins/);
  });

  it("Verein B sieht nichts von Verein A und legt nichts bei A ab", async () => {
    expect(await als(db, OWNER_B, "select * from philosophien")).toEqual([]);
    await expect(
      als(db, OWNER_B, "insert into philosophien (tenant_id, dokument, datei) values ($1, $2, $3)", [A, DOK, datei(A, 5)]),
    ).rejects.toThrow(/row-level security/);
    // Datei muss im Ordner des eigenen Vereins liegen
    await expect(
      als(db, OWNER_B, "insert into philosophien (tenant_id, dokument, datei) values ($1, $2, $3)", [B, DOK, datei(A, 5)]),
    ).rejects.toThrow(/check constraint/);
  });

  it("PDFs: Trainer lesen nur die freigegebene Datei, fremde Vereine gar nichts", async () => {
    const sichtbar = (user: string) =>
      als<{ name: string }>(db, user, "select name from storage.objects where bucket_id = 'philosophie' order by name");
    expect((await sichtbar(OWNER_A)).map((o) => o.name)).toEqual([datei(A, 1), datei(A, 2)]);
    expect((await sichtbar(TRAINER_A)).map((o) => o.name)).toEqual([datei(A, 1)]);
    expect(await sichtbar(OWNER_B)).toEqual([]);
  });

  it("PDFs hochladen nur in den eigenen Vereinsordner", async () => {
    await expect(
      als(db, OWNER_A, "insert into storage.objects (bucket_id, name) values ('philosophie', $1)", [datei(A, 6)]),
    ).resolves.toBeDefined();
    await expect(
      als(db, OWNER_B, "insert into storage.objects (bucket_id, name) values ('philosophie', $1)", [datei(A, 6)]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      als(db, TRAINER_A, "insert into storage.objects (bucket_id, name) values ('philosophie', $1)", [datei(A, 6)]),
    ).rejects.toThrow(/row-level security/);
  });
});
