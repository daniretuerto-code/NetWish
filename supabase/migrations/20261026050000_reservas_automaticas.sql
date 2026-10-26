-- Bookings round 5: the automatic work runs every hour on its own (no need to open the panel),
-- the waiting list gets an e-mail when a table frees up, and customers can change a booking.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto;

-- ---------- Hourly job ----------
-- Supabase calls netwish.es/api/cron with a key that only lives here; the endpoint passes it
-- back to cron_jobs(), so nothing else can trigger the e-mails.
create table if not exists private.cron_config (
  id int primary key default 1 check (id = 1),
  cron_key text not null,
  site_url text not null default 'https://netwish.es'
);
insert into private.cron_config (cron_key) values (encode(gen_random_bytes(24), 'hex')) on conflict (id) do nothing;

create or replace function private.ping_cron()
returns void
language plpgsql security definer set search_path = public, private
as $$
declare
  c private.cron_config;
begin
  select * into c from private.cron_config where id = 1;
  perform net.http_post(
    url := c.site_url || '/api/cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', c.cron_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'netwish-hourly') then
    perform cron.unschedule('netwish-hourly');
  end if;
  perform cron.schedule('netwish-hourly', '5 * * * *', 'select private.ping_cron()');
end;
$$;

-- ---------- Waiting list ----------
alter table public.waitlist
  add column if not exists freed_at timestamptz,
  add column if not exists freed_time text,
  add column if not exists notified_at timestamptz;

-- A cancelled or turned-down booking frees its table: everyone waiting that day with an
-- e-mail is told at once (the endpoint runs straight away, not on the next hour).
create or replace function public.free_slot_for_waitlist()
returns trigger
language plpgsql security definer set search_path = public, private
as $$
begin
  if new.status not in ('Cancelado', 'Rechazado') or old.status not in ('Pendiente de Aprobación', 'Mesa Confirmada')
     or new.items not ilike 'Reserva % pax%'
     or new.date < to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD') then
    return null;
  end if;
  update public.waitlist
  set freed_at = now(), freed_time = split_part(new.time, ' - ', 1)
  where lower(trim(business_name)) = lower(trim(new.business_name))
    and date = new.date and status = 'esperando' and email is not null;
  if found then
    perform private.ping_cron();
  end if;
  return null;
end;
$$;

drop trigger if exists orders_free_slot on public.orders;
create trigger orders_free_slot after update of status on public.orders
  for each row when (new.status is distinct from old.status)
  execute function public.free_slot_for_waitlist();

-- ---------- Everything the hourly job hands out ----------
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
  v_expired int;
  v_reminders jsonb := '[]';
  v_reviews jsonb := '[]';
  v_waitlist jsonb := '[]';
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

  -- Yesterday's customers who came, when the restaurant gave its Google reviews link.
  if v_hour between 11 and 21 then
    with claimed as (
      update public.orders o set review_sent_at = now()
      from public.restaurant_settings s
      where lower(trim(s.business_name)) = lower(trim(o.business_name))
        and coalesce(s.profile ->> 'google_resenas', '') ~ '^https://'
        and o.date = v_yesterday and o.status in ('Completado', 'Sentado')
        and o.review_sent_at is null and o.customer_email is not null
      returning o.business_name, o.customer, o.customer_email, s.profile ->> 'google_resenas' as review_url
    )
    select coalesce(jsonb_agg(to_jsonb(c)), '[]') into v_reviews from claimed c;
  end if;

  -- People on the waiting list whose day just got a free table.
  with claimed as (
    update public.waitlist set notified_at = now()
    where freed_at is not null and (notified_at is null or notified_at < freed_at)
      and status = 'esperando' and email is not null and date >= v_today
    returning business_name, date, guests, name, email, freed_time
  )
  select coalesce(jsonb_agg(to_jsonb(c)), '[]') into v_waitlist from claimed c;

  return jsonb_build_object('expired', v_expired, 'reminders', v_reminders, 'reviews', v_reviews, 'waitlist', v_waitlist, 'at', v_now);
end;
$$;
revoke all on function public.cron_jobs(text) from public;
grant execute on function public.cron_jobs(text) to anon, authenticated;

-- ---------- Change a booking from the e-mail link ----------
alter table public.orders
  add column if not exists changed_at timestamptz,
  add column if not exists change_notified_at timestamptz;

