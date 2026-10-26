-- Restaurants that stay: survey after the visit, no-show shield, campaigns to their customers,
-- birthdays and the monthly "what NetWish brought you" e-mail. Safe to run more than once.

-- ---------- 1. Survey after the visit ----------
alter table public.orders
  add column if not exists rating smallint check (rating between 1 and 5),
  add column if not exists rating_comment text,
  add column if not exists rated_at timestamptz,
  add column if not exists rating_notified_at timestamptz,
  add column if not exists second_reminded_at timestamptz,
  add column if not exists released_at timestamptz;

-- The link in the "¿Qué tal?" e-mail. p_rating null only reads it. A score of 4 or 5 gets the
-- Google reviews link; 1 to 3 stays private and the owner hears about it within the hour.
create or replace function public.rate_visit(p_token uuid, p_rating int default null, p_comment text default null)
returns jsonb
language plpgsql security definer set search_path = public, private
as $$
declare
  v public.orders;
  v_review text;
begin
  select * into v from public.orders where remind_token = p_token;
  if v.id is null or v.status not in ('Completado', 'Sentado') then return null; end if;
  select nullif(s.profile ->> 'google_resenas', '') into v_review from public.restaurant_settings s
  where lower(trim(s.business_name)) = lower(trim(v.business_name));

  if p_rating is not null then
    if p_rating not between 1 and 5 then raise exception 'Puntuación no válida'; end if;
    if v.rated_at is not null and v.rated_at < now() - interval '1 day' then raise exception 'Esta opinión ya está guardada'; end if;
    update public.orders set rating = p_rating, rating_comment = nullif(left(btrim(coalesce(p_comment, '')), 1000), ''),
      rated_at = now()
    where id = v.id returning * into v;
  end if;

  return jsonb_build_object('business_name', v.business_name, 'customer', v.customer, 'date', v.date,
    'rating', v.rating, 'comment', v.rating_comment,
    'review_url', case when v.rating >= 4 and v_review ~ '^https://' then v_review end);
end;
$$;
grant execute on function public.rate_visit(uuid, int, text) to anon, authenticated;

-- The panel's fallback: yesterday's customers, one survey each (the hourly job does the same).
create or replace function public.claim_review_requests(p_business text)
returns setof jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_yesterday text := to_char((now() at time zone 'Europe/Madrid') - interval '1 day', 'YYYY-MM-DD');
begin
  if not public.is_business_owner(p_business) then return; end if;
  if exists (select 1 from public.restaurant_settings s where lower(trim(s.business_name)) = lower(trim(p_business))
             and s.profile ->> 'encuesta' = 'false') then return; end if;
  return query
    with claimed as (
      update public.orders set review_sent_at = now()
      where lower(trim(business_name)) = lower(trim(p_business))
        and date = v_yesterday and status in ('Completado', 'Sentado')
        and review_sent_at is null and customer_email is not null
      returning *
    )
    select jsonb_build_object('business_name', c.business_name, 'customer', c.customer, 'customer_email', c.customer_email, 'token', c.remind_token)
    from claimed c;
end;
$$;
grant execute on function public.claim_review_requests(text) to authenticated;

