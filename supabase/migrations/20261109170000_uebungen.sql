-- Phase 2: Übungen mit Animation, Versionsverlauf.
--
-- Die vollständige Übung liegt im Pflichtformat in "daten" (jsonb, geprüft mit dem
-- Zod-Schema in src/lib/uebung-schema.ts). Die Spalten für Filter und Suche füllt ein
-- Trigger aus "daten", damit sie nie auseinanderlaufen.

create table public.exercises (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  slug             text not null,
  status           text not null default 'entwurf' check (status in ('entwurf', 'freigegeben')),
  daten            jsonb not null check (jsonb_typeof(daten) = 'object'),

  -- aus "daten" abgeleitet (Trigger)
  titel            text not null,
  stufen           text[] not null,
  spieler_min      int not null,
  spieler_max      int not null,
  mit_torhueter    boolean not null,
  kategorie        text not null,
  spielphase       text not null,
  dauer_min        int not null,
  intensitaet      text not null,
  prinzipien       text[] not null default '{}',
  suche            tsvector,

  erstellt_von     uuid references auth.users (id) on delete set null default auth.uid(),
  erstellt_am      timestamptz not null default now(),
  geaendert_am     timestamptz not null default now(),
  freigegeben_von  uuid references auth.users (id) on delete set null,
  freigegeben_am   timestamptz,

  unique (tenant_id, slug),
  check (spieler_min <= spieler_max),
  check (stufen <@ array['G', 'F', 'E', 'D', 'C', 'B', 'A', 'Aktive']::text[] and cardinality(stufen) > 0),
  check (kategorie in ('Technik', 'Taktik', 'Athletik', 'Torhüter', 'Spielform')),
  check (spielphase in ('Ballbesitz', 'Gegnerischer Ballbesitz', 'Umschalten', 'Standard')),
  check (intensitaet in ('tief', 'mittel', 'hoch'))
);

create index exercises_tenant_status_idx on public.exercises (tenant_id, status);
create index exercises_stufen_idx on public.exercises using gin (stufen);
create index exercises_suche_idx on public.exercises using gin (suche);

-- Spalten aus "daten" ableiten; Änderungen an einer freigegebenen Übung
-- machen sie wieder zum Entwurf (muss neu freigegeben werden).
create function private.uebung_felder_setzen()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  d jsonb := new.daten;
begin
  if d ->> 'id' is null or d ->> 'titel' is null or d -> 'spieler' is null
     or jsonb_typeof(d -> 'stufen') <> 'array' then
    raise exception 'Übung unvollständig: id, titel, stufen und spieler sind Pflicht'
      using errcode = '23514';
  end if;

  new.slug          := d ->> 'id';
  new.titel         := d ->> 'titel';
  new.stufen        := array(select jsonb_array_elements_text(d -> 'stufen'));
  new.spieler_min   := (d -> 'spieler' ->> 'min')::int;
  new.spieler_max   := (d -> 'spieler' ->> 'max')::int;
  new.mit_torhueter := (d -> 'spieler' ->> 'mit_torhueter')::boolean;
  new.kategorie     := d ->> 'kategorie';
  new.spielphase    := d ->> 'spielphase';
  new.dauer_min     := (d ->> 'dauer_min')::int;
  new.intensitaet   := d ->> 'intensitaet';
  new.prinzipien    := coalesce(array(select jsonb_array_elements_text(d -> 'prinzipien')), '{}');
  new.suche :=
       setweight(to_tsvector('german', coalesce(d ->> 'titel', '')), 'A')
    || setweight(to_tsvector('german', coalesce(d ->> 'ziel', '')), 'B')
    || setweight(to_tsvector('german', coalesce(d ->> 'kategorie', '') || ' '
                                        || coalesce(d ->> 'spielphase', '')), 'B')
    || setweight(to_tsvector('german', coalesce((
         select string_agg(value, ' ')
         from jsonb_array_elements_text(coalesce(d -> 'coachingpunkte', '[]') || coalesce(d -> 'ablauf', '[]'))
       ), '')), 'C');

  if tg_op = 'UPDATE' then
    new.geaendert_am := now();
    if new.daten is distinct from old.daten and new.status = old.status then
      new.status := 'entwurf';
    end if;
  end if;

  if new.status = 'freigegeben' and (tg_op = 'INSERT' or old.status <> 'freigegeben') then
    new.freigegeben_am  := now();
    new.freigegeben_von := auth.uid();
  elsif new.status = 'entwurf' then
    new.freigegeben_am  := null;
    new.freigegeben_von := null;
  end if;
  return new;
end;
$$;

create trigger uebung_felder
  before insert or update on public.exercises
  for each row execute function private.uebung_felder_setzen();

-- ---------------------------------------------------------------------------
-- Versionsverlauf: jede Änderung mit wer, wann, vorher, nachher.
-- ---------------------------------------------------------------------------

create table public.content_versions (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  tabelle      text not null,
  datensatz_id uuid not null,
  aktion       text not null check (aktion in ('erstellt', 'geaendert', 'geloescht')),
  wer          uuid references auth.users (id) on delete set null,
  wann         timestamptz not null default now(),
  vorher       jsonb,
  nachher      jsonb
);

create index content_versions_datensatz_idx on public.content_versions (tenant_id, datensatz_id, wann desc);

create function private.version_speichern()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.content_versions (tenant_id, tabelle, datensatz_id, aktion, wer, vorher, nachher)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    tg_table_name,
    coalesce(new.id, old.id),
    case tg_op when 'INSERT' then 'erstellt' when 'UPDATE' then 'geaendert' else 'geloescht' end,
    auth.uid(),
    case when tg_op <> 'INSERT' then to_jsonb(old) - 'suche' end,
    case when tg_op <> 'DELETE' then to_jsonb(new) - 'suche' end
  );
  return null;
end;
$$;

create trigger uebung_version
  after insert or update or delete on public.exercises
  for each row execute function private.version_speichern();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.content_versions enable row level security;

revoke all on public.exercises, public.content_versions from anon;
revoke truncate, references, trigger on public.exercises, public.content_versions from authenticated;
-- Versionen schreibt nur der Trigger.
revoke insert, update, delete on public.content_versions from authenticated;

-- Trainer sehen freigegebene Übungen (aktives Abo), Owner/Admins zusätzlich Entwürfe.
create policy "Übungen lesen"
  on public.exercises for select to authenticated
  using (
    (status = 'freigegeben' and (select private.darf_lesen(tenant_id)))
    or (select private.darf_verwalten(tenant_id))
  );

create policy "Owner und Admins erfassen Übungen"
  on public.exercises for insert to authenticated
  with check ((select private.darf_verwalten(tenant_id)));

create policy "Owner und Admins ändern Übungen"
  on public.exercises for update to authenticated
  using ((select private.darf_verwalten(tenant_id)))
  with check ((select private.darf_verwalten(tenant_id)));

create policy "Owner und Admins löschen Übungen"
  on public.exercises for delete to authenticated
  using ((select private.darf_verwalten(tenant_id)));

create policy "Owner und Admins sehen den Verlauf"
  on public.content_versions for select to authenticated
  using ((select private.darf_verwalten(tenant_id)));

-- Abgeleitete Spalten und Freigabe-Felder setzt nur der Trigger.
revoke insert, update on public.exercises from authenticated;
grant insert (tenant_id, daten, status) on public.exercises to authenticated;
grant update (daten, status) on public.exercises to authenticated;
