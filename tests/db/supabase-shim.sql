-- Minimaler Nachbau der Supabase-Umgebung für RLS-Tests auf einem nackten Postgres
-- (CI, lokale Tests ohne Docker). Auf einer echten Supabase-Datenbank wird nichts
-- verändert, weil Rollen und Schema "auth" dort schon existieren.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    grant usage on schema auth to anon, authenticated, service_role;

    create table auth.users (
      id                 uuid primary key,
      email              text unique,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );

    -- Wie in Supabase: Benutzer-ID aus den JWT-Claims der Anfrage.
    create function auth.uid() returns uuid
    language sql stable
    as 'select nullif(coalesce(
          current_setting(''request.jwt.claim.sub'', true),
          (current_setting(''request.jwt.claims'', true)::jsonb ->> ''sub'')
        ), '''')::uuid';
  end if;
end
$$;

-- Wie in Supabase: alle neuen Tabellen und Funktionen in public sind für die
-- API-Rollen freigegeben; geschützt wird über RLS und gezielte REVOKEs.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
