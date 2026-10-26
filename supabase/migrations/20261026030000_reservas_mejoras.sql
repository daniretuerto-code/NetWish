-- Bookings round 3: guests without an account, waiting list, capacity per half hour,
-- large groups, pending bookings that expire, and the review request after the visit.

alter table public.orders add column if not exists review_sent_at timestamptz;

-- Book without an account: name and e-mail are enough. Stays pending unless the
-- auto-confirm trigger confirms it.
create or replace function public.create_guest_booking(
  p_business text, p_name text, p_email text, p_phone text, p_items text, p_date text, p_time text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_status text;
  v_token uuid;
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Escribe tu nombre'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido'; end if;
  if p_items not ilike 'Reserva %' or p_date !~ '^\d{4}-\d{2}-\d{2}$' or p_time !~ '^\d{1,2}:\d{2} - \d{1,2}:\d{2}$' then
    raise exception 'Reserva no válida';
  end if;
  if p_date < to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD') then raise exception 'Elige un día a partir de hoy'; end if;
  if not exists (select 1 from public.businesses where lower(trim(name)) = lower(trim(p_business)) and status = 'approved') then
    raise exception 'Este negocio no acepta reservas';
  end if;
  -- A few bookings per e-mail and day is plenty; this keeps spam out.
  if (select count(*) from public.orders where lower(customer_email) = v_email and created_at > now() - interval '1 day') >= 4 then
    raise exception 'Has hecho demasiadas reservas hoy. Llama al restaurante.';
  end if;

  insert into public.orders (id, business_name, customer, customer_email, phone, items, total, date, time, status, source)
  values (v_id, p_business, left(btrim(p_name), 60), v_email, left(nullif(btrim(p_phone), ''), 20), left(p_items, 400), 0,
          p_date, p_time, 'Pendiente de Aprobación', 'app');

  select status, remind_token into v_status, v_token from public.orders where id = v_id;
  return jsonb_build_object('id', v_id, 'status', v_status, 'token', v_token);
end;
$$;
grant execute on function public.create_guest_booking(text, text, text, text, text, text, text) to anon, authenticated;

-- The confirmation e-mail carries the link to manage the booking.
create or replace function public.claim_order_notification(p_order uuid, p_kind text default 'created')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_biz_email text;
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
  end if;

  if v_order.id is null then return null; end if;

  select notification_email into v_biz_email from public.businesses
  where lower(trim(name)) = lower(trim(v_order.business_name));

  return jsonb_build_object(
    'id', v_order.id,
    'business_name', v_order.business_name,
    'business_email', v_biz_email,
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

-- Waiting list for full days.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  date text not null,
  shift text not null default 'cena',
  guests int not null default 2,
  name text not null,
  phone text,
  email text,
  status text not null default 'esperando',
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'waitlist' and policyname = 'waitlist_insert') then
    create policy waitlist_insert on public.waitlist for insert
      with check (status = 'esperando' and length(name) between 2 and 60 and guests between 1 and 60
                  and (phone is not null or email is not null));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'waitlist' and policyname = 'waitlist_owner') then
    create policy waitlist_owner on public.waitlist for select using (public.is_business_owner(business_name));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'waitlist' and policyname = 'waitlist_owner_update') then
    create policy waitlist_owner_update on public.waitlist for update
      using (public.is_business_owner(business_name)) with check (public.is_business_owner(business_name));
  end if;
end;
$$;
grant insert on public.waitlist to anon, authenticated;

-- Pending bookings nobody answered expire (profile.caduca_horas, 12 h by default) or once their day is gone.
create or replace function public.expire_pending(p_business text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_hours int;
  v_n int;
begin
  if not public.is_business_owner(p_business) then return 0; end if;
  select coalesce((profile ->> 'caduca_horas')::int, 12) into v_hours
  from public.restaurant_settings where lower(trim(business_name)) = lower(trim(p_business));
  update public.orders set status = 'Rechazado'
  where lower(trim(business_name)) = lower(trim(p_business))
    and status = 'Pendiente de Aprobación' and items ilike 'Reserva%'
    and (created_at < now() - make_interval(hours => coalesce(v_hours, 12))
         or date < to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD'));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.expire_pending(text) to authenticated;

-- Yesterday's customers who came: one review request each.
create or replace function public.claim_review_requests(p_business text)
returns setof jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_yesterday text := to_char((now() at time zone 'Europe/Madrid') - interval '1 day', 'YYYY-MM-DD');
begin
  if not public.is_business_owner(p_business) then return; end if;
  return query
    with claimed as (
      update public.orders set review_sent_at = now()
      where lower(trim(business_name)) = lower(trim(p_business))
        and date = v_yesterday and status in ('Completado', 'Sentado')
        and review_sent_at is null and customer_email is not null
      returning *
    )
    select jsonb_build_object('business_name', c.business_name, 'customer', c.customer, 'customer_email', c.customer_email)
    from claimed c;
end;
$$;
grant execute on function public.claim_review_requests(text) to authenticated;

-- Instant confirmation, now also respecting the capacity per half hour and large groups.
create or replace function public.auto_confirm_booking()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s public.restaurant_settings;
  v_table int;
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

  v_table := substring(new.items from 'Mesa (\d+)')::int;
  if v_table is null then return null; end if;
  v_start := split_part(split_part(new.time, ' - ', 1), ':', 1)::int * 60 + split_part(split_part(new.time, ' - ', 1), ':', 2)::int;
  v_end := split_part(split_part(new.time, ' - ', 2), ':', 1)::int * 60 + split_part(split_part(new.time, ' - ', 2), ':', 2)::int;

  select exists (
    select 1 from public.orders o
    where o.id <> new.id
      and lower(trim(o.business_name)) = lower(trim(new.business_name))
      and o.date = new.date
      and o.items ilike 'Reserva%'
      and o.status not in ('Rechazado', 'Cancelado', 'Completado', 'No vino')
      and substring(o.items from 'Mesa (\d+)')::int = v_table
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