-- ---------- 2. No-show shield ----------
-- Customers the restaurant tagged "No admitir", or who missed too many bookings
-- (profile.noshow_limite, 2 by default), are never confirmed automatically.
create or replace function public.is_risky_customer(p_business text, p_email text, p_phone text)
returns boolean
language sql stable security definer set search_path = public
as $$
  with keys as (
    select k from unnest(array[
      case when nullif(btrim(p_email), '') is not null then 'mail:' || lower(btrim(p_email)) end,
      case when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 6 then 'tel:' || regexp_replace(p_phone, '\D', '', 'g') end
    ]) k where k is not null
  )
  select exists (
    select 1 from public.customer_notes n
    where lower(trim(n.business_name)) = lower(trim(p_business))
      and n.customer_key in (select k from keys) and 'No admitir' = any(n.tags)
  ) or (
    select count(*) from public.orders o
    where lower(trim(o.business_name)) = lower(trim(p_business)) and o.status = 'No vino'
      and ((nullif(btrim(p_email), '') is not null and lower(o.customer_email) = lower(btrim(p_email)))
        or (length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 6
            and regexp_replace(coalesce(o.phone, ''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')))
  ) >= coalesce((select nullif(s.profile ->> 'noshow_limite', '')::int from public.restaurant_settings s
                 where lower(trim(s.business_name)) = lower(trim(p_business))), 2);
$$;
-- Only the booking trigger uses it.
revoke all on function public.is_risky_customer(text, text, text) from public, anon, authenticated;

create or replace function public.auto_confirm_booking()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s public.restaurant_settings;
  v_tables int[];
  v_start int;
  v_end int;
  v_guests int;
  v_clash boolean;
  v_cap int;
  v_load int;
begin
  if new.status <> 'Pendiente de Aprobación' or new.items not ilike 'Reserva % pax%'
     or new.time !~ '^\d{1,2}:\d{2} - \d{1,2}:\d{2}$' then
    return null;
  end if;
  select * into s from public.restaurant_settings where lower(trim(business_name)) = lower(trim(new.business_name));
  if s.business_name is null or coalesce(s.profile ->> 'auto_confirm', 'true') <> 'true' then return null; end if;
  v_guests := coalesce(substring(new.items from '(\d+)\s*pax')::int, 0);
  if v_guests > coalesce((s.profile ->> 'max_personas')::int, 20) then return null; end if;
  if v_guests >= coalesce((s.profile ->> 'grupo_desde')::int, 999) then return null; end if;
  if public.is_risky_customer(new.business_name, new.customer_email, new.phone) then return null; end if;

  v_tables := public.booking_tables(new.items);
  if cardinality(v_tables) = 0 then return null; end if;
  v_start := split_part(split_part(new.time, ' - ', 1), ':', 1)::int * 60 + split_part(split_part(new.time, ' - ', 1), ':', 2)::int;
  v_end := split_part(split_part(new.time, ' - ', 2), ':', 1)::int * 60 + split_part(split_part(new.time, ' - ', 2), ':', 2)::int;

  select exists (
    select 1 from public.orders o
    where o.id <> new.id
      and lower(trim(o.business_name)) = lower(trim(new.business_name))
      and o.date = new.date
      and o.items ilike 'Reserva%'
      and o.status not in ('Rechazado', 'Cancelado', 'Completado', 'No vino')
      and public.booking_tables(o.items) && v_tables
      and o.time ~ '^\d{1,2}:\d{2} - \d{1,2}:\d{2}$'
      and split_part(split_part(o.time, ' - ', 1), ':', 1)::int * 60 + split_part(split_part(o.time, ' - ', 1), ':', 2)::int < v_end
      and v_start < split_part(split_part(o.time, ' - ', 2), ':', 1)::int * 60 + split_part(split_part(o.time, ' - ', 2), ':', 2)::int
  ) into v_clash;
  if v_clash then return null; end if;

  v_cap := nullif((s.profile ->> 'aforo_franja')::int, 0);
  if v_cap is not null then
    select coalesce(sum(coalesce(substring(o.items from '(\d+)\s*pax')::int, 0)), 0) into v_load
    from public.orders o
    where lower(trim(o.business_name)) = lower(trim(new.business_name))
      and o.date = new.date and o.items ilike 'Reserva%'
      and o.status not in ('Rechazado', 'Cancelado', 'No vino')
      and o.time ~ '^\d{1,2}:\d{2}'
      and abs(split_part(split_part(o.time, ' - ', 1), ':', 1)::int * 60 + split_part(split_part(o.time, ' - ', 1), ':', 2)::int - v_start) < 30;
    if v_load > v_cap then return null; end if;
  end if;

  update public.orders set status = 'Mesa Confirmada', confirm_notified_at = now() where id = new.id;
  return null;
end;
$$;

-- ---------- 3. Campaigns, birthdays and unsubscribing ----------
alter table public.customer_notes add column if not exists birthday text check (birthday is null or birthday ~ '^\d{2}-\d{2}$');

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  segment text not null,
  subject text not null,
  body text not null default '',
  offer text,
  sent int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
drop policy if exists campaigns_owner_read on public.campaigns;
create policy campaigns_owner_read on public.campaigns for select using (public.is_business_owner(business_name));

create table if not exists public.marketing_optouts (
  business_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (business_name, email)
);
alter table public.marketing_optouts enable row level security;
drop policy if exists optouts_owner_read on public.marketing_optouts;
create policy optouts_owner_read on public.marketing_optouts for select using (public.is_business_owner(business_name));

create table if not exists private.birthday_sent (
  business_name text not null,
  customer_key text not null,
  year int not null,
  primary key (business_name, customer_key, year)
);

create table if not exists private.monthly_reports (
  business_name text not null,
  month text not null,
  sent_at timestamptz not null default now(),
  primary key (business_name, month)
);

-- Signature for the "darme de baja" link, so nobody can unsubscribe someone else.
create or replace function private.optout_sig(p_business text, p_email text)
returns text
language sql stable security definer set search_path = public, private
as $$
  select left(encode(extensions.hmac(lower(trim(p_business)) || '|' || lower(trim(p_email)), (select cron_key from private.cron_config where id = 1), 'sha256'), 'hex'), 32);
$$;

create or replace function public.marketing_unsubscribe(p_business text, p_email text, p_sig text)
returns boolean
language plpgsql security definer set search_path = public, private
as $$
begin
  if p_sig is null or p_sig <> private.optout_sig(p_business, p_email) then raise exception 'Enlace no válido'; end if;
  insert into public.marketing_optouts (business_name, email) values (trim(p_business), lower(trim(p_email))) on conflict do nothing;
  return true;
end;
$$;
grant execute on function public.marketing_unsubscribe(text, text, text) to anon, authenticated;

-- Who a campaign goes to. Only customers who came at least once, with an e-mail and not unsubscribed.
--   todos: everyone · echamos: last visit 60+ days ago and nothing booked · habituales: 3+ visits or VIP/Habitual
--   nuevos: a single visit
create or replace function private.campaign_audience(p_business text, p_segment text)
returns table (email text, name text)
language sql stable security definer set search_path = public, private
as $$
  with v as (
    select lower(trim(o.customer_email)) as email, o.customer, o.date, o.status, o.created_at
    from public.orders o
    where lower(trim(o.business_name)) = lower(trim(p_business))
      and o.items ~* '\d+\s*pax' and nullif(trim(o.customer_email), '') is not null
  ), people as (
    select email,
      (array_agg(customer order by created_at desc))[1] as name,
      count(*) filter (where status in ('Completado', 'Sentado')) as visits,
      max(date) filter (where status in ('Completado', 'Sentado')) as last_visit,
      bool_or(status in ('Pendiente de Aprobación', 'Mesa Confirmada') and date >= to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD')) as booked
    from v group by email
  )
  select p.email, p.name from people p
  where p.visits > 0
    and not exists (select 1 from public.customer_notes n where lower(trim(n.business_name)) = lower(trim(p_business))
      and n.customer_key = 'mail:' || p.email and 'No admitir' = any(n.tags))
    and not exists (select 1 from public.marketing_optouts x where lower(trim(x.business_name)) = lower(trim(p_business)) and x.email = p.email)
    and case p_segment
      when 'echamos' then not p.booked and p.last_visit < to_char((now() at time zone 'Europe/Madrid') - interval '60 days', 'YYYY-MM-DD')
      when 'habituales' then p.visits >= 3 or exists (
        select 1 from public.customer_notes n where lower(trim(n.business_name)) = lower(trim(p_business))
          and n.customer_key = 'mail:' || p.email and n.tags && array['VIP', 'Habitual'])
      when 'nuevos' then p.visits = 1
      else true
    end
  limit 2000;
$$;

-- Starts a campaign: checks the owner and the pace (one a day, eight a month) and hands back
-- the recipients with their unsubscribe signature. /api/campaign sends the e-mails.
create or replace function public.start_campaign(p_business text, p_segment text, p_subject text, p_body text, p_offer text default null)
returns jsonb
language plpgsql security definer set search_path = public, private
as $$
declare
  v_id uuid;
  v_list jsonb;
begin
  if not public.is_business_owner(p_business) then raise exception 'No autorizado'; end if;
  if p_segment not in ('todos', 'echamos', 'habituales', 'nuevos') then raise exception 'Grupo no válido'; end if;
  if length(btrim(coalesce(p_subject, ''))) < 3 or length(btrim(coalesce(p_body, ''))) < 10 then
    raise exception 'Escribe un asunto y un mensaje';
  end if;
  if exists (select 1 from public.campaigns where lower(trim(business_name)) = lower(trim(p_business)) and created_at > now() - interval '20 hours') then
    raise exception 'Ya enviaste una campaña hoy. Podrás mandar otra mañana.';
  end if;
  if (select count(*) from public.campaigns where lower(trim(business_name)) = lower(trim(p_business)) and created_at > now() - interval '30 days') >= 8 then
    raise exception 'Has llegado a 8 campañas este mes. Más correos harían que tus clientes se den de baja.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('email', a.email, 'name', a.name, 'sig', private.optout_sig(p_business, a.email))), '[]')
  into v_list from private.campaign_audience(p_business, p_segment) a;
  if jsonb_array_length(v_list) = 0 then raise exception 'No hay clientes con correo en este grupo'; end if;

  insert into public.campaigns (business_name, segment, subject, body, offer, sent)
  values (p_business, p_segment, left(btrim(p_subject), 120), left(btrim(p_body), 2000), nullif(left(btrim(coalesce(p_offer, '')), 200), ''), jsonb_array_length(v_list))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'recipients', v_list,
    'address', (select b.address from public.businesses b where lower(trim(b.name)) = lower(trim(p_business)) limit 1),
    'username', (select b.username from public.businesses b where lower(trim(b.name)) = lower(trim(p_business)) limit 1));
end;
$$;
revoke all on function public.start_campaign(text, text, text, text, text) from public, anon;
grant execute on function public.start_campaign(text, text, text, text, text) to authenticated;

-- ---------- 4. Monthly summary ----------
create or replace function private.month_numbers(p_business text, p_from text, p_to text)
returns jsonb
language sql stable security definer set search_path = public, private
as $$
  with b as (
    select o.*, coalesce(o.guests, substring(o.items from '(\d+)\s*pax')::int, 0) as pax,
      extract(hour from o.created_at at time zone 'Europe/Madrid')::int as made_hour
    from public.orders o
    where lower(trim(o.business_name)) = lower(trim(p_business)) and o.items ~* '\d+\s*pax'
      and o.date >= p_from and o.date < p_to
  ), came as (
    select * from b where status in ('Completado', 'Sentado')
  )
  select jsonb_build_object(
    'bookings', (select count(*) from b),
    'online', (select count(*) from came where coalesce(source, 'app') = 'app'),
    'online_diners', (select coalesce(sum(pax), 0) from came where coalesce(source, 'app') = 'app'),
    'diners', (select coalesce(sum(pax), 0) from came),
    'night', (select count(*) from b where coalesce(source, 'app') = 'app' and (made_hour >= 23 or made_hour < 9)),
    'no_shows', (select count(*) from b where status = 'No vino'),
    'confirmed', (select count(*) from b where customer_confirmed_at is not null),
    'cancelled_notice', (select count(*) from b where status = 'Cancelado'),
    'rating', (select round(avg(rating)::numeric, 1) from b where rating is not null),
    'ratings', (select count(*) from b where rating is not null),
    'new_customers', (select count(distinct coalesce(lower(c.customer_email), c.phone, c.customer)) from came c
      where not exists (select 1 from public.orders p where lower(trim(p.business_name)) = lower(trim(p_business))
        and p.date < p_from and p.status in ('Completado', 'Sentado')
        and (lower(p.customer_email) = lower(c.customer_email) or p.phone = c.phone)))
  );
$$;

-- ---------- 5. The hourly job, with the new e-mails ----------
create or replace function public.cron_jobs(p_key text)
returns jsonb
language plpgsql security definer set search_path = public, private
as $$
declare
  v_now timestamp := now() at time zone 'Europe/Madrid';
  v_hour int := extract(hour from now() at time zone 'Europe/Madrid');
  v_today text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD');
  v_tomorrow text := to_char((now() at time zone 'Europe/Madrid') + interval '1 day', 'YYYY-MM-DD');
  v_yesterday text := to_char((now() at time zone 'Europe/Madrid') - interval '1 day', 'YYYY-MM-DD');
  v_minutes int := extract(hour from now() at time zone 'Europe/Madrid')::int * 60 + extract(minute from now() at time zone 'Europe/Madrid')::int;
  v_expired int;
  v_reminders jsonb := '[]';
  v_second jsonb := '[]';
  v_released jsonb := '[]';
  v_reviews jsonb := '[]';
  v_bad jsonb := '[]';
  v_waitlist jsonb := '[]';
  v_birthdays jsonb := '[]';
  v_monthly jsonb := '[]';
  v_month_from text;
  v_month_to text;
begin
  if p_key is null or not exists (select 1 from private.cron_config where cron_key = p_key) then
    raise exception 'No autorizado';
  end if;

  -- Pending bookings nobody answered (profile.caduca_horas, 12 h by default) or whose day is gone.
  update public.orders o set status = 'Rechazado'
  where o.status = 'Pendiente de Aprobación' and o.items ilike 'Reserva%'
    and (o.date < v_today or o.created_at < now() - make_interval(hours => coalesce((
      select nullif(s.profile ->> 'caduca_horas', '')::int from public.restaurant_settings s
      where lower(trim(s.business_name)) = lower(trim(o.business_name))), 12)));
  get diagnostics v_expired = row_count;

  -- Day-before reminders, sent at a decent hour.
  if v_hour between 10 and 21 then
    with claimed as (
      update public.orders set reminded_at = now()
      where date = v_tomorrow and status = 'Mesa Confirmada'
        and reminded_at is null and customer_email is not null
      returning *
    )
    select coalesce(jsonb_agg(jsonb_build_object('business_name', c.business_name, 'customer', c.customer, 'customer_email', c.customer_email,
      'items', split_part(c.items, ' · Nota:', 1), 'date', c.date, 'time', c.time, 'token', c.remind_token,
      'address', (select b.address from public.businesses b where lower(trim(b.name)) = lower(trim(c.business_name)) limit 1))), '[]')
    into v_reminders from claimed c;
  end if;

  -- Same day: whoever has not answered the reminder gets one more nudge, at least 3 hours ahead.
  if v_hour between 9 and 20 then
    with claimed as (
      update public.orders set second_reminded_at = now()
      where date = v_today and status = 'Mesa Confirmada' and reminded_at is not null
        and customer_confirmed_at is null and second_reminded_at is null and customer_email is not null
        and time ~ '^\d{1,2}:\d{2}'
        and split_part(split_part(time, ' - ', 1), ':', 1)::int * 60 + split_part(split_part(time, ' - ', 1), ':', 2)::int - v_minutes >= 180
      returning *
    )
    select coalesce(jsonb_agg(jsonb_build_object('business_name', c.business_name, 'customer', c.customer, 'customer_email', c.customer_email,
      'items', split_part(c.items, ' · Nota:', 1), 'date', c.date, 'time', c.time, 'token', c.remind_token, 'second', true,
      'release', coalesce((select s.profile ->> 'liberar_sin_confirmar' from public.restaurant_settings s where lower(trim(s.business_name)) = lower(trim(c.business_name))), 'false') = 'true',
      'address', (select b.address from public.businesses b where lower(trim(b.name)) = lower(trim(c.business_name)) limit 1))), '[]')
    into v_second from claimed c;
  end if;

  -- Restaurants that chose it: still no answer 90 minutes before → the table is freed
  -- (the waiting list hears about it through the usual trigger).
  with claimed as (
    update public.orders o set status = 'Cancelado', released_at = now()
    from public.restaurant_settings s
    where lower(trim(s.business_name)) = lower(trim(o.business_name))
      and s.profile ->> 'liberar_sin_confirmar' = 'true'
      and o.date = v_today and o.status = 'Mesa Confirmada'
      and o.second_reminded_at is not null and o.second_reminded_at < now() - interval '1 hour'
      and o.customer_confirmed_at is null and o.released_at is null
      and o.time ~ '^\d{1,2}:\d{2}'
      and split_part(split_part(o.time, ' - ', 1), ':', 1)::int * 60 + split_part(split_part(o.time, ' - ', 1), ':', 2)::int - v_minutes between 0 and 90
    returning o.business_name, o.customer, o.customer_email, o.items, o.date, o.time
  )
  select coalesce(jsonb_agg(jsonb_build_object('business_name', c.business_name, 'customer', c.customer, 'customer_email', c.customer_email,
    'items', split_part(c.items, ' · Nota:', 1), 'date', c.date, 'time', c.time)), '[]') into v_released from claimed c;

  -- Yesterday's customers who came get the one-minute survey (unless the restaurant turned it off).
  if v_hour between 11 and 21 then
    with claimed as (
      update public.orders o set review_sent_at = now()
      from public.restaurant_settings s
      where lower(trim(s.business_name)) = lower(trim(o.business_name))
        and coalesce(s.profile ->> 'encuesta', 'true') <> 'false'
        and o.date = v_yesterday and o.status in ('Completado', 'Sentado')
        and o.review_sent_at is null and o.customer_email is not null
      returning o.business_name, o.customer, o.customer_email, o.remind_token as token
    )
    select coalesce(jsonb_agg(to_jsonb(c)), '[]') into v_reviews from claimed c;
  end if;

  -- Low scores go privately to the owner.
  with claimed as (
    update public.orders o set rating_notified_at = now()
    where o.rating between 1 and 3 and o.rating_notified_at is null
      and o.rated_at between now() - interval '7 days' and now() - interval '15 minutes'
    returning o.business_name, o.customer, o.customer_email, o.phone, o.date, o.rating, o.rating_comment
  )
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('business_email',
    (select b.notification_email from public.businesses b where lower(trim(b.name)) = lower(trim(c.business_name)) limit 1))), '[]')
  into v_bad from claimed c;

  -- People on the waiting list whose day just got a free table.
  with claimed as (
    update public.waitlist set notified_at = now()
    where freed_at is not null and (notified_at is null or notified_at < freed_at)
      and status = 'esperando' and email is not null and date >= v_today
    returning business_name, date, guests, name, email, freed_time
  )
  select coalesce(jsonb_agg(to_jsonb(c)), '[]') into v_waitlist from claimed c;

  -- Birthdays a week ahead, for restaurants that switched it on (profile.campana_cumple).
  if v_hour between 10 and 20 then
    with due as (
      select n.business_name, n.customer_key, substring(n.customer_key from 6) as email,
        s.profile ->> 'cumple_oferta' as offer
      from public.customer_notes n
      join public.restaurant_settings s on lower(trim(s.business_name)) = lower(trim(n.business_name))
      where s.profile ->> 'campana_cumple' = 'true'
        and n.customer_key like 'mail:%' and n.birthday = to_char(v_now + interval '7 days', 'MM-DD')
        and not ('No admitir' = any(n.tags))
        and not exists (select 1 from public.marketing_optouts x where lower(trim(x.business_name)) = lower(trim(n.business_name)) and x.email = substring(n.customer_key from 6))
    ), claimed as (
      insert into private.birthday_sent (business_name, customer_key, year)
      select business_name, customer_key, extract(year from v_now)::int from due
      on conflict do nothing
      returning business_name, customer_key
    )
    select coalesce(jsonb_agg(jsonb_build_object('business_name', d.business_name, 'email', d.email, 'offer', d.offer,
      'name', (select o.customer from public.orders o where lower(o.customer_email) = d.email and lower(trim(o.business_name)) = lower(trim(d.business_name)) order by o.created_at desc limit 1),
      'username', (select b.username from public.businesses b where lower(trim(b.name)) = lower(trim(d.business_name)) limit 1),
      'sig', private.optout_sig(d.business_name, d.email))), '[]')
    into v_birthdays
    from due d join claimed c on c.business_name = d.business_name and c.customer_key = d.customer_key;
  end if;

  -- The 1st of each month from 9:00: last month's summary to every approved restaurant with an e-mail.
  if extract(day from v_now) = 1 and v_hour between 9 and 20 then
    v_month_to := to_char(date_trunc('month', v_now), 'YYYY-MM-DD');
    v_month_from := to_char(date_trunc('month', v_now) - interval '1 month', 'YYYY-MM-DD');
    with claimed as (
      insert into private.monthly_reports (business_name, month)
      select b.name, left(v_month_from, 7)
      from public.businesses b
      join public.restaurant_settings s on lower(trim(s.business_name)) = lower(trim(b.name))
      where b.status = 'approved' and nullif(trim(b.notification_email), '') is not null
        and coalesce(s.profile ->> 'resumen_mensual', 'true') <> 'false'
        -- Restaurants with table bookings that month (salons have their own settings row too).
        and exists (select 1 from public.orders o where lower(trim(o.business_name)) = lower(trim(b.name))
          and o.items ~* '\d+\s*pax' and o.date >= v_month_from and o.date < v_month_to)
      on conflict do nothing
      returning business_name
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'business_name', b.name, 'email', b.notification_email, 'month', left(v_month_from, 7),
      'precio', s.profile ->> 'precio', 'ticket', s.profile ->> 'ticket_medio',
      'now', private.month_numbers(b.name, v_month_from, v_month_to),
      'before', private.month_numbers(b.name, to_char(date_trunc('month', v_now) - interval '2 months', 'YYYY-MM-DD'), v_month_from),
      'waitlist', (select count(*) from public.waitlist w where lower(trim(w.business_name)) = lower(trim(b.name))
        and w.notified_at >= date_trunc('month', v_now) - interval '1 month' and w.notified_at < date_trunc('month', v_now)))), '[]')
    into v_monthly
    from claimed c
    join public.businesses b on b.name = c.business_name
    join public.restaurant_settings s on lower(trim(s.business_name)) = lower(trim(b.name));
  end if;

  return jsonb_build_object('expired', v_expired, 'reminders', v_reminders, 'second', v_second, 'released', v_released,
    'reviews', v_reviews, 'bad', v_bad, 'waitlist', v_waitlist, 'birthdays', v_birthdays, 'monthly', v_monthly, 'at', v_now);
end;
$$;
revoke all on function public.cron_jobs(text) from public;
grant execute on function public.cron_jobs(text) to anon, authenticated;
