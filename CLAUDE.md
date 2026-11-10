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
- Supabase (Region EU, Irland eu-west-1, Projekt mhijnhtwutzatekpstxg): Auth, Postgres mit Row Level Security, Storage
- Stripe Billing (Checkout, Webhooks, Kundenportal)
- MCP-Server unter src/app/api/mcp (OAuth), Schemas in src/lib/schema.ts (Zod)
- Tests: Vitest (`tests/`)

## Ordner
- src/app/(public)         Startseite, Preise, Verein registrieren
- src/app/(tenant)/[verein]        Vereinsseiten: Start, Login, Einladung, später Bibliothek usw.
- src/app/(tenant)/[verein]/admin  Mitglieder, später Entwürfe, Freigabe, Vereinsdaten
- src/app/auth/callback    Ziel der Bestätigungs-E-Mails (globaler Pfad, nicht pro Verein)
- src/app/api/mcp          Connector-Endpunkt (MCP, Streamable HTTP, ohne Sitzungen, Bearer-Token)
- src/lib/mcp/             auth.ts (Token, Metadaten), werkzeuge.ts (Tools), pruefen.ts (Format +
                           Standard vor dem Speichern), regeln.ts (Texte für Claude)
- src/app/oauth/zustimmung Zustimmungsseite (Supabase OAuth 2.1 «Authorization Path»), global
- src/app/.well-known/oauth-protected-resource  Metadaten für den Connector (RFC 9728)
- src/app/api/stripe/webhook  Stripe-Webhook (Signatur, Idempotenz über Tabelle stripe_events)
- src/lib/stripe/          client.ts, abo.ts (Abbildung Stripe -> tenants, getestet), sync.ts,
                           webhook.ts (Ereignisse), checkout.ts (Checkout, Kundenportal)
- src/app/(public)/registrieren  Verein registrieren: Konto -> Verein -> Stripe Checkout
- src/app/(tenant)/[verein]/admin/abo  Abo-Status, Kundenportal
- src/components/animation Animations-Player (gilt für alle Vereine): engine.ts (reine Logik,
                           getestet), standard.ts (Animationsstandard), spielfeld.tsx (SVG, Skizze
                           für Druck), player.tsx (Steuerung)
- src/lib/uebung-schema.ts Pflichtformat Übung + Animation (Zod), re-exportiert in schema.ts
- src/lib/uebung-filter.ts Filter der Bibliothek, alle Filter in der URL
- src/lib/uebungen.ts      Datenzugriff Übungen (Bibliothek, Admin-Liste, Detail mit Zod-Prüfung)
- tests/fixtures/uebungen  Beispielübungen im Pflichtformat (Tests und Seed)
- src/lib/tenant.ts        Mandanten-Erkennung über die Subdomain
- src/lib/supabase/        client.ts (Browser), server.ts (Server, RLS), admin.ts (Service-Role)
- src/lib/verein.ts        Data Access Layer: Verein, Benutzer, Zugang (zugang(), nurVerwalter())
- src/proxy.ts             Subdomain -> interner Pfad /<slug>, Header x-coachlab-tenant, Session
- supabase/migrations      Datenbank-Migrationen inkl. RLS
- plugin/                  Claude-Plugin "Coachlab": Connector (.mcp.json) und Skill uebung-erfassen
- docs/                    betreiber-handbuch.md, admin-handbuch-verein.md

## Routing der Vereine
- zug94.coachlab.com/uebungen wird im Proxy intern auf /zug94/uebungen umgeschrieben.
- Ohne Subdomain (netlify.app, Deploy-Vorschau) ist der Verein direkt unter /zug94 erreichbar.
- Links immer mit vereinsBasis(slug) bauen ("" auf der Subdomain, sonst "/zug94").
- Neue öffentliche Pfade auf oberster Ebene in RESERVIERTE_SUBDOMAINS (src/lib/tenant.ts)
  UND im Constraint tenants_slug_nicht_reserviert eintragen (Test prüft Gleichheit).
- Cache Components ist bewusst aus (next.config.ts): fast alles hängt vom Login ab.
- Tarif "gratis": nie abrechnen, Stripe-Webhooks müssen solche Vereine überspringen.

## Abo (Phase 4)
- Stripe Billing: Produkt coachlab_verein, Preise per lookup_key coachlab_verein_monat/_jahr, 14 Tage
  Testphase (nur erstes Abo), gehosteter Checkout, Kundenportal. Keine MWST (GmbH nicht pflichtig).
