import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

/**
 * Testdatenbank für RLS-Tests.
 *
 * TEST_DATABASE_URL zeigt auf einen Postgres-Server mit Superuser, z. B.
 *   lokal mit Supabase: postgresql://postgres:postgres@127.0.0.1:54322/postgres
 *   in CI:              postgresql://postgres:postgres@127.0.0.1:5432/postgres
 * Es wird jedes Mal eine frische Datenbank "coachlab_rls_test" erstellt.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
const TESTDB = "coachlab_rls_test";

const WURZEL = join(__dirname, "..", "..");

export async function frischeDatenbank(): Promise<Client> {
  const admin = new Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TESTDB} with (force)`);
  await admin.query(`create database ${TESTDB}`);
  await admin.end();

  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${TESTDB}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();

  await db.query(readFileSync(join(WURZEL, "tests/db/supabase-shim.sql"), "utf8"));

  const ordner = join(WURZEL, "supabase/migrations");
  for (const datei of readdirSync(ordner).filter((d) => d.endsWith(".sql")).sort()) {
    await db.query(readFileSync(join(ordner, datei), "utf8"));
  }
  return db;
}

/**
 * Führt eine Abfrage aus, als wäre sie über die Supabase-API mit dem Login
 * des Benutzers gekommen (Rolle authenticated) bzw. anonym (userId = null).
 * Alles läuft in einer Transaktion, die zurückgerollt wird.
 */
export async function als<T = Record<string, unknown>>(
  db: Client,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.query("begin");
  try {
    await db.query(`set local role ${userId ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "anon" }),
    ]);
    const res = await db.query(sql, params);
    return res.rows as T[];
  } finally {
    await db.query("rollback");
  }
}
