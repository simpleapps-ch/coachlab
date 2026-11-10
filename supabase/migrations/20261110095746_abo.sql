-- Phase 4: Abo über Stripe, Registrierung neuer Vereine.
--
-- Abo-Felder schreibt nur der Server mit dem Service-Role-Key (Stripe-Webhook, Checkout).
-- Vereine im Tarif "gratis" werden nie abgerechnet und vom Webhook übersprungen.

alter table public.tenants
  add column stripe_subscription_id text unique,
  add column abo_periode_ende      timestamptz,
  add column abo_gekuendigt        boolean not null default false;

comment on column public.tenants.abo_periode_ende is 'Ende der bezahlten Periode (Stripe current_period_end).';
comment on column public.tenants.abo_gekuendigt is 'Gekündigt auf Periodenende (Stripe cancel_at_period_end).';

alter table public.tenants drop constraint tenants_gratis_ohne_stripe;
alter table public.tenants add constraint tenants_gratis_ohne_stripe
  check (plan is distinct from 'gratis'
         or (stripe_customer_id is null and stripe_subscription_id is null and abo_status = 'active'));

-- ---------------------------------------------------------------------------
-- Verarbeitete Stripe-Ereignisse (Idempotenz des Webhooks). Systemtabelle ohne
-- Vereinsdaten: RLS an, keine Policy, also nur für den Service-Role-Key.
-- ---------------------------------------------------------------------------

create table public.stripe_events (
  id            text primary key check (id like 'evt_%'),
  typ           text not null,
  tenant_id     uuid references public.tenants (id) on delete set null,
  verarbeitet_am timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Verein registrieren: legt den Verein ohne Abo an (abo_status "incomplete") und
-- macht die angemeldete Person zur Technischen Leitung (owner). Das Abo startet erst
-- mit dem Stripe-Checkout (Webhook setzt "trialing").
-- Schutz vor Missbrauch: pro Person höchstens ein Verein ohne abgeschlossenes Abo;
-- ein erneuter Aufruf gibt diesen Verein zurück (z. B. nach abgebrochenem Checkout).
-- ---------------------------------------------------------------------------

create function public.verein_registrieren(p_name text, p_slug text)
returns table (id uuid, slug text, neu boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_offen uuid;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;

  select t.id into v_offen
  from public.tenants t
  join public.memberships m on m.tenant_id = t.id
  where m.user_id = v_user and m.rolle = 'owner'
    and t.abo_status = 'incomplete' and t.stripe_subscription_id is null
  limit 1;

  if v_offen is not null then
    -- Name und Slug dürfen sich bis zum Abschluss noch ändern.
    update public.tenants t set name = p_name, slug = lower(p_slug)
    where t.id = v_offen;
    return query select t.id, t.slug, false from public.tenants t where t.id = v_offen;
    return;
  end if;

  insert into public.tenants (name, slug, abo_status)
  values (p_name, lower(p_slug), 'incomplete')
  returning tenants.id into v_id;

  insert into public.memberships (user_id, tenant_id, rolle, status)
  values (v_user, v_id, 'owner', 'aktiv');

  return query select t.id, t.slug, true from public.tenants t where t.id = v_id;
end;
$$;

revoke all on function public.verein_registrieren(text, text) from public, anon;
grant execute on function public.verein_registrieren(text, text) to authenticated;

-- Ist ein Slug noch frei? (Registrierungsformular, auch ohne Login.)
create function public.slug_frei(p_slug text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from public.tenants t where t.slug = lower(p_slug));
$$;

revoke all on function public.slug_frei(text) from public;
grant execute on function public.slug_frei(text) to anon, authenticated;