-- Same token as the reminder link. Only restaurant tables; the note stays. The booking goes back
-- to pending and the auto-confirm trigger confirms it again if the new table is free.
create or replace function public.change_booking(p_token uuid, p_items text, p_date text, p_time text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.orders;
  v_today text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD');
  v_note text;
begin
  select * into v from public.orders where remind_token = p_token;
  if v.id is null or v.status not in ('Pendiente de Aprobación', 'Mesa Confirmada') or v.date < v_today then
    raise exception 'Esta reserva ya no se puede cambiar';
  end if;
  if v.items not ilike 'Reserva % pax%' or p_items not ilike 'Reserva % pax%' or p_items ilike '%· Nota:%'
     or p_date !~ '^\d{4}-\d{2}-\d{2}$' or p_time !~ '^\d{1,2}:\d{2} - \d{1,2}:\d{2}$' then
    raise exception 'Cambio no válido';
  end if;
  if p_date < v_today then raise exception 'Elige un día a partir de hoy'; end if;
  if v.changed_at is not null and v.changed_at > now() - interval '1 minute' then
    raise exception 'Espera un momento antes de volver a cambiarla';
  end if;

  v_note := nullif(btrim(split_part(v.items, ' · Nota:', 2)), '');
  update public.orders set
    items = left(p_items, 300) || coalesce(' · Nota: ' || v_note, ''),
    date = p_date, time = p_time,
    status = 'Pendiente de Aprobación',
    reminded_at = null, customer_confirmed_at = null, confirm_notified_at = null,
    changed_at = now(), change_notified_at = null
  where id = v.id;

  select * into v from public.orders where id = v.id;
  return jsonb_build_object('id', v.id, 'status', v.status);
end;
$$;
grant execute on function public.change_booking(uuid, text, text, text) to anon, authenticated;

drop trigger if exists orders_auto_confirm_change on public.orders;
create trigger orders_auto_confirm_change after update of changed_at on public.orders
  for each row when (new.changed_at is distinct from old.changed_at)
  execute function public.auto_confirm_booking();

-- The link page also shows the address (for the calendar) and whether the booking can be changed.
create or replace function public.respond_booking(p_token uuid, p_action text default 'view')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.orders;
  v_today text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD');
begin
  select * into v from public.orders where remind_token = p_token;
  if v.id is null then return null; end if;
  if v.date >= v_today and v.status in ('Pendiente de Aprobación', 'Mesa Confirmada') then
    if p_action = 'confirm' then
      update public.orders set customer_confirmed_at = now() where id = v.id returning * into v;
    elsif p_action = 'cancel' then
      update public.orders set status = 'Cancelado' where id = v.id returning * into v;
    end if;
  end if;
  return jsonb_build_object(
    'business_name', v.business_name, 'customer', v.customer, 'items', split_part(v.items, ' · Nota:', 1),
    'date', v.date, 'time', v.time, 'status', v.status, 'confirmed', v.customer_confirmed_at is not null,
    'address', (select b.address from public.businesses b where lower(trim(b.name)) = lower(trim(v.business_name)) limit 1)
  );
end;
$$;

-- One-shot e-mails, now also for a changed booking.
create or replace function public.claim_order_notification(p_order uuid, p_kind text default 'created')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_biz_email text;
  v_address text;
begin
  if p_kind = 'created' then
    update public.orders set notified_at = now()
    where id = p_order and notified_at is null and created_at > now() - interval '15 minutes'
    returning * into v_order;
  elsif p_kind = 'confirmed' then
    update public.orders set confirm_notified_at = now()
    where id = p_order and confirm_notified_at is null and status = 'Mesa Confirmada'
      and public.is_business_owner(business_name)
    returning * into v_order;
  elsif p_kind = 'changed' then
    update public.orders set change_notified_at = now()
    where id = p_order and change_notified_at is null and changed_at > now() - interval '15 minutes'
    returning * into v_order;
  end if;

  if v_order.id is null then return null; end if;

  select notification_email, address into v_biz_email, v_address from public.businesses
  where lower(trim(name)) = lower(trim(v_order.business_name)) limit 1;

  return jsonb_build_object(
    'id', v_order.id,
    'business_name', v_order.business_name,
    'business_email', v_biz_email,
    'address', v_address,
    'customer', v_order.customer,
    'customer_email', v_order.customer_email,
    'phone', v_order.phone,
    'items', v_order.items,
    'total', v_order.total,
    'date', v_order.date,
    'time', v_order.time,
    'status', v_order.status,
    'token', v_order.remind_token
  );
end;
$$;
