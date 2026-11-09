-- Phase 1: Mandanten, Mitgliedschaften, Einladungen, Profile mit Row Level Security.
--
-- Grundsätze (CLAUDE.md):
--   * Jede Zeile gehört über tenant_id zu genau einem Verein.
--   * Lesen nur mit aktiver Mitgliedschaft; Inhalte zusätzlich nur mit aktivem Abo.
--   * Schreiben nur owner und admin des eigenen Vereins.
--   * Abo-Felder (abo_status, plan, stripe_customer_id, trial_ende) schreibt nur der
--     Server mit dem Service-Role-Key (Stripe-Webhook), nie ein Benutzer.

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table public.tenants (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 2 and 120),
  slug               text not null unique
                     check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  logo_url           text,
  farben             jsonb not null default '{}'::jsonb,
  plan               text check (plan in ('monat', 'jahr')),
  abo_status         text not null default 'trialing'
                     check (abo_status in ('trialing', 'active', 'past_due',
                                           'canceled', 'unpaid', 'incomplete')),
  stripe_customer_id text unique,
  trial_ende         timestamptz,
  erstellt_am        timestamptz not null default now()
);

comment on table public.tenants is 'Ein Verein (Mandant) mit Subdomain und Abo-Status.';

create table public.memberships (
  user_id     uuid not null references auth.users (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  rolle       text not null check (rolle in ('owner', 'admin', 'trainer')),
  status      text not null default 'wartet'
              check (status in ('wartet', 'aktiv', 'gesperrt')),
  erstellt_am timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

-- Pro Verein genau ein Owner.
create unique index memberships_ein_owner_je_verein
  on public.memberships (tenant_id) where rolle = 'owner';

create index memberships_tenant_idx on public.memberships (tenant_id);

create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  email         text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  code          text not null unique
                default replace(gen_random_uuid()::text, '-', ''),
  rolle         text not null default 'trainer' check (rolle in ('admin', 'trainer')),
  gueltig_bis   timestamptz not null default now() + interval '14 days',
  erstellt_von  uuid references auth.users (id) on delete set null,
  angenommen_am timestamptz,
  erstellt_am   timestamptz not null default now()
);

create index invitations_tenant_idx on public.invitations (tenant_id);

create table public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  name           text check (name is null or char_length(name) <= 120),
  team_stufe     text check (team_stufe in ('G', 'F', 'E', 'D', 'C', 'B', 'A', 'Aktive')),
  team_spieler   int check (team_spieler between 1 and 60),
  team_torhueter boolean not null default false,
  erstellt_am    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen (security definer, damit Policies nicht rekursiv werden)
-- Liegen im Schema "private", das nicht über die API erreichbar ist.
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Aktive Mitgliedschaft des angemeldeten Benutzers im Verein.
create function private.ist_mitglied(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'aktiv'
  );
$$;

-- Aktive Mitgliedschaft mit einer der Rollen.
create function private.hat_rolle(p_tenant uuid, p_rollen text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'aktiv'
      and m.rolle = any (p_rollen)
  );
$$;

-- Abo erlaubt vollen Zugriff (past_due: Zugriff bleibt während der Mahnfrist).
create function private.abo_aktiv(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tenants t
    where t.id = p_tenant
      and t.abo_status in ('trialing', 'active', 'past_due')
  );
$$;

-- Darf Inhalte des Vereins lesen: Mitglied mit aktivem Abo,
-- oder owner/admin (die auch bei gekündigtem Abo noch lesen und exportieren).
create function private.darf_lesen(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (private.ist_mitglied(p_tenant) and private.abo_aktiv(p_tenant))
      or private.hat_rolle(p_tenant, array['owner', 'admin']);
$$;

-- Darf Inhalte und Mitglieder des Vereins verwalten.
create function private.darf_verwalten(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.hat_rolle(p_tenant, array['owner', 'admin']);
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.tenants     enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.profiles    enable row level security;

-- Anonyme Besucher erhalten keinen direkten Tabellenzugriff.
revoke all on public.tenants, public.memberships, public.invitations, public.profiles from anon;
-- TRUNCATE umgeht RLS und ist darum für Benutzer gesperrt.
revoke truncate, references, trigger
  on public.tenants, public.memberships, public.invitations, public.profiles from authenticated;

-- tenants --------------------------------------------------------------------
create policy "Mitglieder sehen ihren Verein"
  on public.tenants for select to authenticated
  using ((select private.ist_mitglied(id)));

create policy "Owner und Admins ändern Vereinsdaten"
  on public.tenants for update to authenticated
  using ((select private.darf_verwalten(id)))
  with check ((select private.darf_verwalten(id)));

-- Benutzer dürfen nur Name, Logo und Farben ändern; Abo-Felder nur der Server.
revoke insert, update, delete on public.tenants from authenticated;
grant update (name, logo_url, farben) on public.tenants to authenticated;

-- memberships ----------------------------------------------------------------
create policy "Eigene Mitgliedschaften sehen"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.darf_verwalten(tenant_id)));

-- Owner und Admins verwalten Mitglieder; die Owner-Zeile ändert nur der Owner.
create policy "Owner und Admins nehmen Mitglieder auf"
  on public.memberships for insert to authenticated
  with check (
    (select private.darf_verwalten(tenant_id))
    and (rolle <> 'owner' or (select private.hat_rolle(tenant_id, array['owner'])))
  );

create policy "Owner und Admins ändern Mitglieder"
  on public.memberships for update to authenticated
  using (
    (select private.darf_verwalten(tenant_id))
    and (rolle <> 'owner' or (select private.hat_rolle(tenant_id, array['owner'])))
  )
  with check (
    (select private.darf_verwalten(tenant_id))
    and (rolle <> 'owner' or (select private.hat_rolle(tenant_id, array['owner'])))
  );

create policy "Owner und Admins entfernen Mitglieder"
  on public.memberships for delete to authenticated
  using ((select private.darf_verwalten(tenant_id)) and rolle <> 'owner');

-- invitations ----------------------------------------------------------------
create policy "Owner und Admins verwalten Einladungen"
  on public.invitations for all to authenticated
  using ((select private.darf_verwalten(tenant_id)))
  with check ((select private.darf_verwalten(tenant_id)));

-- profiles -------------------------------------------------------------------
create policy "Eigenes Profil lesen"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Eigenes Profil anlegen"
  on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Eigenes Profil ändern"
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Öffentliche Vereinsdaten für Login-Seite und Branding (ohne Abo-Details)
-- ---------------------------------------------------------------------------

create function public.verein_oeffentlich(p_slug text)
returns table (id uuid, name text, slug text, logo_url text, farben jsonb)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.name, t.slug, t.logo_url, t.farben
  from public.tenants t
  where t.slug = lower(p_slug);
$$;

revoke all on function public.verein_oeffentlich(text) from public;
grant execute on function public.verein_oeffentlich(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profil automatisch anlegen, wenn sich jemand registriert
-- ---------------------------------------------------------------------------

create function private.neuer_benutzer()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger profil_bei_registrierung
  after insert on auth.users
  for each row execute function private.neuer_benutzer();
