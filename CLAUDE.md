# Coachlab – Kontext für Claude

@AGENTS.md

## Was das ist
Coachlab (coachlab.com) ist eine mandantenfähige Plattform für Fussballvereine,
betrieben von der Simpleapps.ch GmbH. Jeder Verein (tenant) registriert sich,
bezahlt ein Abo über Stripe und pflegt eigene Philosophie, Übungen mit Animation,
Videos und Webinare über Claude (Plattform-Connector). Trainer lesen nur.

## Sprache
Deutsch (Schweiz): kein ß, immer "ss". Fussballbegriffe nach SFV. Du-Form.

## Stack
- Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Hosting Netlify
- Achtung Next.js 16: `middleware.ts` heisst jetzt `src/proxy.ts`. Vor neuem Code die
  Doku in `node_modules/next/dist/docs/` lesen.
- Supabase (Region EU, Frankfurt): Auth, Postgres mit Row Level Security, Storage
- Stripe Billing (Checkout, Webhooks, Kundenportal)
- MCP-Server unter src/app/api/mcp (OAuth), Schemas in src/lib/schema.ts (Zod)
- Tests: Vitest (`tests/`)

## Ordner
- src/app/(public)         Startseite, Preise, Verein registrieren
- src/app/(tenant)         Bibliothek, Philosophie, Videos, Webinare, Profil
- src/app/(tenant)/admin   Entwürfe, Freigabe, Mitglieder, Vereinsdaten
- src/app/api/mcp          Connector-Tools
- src/app/api/stripe       Webhooks
- src/components/animation Animations-Player (gilt für alle Vereine)
- src/lib/tenant.ts        Mandanten-Erkennung über die Subdomain
- src/lib/supabase/        client.ts (Browser), server.ts (Server, RLS), admin.ts (Service-Role)
- src/proxy.ts             Setzt Header x-coachlab-tenant, erneuert die Session
- supabase/migrations      Datenbank-Migrationen inkl. RLS
- plugin/                  Claude-Plugin "Coachlab" mit Skills
- docs/                    betreiber-handbuch.md, admin-handbuch-verein.md

## Unverhandelbare Regeln
1. Jede Inhaltstabelle hat tenant_id und RLS. Keine Abfrage ohne Mandanten-Kontext.
2. Jede Schemaänderung = Migration + Anpassung in src/lib/schema.ts + Test.
3. Der Test "Verein A sieht nichts von Verein B" muss immer grün sein.
4. Zugriff hängt am abo_status des Mandanten (trialing/active = voll).
5. Service-Role-Key (SUPABASE_SECRET_KEY) nur serverseitig (Webhooks, Migrationen), nie im Browser.
6. Stripe-Webhooks immer signaturgeprüft und idempotent.

## Lokal entwickeln
- `npm run db:start` startet Supabase lokal (Docker nötig), `npm run dev` die Website.
- Vereine lokal über `http://<slug>.coachlab.localhost:3000` aufrufen.

## Ablauf bei Code-Änderungen
Branch -> Änderung -> npm run lint, npm run test, npm run build -> Pull Request ->
Netlify-Vorschau melden. Nie direkt auf main pushen.

## Betrieb und Übergabe
- Alle Konten gehören dem Betreiber (Funktionsadresse), immer zwei Admins.
- Ändert sich ein Ablauf, Konto oder Tool, im selben Pull Request docs/ nachführen.