- Abo-Felder in tenants schreibt nur der Server (Service-Role). Webhook holt das Abo immer frisch
  bei Stripe (reihenfolgeunabhängig). Zuordnung über tenants.stripe_customer_id.
- Neue Vereine: verein_registrieren() -> abo_status incomplete -> Checkout -> Webhook.

## Connector (Phase 3)
- Autorisierungsserver ist Supabase Auth (OAuth 2.1, Dynamic Client Registration). Tokens sind normale
  Benutzer-JWTs: Abfragen laufen unter RLS, nie mit dem Service-Role-Key.
- Der Connector speichert immer als Entwurf und überschreibt nur mit ueberschreiben: true. Freigabe nur
  auf der Website.
- /api/mcp und /.well-known sind vom Proxy ausgenommen, /oauth ist global (wie /auth).

## Übungen
- exercises.daten enthält die Übung im Pflichtformat; Filterspalten (titel, stufen, spieler_min ...)
  und die Volltextsuche füllt der Trigger uebung_felder_setzen. Nie direkt schreiben.
- Benutzer dürfen nur tenant_id, daten und status schreiben (Spaltenrechte).
- Wird daten einer freigegebenen Übung geändert, wird sie automatisch wieder Entwurf.
- Jede Änderung landet in content_versions (Trigger), lesbar nur für Owner/Admins.
- Trainer sehen nur freigegebene Übungen; Owner/Admins zusätzlich Entwürfe (Vorschau).
- Optionale Felder: belastung, regeln, fehlerbilder, leitsatz; Teams A, B, C (drittes Team), N (neutral).

## Animationen (Coachlab-Standard, gilt für jede Übung)
- Details: docs/animations-standard.md, Code: src/components/animation/standard.ts (nachStandard).
- Gespeichert werden nur Pässe, Schüsse, Dribblings und Schlüssel-Laufwege; alle übrigen Spieler
  bewegt der Standard automatisch (Player wendet ihn an).
- Ballbesitz bildet Dreiecke; wer den Ball verliert, presst sofort (Gegenpressing) und stellt Passwege zu.
- Kein Pass durch oder über einen Spieler (passKonflikte). Zonen/Bahnen/Hälften/Drittel/Box immer in
  animation.zonen: werden farbig gezeichnet und gesperrt (nur Markierung: sperren: false).
- Jede Animation zeigt einen ganzen Spielzug inkl. Ballverlust und Umschalten. Keine Pfeile im Player.

## Unverhandelbare Regeln
1. Jede Inhaltstabelle hat tenant_id und RLS. Keine Abfrage ohne Mandanten-Kontext.
2. Jede Schemaänderung = Migration + Anpassung in src/lib/schema.ts + Test.
3. Der Test "Verein A sieht nichts von Verein B" muss immer grün sein.
4. Zugriff hängt am abo_status des Mandanten (trialing/active = voll).
5. Service-Role-Key (SUPABASE_SECRET_KEY) nur serverseitig (Webhooks, Migrationen), nie im Browser.
6. Stripe-Webhooks immer signaturgeprüft und idempotent.

## Migrationen in Produktion
Erst nach dem Merge in main über den Supabase-Connector (apply_migration) einspielen,
danach get_advisors (security) prüfen und den Dateinamen in supabase/migrations an die
Version aus list_migrations angleichen. Liste im Betreiber-Handbuch nachführen.

## Lokal entwickeln
- `npm run db:start` startet Supabase lokal (Docker nötig), `npm run dev` die Website.
- Vereine lokal über `http://<slug>.coachlab.localhost:3000` aufrufen.

## Ablauf bei Code-Änderungen
Branch -> Änderung -> npm run lint, npm run test, npm run build -> Pull Request ->
Netlify-Vorschau melden. Nie direkt auf main pushen.

## Betrieb und Übergabe
- Alle Konten gehören dem Betreiber (Funktionsadresse), immer zwei Admins.
- Offene Punkte vor dem Go-live: Checkliste im Betreiber-Handbuch (u. a. Supabase Pro + Leaked
  Password Protection). Vor Live-Schaltung daran erinnern.
- Ändert sich ein Ablauf, Konto oder Tool, im selben Pull Request docs/ nachführen.
