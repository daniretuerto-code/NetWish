-- Restaurant agenda: phone bookings, real statuses, reminders, customer notes.

alter table public.orders
  add column if not exists phone text,
  add column if not exists source text not null default 'app',
  add column if not exists remind_token uuid not null default gen_random_uuid(),
  add column if not exists reminded_at timestamptz,
  add column if not exists customer_confirmed_at timestamptz;

create unique index if not exists orders_remind_token_key on public.orders (remind_token);

-- The owner writes down bookings that come by phone or walk in, in any status.
drop policy if exists orders_owner_insert on public.orders;
create policy orders_owner_insert on public.orders for insert
  with check (public.is_business_owner(business_name) and items ilike 'Reserva%' and total >= 0);

-- Cancelled, rejected or finished bookings free the table.
create or replace function public.reserved_slots(p_business text, p_date text)
returns table(slot_items text, slot_time text)
language sql stable security definer set search_path = public
as $$
  select split_part(o.items, ' · Nota:', 1), o.time from public.orders o
  where lower(trim(o.business_name)) = lower(trim(p_business))
    and o.date = p_date
    and o.items ilike 'Reserva%'
    and o.status not in ('Rechazado', 'Cancelado', 'Completado', 'No vino');
$$;

-- A customer cancels their own upcoming booking.
create or replace function public.cancel_my_booking(p_order uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.orders set status = 'Cancelado'
  where id = p_order
    and status in ('Pendiente de Aprobación', 'Mesa Confirmada')
    and date >= to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD')
    and ((auth.uid() is not null and customer_id = auth.uid())
      or (auth.jwt() ->> 'email' is not null and lower(customer_email) = lower(auth.jwt() ->> 'email')));
  if not found then raise exception 'No se puede cancelar esta reserva'; end if;
end;
$$;
grant execute on function public.cancel_my_booking(uuid) to authenticated;

-- The link in the reminder e-mail: see, confirm or cancel without signing in.
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
    'date', v.date, 'time', v.time, 'status', v.status, 'confirmed', v.customer_confirmed_at is not null
  );
end;
$$;
grant execute on function public.respond_booking(uuid, text) to anon, authenticated;

-- Tomorrow's confirmed bookings that still need a reminder. Called with the owner's session
-- whenever the panel is open; each booking is handed out only once.
create or replace function public.claim_reminders(p_business text)
returns setof jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_tomorrow text := to_char((now() at time zone 'Europe/Madrid') + interval '1 day', 'YYYY-MM-DD');
begin
  if not public.is_business_owner(p_business) then return; end if;
  return query
    with claimed as (
      update public.orders set reminded_at = now()
      where lower(trim(business_name)) = lower(trim(p_business))
        and date = v_tomorrow and status = 'Mesa Confirmada'
        and reminded_at is null and customer_email is not null
      returning *
    )
    select jsonb_build_object('business_name', c.business_name, 'customer', c.customer, 'customer_email', c.customer_email,
      'items', split_part(c.items, ' · Nota:', 1), 'date', c.date, 'time', c.time, 'token', c.remind_token)
    from claimed c;
end;
$$;
grant execute on function public.claim_reminders(text) to authenticated;

-- Private notes about regular customers ("alérgico al marisco").
create table if not exists public.customer_notes (
  business_name text not null,
  customer_key text not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (business_name, customer_key)
);
alter table public.customer_notes enable row level security;
drop policy if exists customer_notes_owner on public.customer_notes;
create policy customer_notes_owner on public.customer_notes for all
  using (public.is_business_owner(business_name)) with check (public.is_business_owner(business_name));
