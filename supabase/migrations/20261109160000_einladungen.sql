-- Phase 1: Gratis-Tarif, reservierte Subdomains, Einladungen annehmen, Mitgliederliste.

-- ---------------------------------------------------------------------------
-- Tarif «gratis»: Vereine, die nie abgerechnet werden (z. B. Pilotverein).
-- Stripe-Webhooks dürfen diese Vereine nie verändern.
-- ---------------------------------------------------------------------------

alter table public.tenants drop constraint tenants_plan_check;
alter table public.tenants add constraint tenants_plan_check
  check (plan in ('monat', 'jahr', 'gratis'));

-- Ein Gratis-Verein hat kein Stripe-Konto und ist immer aktiv.
alter table public.tenants add constraint tenants_gratis_ohne_stripe
  check (plan is distinct from 'gratis'
         or (stripe_customer_id is null and abo_status = 'active'));

-- ---------------------------------------------------------------------------
-- Reservierte Subdomains (gleiche Liste wie src/lib/tenant.ts)
-- ---------------------------------------------------------------------------

alter table public.tenants add constraint tenants_slug_nicht_reserviert
  check (slug not in (
    'www', 'app', 'admin', 'api', 'mcp', 'auth', 'login', 'docs', 'hilfe', 'support',
    'status', 'mail', 'staging', 'preview', 'preise', 'registrieren', 'impressum',
    'datenschutz', 'agb', 'konto', 'einladung', 'verein', 'vereine', 'coachlab'
  ));

-- ---------------------------------------------------------------------------
-- Einladungen
--   persönlich (email gesetzt):   einmalig, Mitglied ist sofort aktiv
--   Vereinscode (email leer):     mehrfach bis gueltig_bis, Mitglied wartet auf
--                                 Freischaltung, nur Rolle trainer
-- ---------------------------------------------------------------------------

alter table public.invitations add constraint invitations_vereinscode_nur_trainer
  check (email is not null or rolle = 'trainer');

-- Einladung prüfen, bevor man sich registriert (auch ohne Login).
-- Gibt keine E-Mail-Adressen heraus.
create function public.einladung_pruefen(p_code text)
returns table (verein_name text, verein_slug text, rolle text, persoenlich boolean)
language sql stable security definer set search_path = ''
as $$
  select t.name, t.slug, i.rolle, i.email is not null
  from public.invitations i
  join public.tenants t on t.id = i.tenant_id
  where i.code = p_code
    and i.gueltig_bis > now()
    and (i.email is null or i.angenommen_am is null);
$$;

revoke all on function public.einladung_pruefen(text) from public;
grant execute on function public.einladung_pruefen(text) to anon, authenticated;

-- Einladung mit dem angemeldeten Konto annehmen.
-- Bestehende Mitgliedschaften werden nicht verändert (keine Rechte-Ausweitung).
create function public.einladung_annehmen(p_code text)
returns table (verein_slug text, status text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_inv   public.invitations;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  select * into v_inv
  from public.invitations i
  where i.code = p_code
    and i.gueltig_bis > now()
    and (i.email is null or i.angenommen_am is null)
  for update;

  if not found then
    raise exception 'Einladung ungültig oder abgelaufen' using errcode = 'P0002';
  end if;

  if v_inv.email is not null and lower(v_inv.email) <> lower(coalesce(v_email, '')) then
    raise exception 'Diese Einladung gilt für eine andere E-Mail-Adresse'
      using errcode = '42501';
  end if;

  insert into public.memberships (user_id, tenant_id, rolle, status)
  values (v_uid, v_inv.tenant_id, v_inv.rolle,
          case when v_inv.email is not null then 'aktiv' else 'wartet' end)
  on conflict (user_id, tenant_id) do nothing;

  if v_inv.email is not null then
    update public.invitations set angenommen_am = now() where id = v_inv.id;
  end if;

  return query
    select t.slug, m.status
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.user_id = v_uid and m.tenant_id = v_inv.tenant_id;
end;
$$;

revoke all on function public.einladung_annehmen(text) from public, anon;
grant execute on function public.einladung_annehmen(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Mitgliederliste mit Name und E-Mail, nur für Owner und Admins des Vereins.
-- ---------------------------------------------------------------------------

create function public.mitglieder_liste(p_tenant uuid)
returns table (user_id uuid, email text, name text, rolle text, status text,
               erstellt_am timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, u.email::text, p.name, m.rolle, m.status, m.erstellt_am
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  where m.tenant_id = p_tenant
    and private.darf_verwalten(p_tenant)
  order by case m.status when 'wartet' then 0 when 'aktiv' then 1 else 2 end,
           case m.rolle when 'owner' then 0 when 'admin' then 1 else 2 end,
           p.name nulls last;
$$;

revoke all on function public.mitglieder_liste(uuid) from public, anon;
grant execute on function public.mitglieder_liste(uuid) to authenticated;
