-- Minimaler Nachbau der Supabase-Umgebung für RLS-Tests auf einem nackten Postgres
-- (CI, lokale Tests ohne Docker). Auf einer echten Supabase-Datenbank wird nichts
-- verändert, weil Rollen und Schema "auth" dort schon existieren.

-- Rollen gelten serverweit; parallel laufende Testdateien legen sie evtl. gleichzeitig an.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      begin
        execute format('create role %I nologin noinherit%s', r,
                       case when r = 'service_role' then ' bypassrls' else '' end);
      exception when duplicate_object or unique_violation then
        null; -- von der anderen Testdatei gerade angelegt
      end;
    end if;
  end loop;
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
    -- Wie Supabase: leere Werte (nach einer zurückgerollten Transaktion) zählen als nicht gesetzt.
    as 'select coalesce(
          nullif(current_setting(''request.jwt.claim.sub'', true), ''''),
          (nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb ->> ''sub'')
        )::uuid';
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

-- Minimaler Nachbau von Supabase Storage (Tabellen und Hilfsfunktion), damit Migrationen
-- mit Buckets und Storage-Policies auch auf einem nackten Postgres laufen.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    create schema storage;
    grant usage on schema storage to anon, authenticated, service_role;

    create table storage.buckets (
      id                 text primary key,
      name               text not null,
      public             boolean default false,
      file_size_limit    bigint,
      allowed_mime_types text[]
    );

    create table storage.objects (
      id        uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name      text,
      owner     uuid
    );
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;

    create function storage.foldername(name text) returns text[]
    language sql immutable
    as $f$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $f$;
  end if;
end
$$;
