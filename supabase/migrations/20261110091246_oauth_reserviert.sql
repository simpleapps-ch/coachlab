-- Phase 3: Die Zustimmungsseite des Connectors liegt unter /oauth (globaler Pfad).
-- "oauth" darf darum kein Vereins-Slug sein. Gleiche Liste wie RESERVIERTE_SUBDOMAINS
-- in src/lib/tenant.ts (Test prüft Gleichheit).

alter table public.tenants drop constraint tenants_slug_nicht_reserviert;

alter table public.tenants add constraint tenants_slug_nicht_reserviert
  check (slug not in (
    'www', 'app', 'admin', 'api', 'mcp', 'auth', 'login', 'docs', 'hilfe', 'support',
    'status', 'mail', 'staging', 'preview', 'preise', 'registrieren', 'impressum',
    'datenschutz', 'agb', 'konto', 'einladung', 'verein', 'vereine', 'coachlab', 'oauth'
  ));
