-- Days or shifts closed to online bookings: [{ "date": "2026-10-31", "shift": "cena" | "comida" | "todo" }].
alter table public.restaurant_settings add column if not exists blocks jsonb not null default '[]'::jsonb;

-- Instant confirmation: a customer's table booking is confirmed on the spot when the restaurant
-- allows it (profile.auto_confirm, on unless set to false) and its table is still free.
create or replace function public.auto_confirm_booking()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s public.restaurant_settings;
  v_table int;
  v_start int;
  v_end int;
  v_clash boolean;
begin
  if new.status <> 'Pendiente de Aprobación' or new.items not ilike 'Reserva % pax%'
     or new.time !~ '^\d{1,2}:\d{2} - \d{1,2}:\d{2}$' then
    return null;
  end if;
  select * into s from public.restaurant_settings where lower(trim(business_name)) = lower(trim(new.business_name));
  if s.business_name is null or coalesce(s.profile ->> 'auto_confirm', 'true') <> 'true' then return null; end if;
  if coalesce(substring(new.items from '(\d+)\s*pax')::int, 0) > coalesce((s.profile ->> 'max_personas')::int, 20) then return null; end if;

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

  -- The "created" e-mail already tells the customer it is confirmed, so skip the second one.
  update public.orders set status = 'Mesa Confirmada', confirm_notified_at = now() where id = new.id;
  return null;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'orders_auto_confirm') then
    create trigger orders_auto_confirm after insert on public.orders
      for each row execute function public.auto_confirm_booking();
  end if;
end;
$$;
