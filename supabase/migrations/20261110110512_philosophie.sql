-- Ausbildungs- und Spielphilosophie: Der Verein lädt sein Dokument (PDF) hoch, Coachlab macht
-- daraus Abschnitte zum Durchklicken. Das PDF liegt im privaten Bucket "philosophie" unter
-- <tenant_id>/<zufall>.pdf, die aufbereiteten Abschnitte in philosophien.dokument (jsonb,
-- geprüft mit src/lib/philosophie/schema.ts).
--
-- Pro Verein höchstens ein Entwurf und eine freigegebene Fassung. Trainer sehen nur die
-- freigegebene; Owner/Admins laden hoch, prüfen in der Vorschau und geben frei.

create table public.philosophien (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  status          text not null default 'entwurf' check (status in ('entwurf', 'freigegeben')),
  dokument        jsonb not null check (jsonb_typeof(dokument) = 'object'),
  datei           text not null check (datei ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
  dateiname       text check (char_length(dateiname) <= 200),
  seiten          int check (seiten between 1 and 300),
  erstellt_von    uuid references auth.users (id) on delete set null default auth.uid(),
  erstellt_am     timestamptz not null default now(),
  geaendert_am    timestamptz not null default now(),
  freigegeben_von uuid references auth.users (id) on delete set null,
  freigegeben_am  timestamptz,
  unique (tenant_id, status),
  check (split_part(datei, '/', 1) = tenant_id::text)
);

create index philosophien_tenant_idx on public.philosophien (tenant_id);

create function private.philosophie_geaendert()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.geaendert_am := now();
  return new;
end;
$$;

create trigger philosophie_geaendert
  before update on public.philosophien
  for each row execute function private.philosophie_geaendert();

-- Jede Änderung im Verlauf (gleicher Trigger wie bei den Übungen).
create trigger philosophie_version
  after insert or update or delete on public.philosophien
  for each row execute function private.version_speichern();

alter table public.philosophien enable row level security;
revoke all on public.philosophien from anon;
revoke truncate, references, trigger on public.philosophien from authenticated;

create policy "Philosophie lesen"
  on public.philosophien for select to authenticated
  using (
    (status = 'freigegeben' and (select private.darf_lesen(tenant_id)))
    or (select private.darf_verwalten(tenant_id))
  );

create policy "Owner und Admins erfassen Entwürfe"
  on public.philosophien for insert to authenticated
  with check (status = 'entwurf' and (select private.darf_verwalten(tenant_id)));

create policy "Owner und Admins ändern Entwürfe"
  on public.philosophien for update to authenticated
  using (status = 'entwurf' and (select private.darf_verwalten(tenant_id)))
  with check (status = 'entwurf' and (select private.darf_verwalten(tenant_id)));

create policy "Owner und Admins löschen"
  on public.philosophien for delete to authenticated
  using ((select private.darf_verwalten(tenant_id)));

-- Status und Freigabe-Felder setzt nur philosophie_freigeben().
revoke insert, update on public.philosophien from authenticated;
grant insert (tenant_id, dokument, datei, dateiname, seiten) on public.philosophien to authenticated;
grant update (dokument, datei, dateiname, seiten) on public.philosophien to authenticated;

-- Entwurf freigeben: ersetzt die bisherige freigegebene Fassung in einem Schritt.
-- Gibt den Pfad der ersetzten Datei zurück (die Website löscht sie danach im Storage).
create function public.philosophie_freigeben(p_tenant uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_alt text;
begin
  if not private.darf_verwalten(p_tenant) then
    raise exception 'Nur Owner und Admins geben frei' using errcode = '42501';
  end if;
  if not exists (select 1 from public.philosophien where tenant_id = p_tenant and status = 'entwurf') then
    raise exception 'Kein Entwurf vorhanden' using errcode = 'P0002';
  end if;

  delete from public.philosophien where tenant_id = p_tenant and status = 'freigegeben'
  returning datei into v_alt;

  update public.philosophien
     set status = 'freigegeben', freigegeben_am = now(), freigegeben_von = auth.uid()
   where tenant_id = p_tenant and status = 'entwurf';

  return v_alt;
end;
$$;

revoke all on function public.philosophie_freigeben(uuid) from public, anon;
grant execute on function public.philosophie_freigeben(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: privater Bucket, nur PDF, höchstens 25 MB
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('philosophie', 'philosophie', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

-- Vereins-ID aus dem ersten Ordner des Pfads (ungültige Pfade ergeben null).
create function private.verein_aus_pfad(p_name text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;

grant execute on function private.verein_aus_pfad(text) to authenticated;

create policy "Philosophie-PDF hochladen"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'philosophie'
    and (select private.darf_verwalten(private.verein_aus_pfad(name)))
  );

create policy "Philosophie-PDF lesen"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'philosophie'
    and (
      (select private.darf_verwalten(private.verein_aus_pfad(name)))
      or exists (
        select 1 from public.philosophien p
        where p.datei = name and p.status = 'freigegeben' and (select private.darf_lesen(p.tenant_id))
      )
    )
  );

create policy "Philosophie-PDF löschen"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'philosophie'
    and (select private.darf_verwalten(private.verein_aus_pfad(name)))
  );
