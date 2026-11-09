import { z } from "zod";
import { RESERVIERTE_SUBDOMAINS } from "./tenant";

/**
 * Zod-Schemas für alle Tabellen. Gleiche Regeln wie die CHECK-Constraints in
 * supabase/migrations – bei jeder Schemaänderung beides anpassen (CLAUDE.md, Regel 2).
 */

export const SFV_STUFEN = ["G", "F", "E", "D", "C", "B", "A", "Aktive"] as const;
export const ROLLEN = ["owner", "admin", "trainer"] as const;
export const ABO_STATUS = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
] as const;

export const sfvStufe = z.enum(SFV_STUFEN);
export const rolle = z.enum(ROLLEN);
export const aboStatus = z.enum(ABO_STATUS);

export const slug = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/,
    "3–40 Zeichen: Kleinbuchstaben, Ziffern und Bindestriche, nicht am Anfang oder Ende.",
  )
  .refine((s) => !RESERVIERTE_SUBDOMAINS.has(s), "Diese Subdomain ist reserviert.");

export const farben = z
  .object({
    primaer: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    sekundaer: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
  .strict();

export const tenant = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(120),
  slug,
  logo_url: z.string().nullable(),
  farben,
  plan: z.enum(["monat", "jahr", "gratis"]).nullable(),
  abo_status: aboStatus,
  stripe_customer_id: z.string().nullable(),
  trial_ende: z.string().nullable(),
  erstellt_am: z.string(),
});

/** Was ein Owner/Admin im Admin-Bereich ändern darf. */
export const vereinsdatenAendern = tenant.pick({ name: true, logo_url: true, farben: true }).partial();

export const membership = z.object({
  user_id: z.uuid(),
  tenant_id: z.uuid(),
  rolle,
  status: z.enum(["wartet", "aktiv", "gesperrt"]),
  erstellt_am: z.string(),
});

export const einladungErstellen = z.object({
  tenant_id: z.uuid(),
  email: z.email().nullable().optional(),
  rolle: z.enum(["admin", "trainer"]).default("trainer"),
});

export const profilAendern = z.object({
  name: z.string().max(120).nullable().optional(),
  team_stufe: sfvStufe.nullable().optional(),
  team_spieler: z.number().int().min(1).max(60).nullable().optional(),
  team_torhueter: z.boolean().optional(),
});

export type Tenant = z.infer<typeof tenant>;
export type Membership = z.infer<typeof membership>;
export type Rolle = z.infer<typeof rolle>;
export type SfvStufe = z.infer<typeof sfvStufe>;
