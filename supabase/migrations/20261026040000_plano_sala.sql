-- The dining room plan: zones (Sala, Terraza…) and the walls, bar, doors… drawn around the tables.
-- Tables keep their own place in `tables` (x, y, shape, rot, join).
alter table public.restaurant_settings add column if not exists floor jsonb not null default '{}'::jsonb;

-- Tables named in a booking: "Mesa 3 (Terraza)" → {3}, "Mesas 2+3 (Sala Principal)" → {2,3}.
create or replace function public.booking_tables(p_items text)
returns int[]
language sql immutable set search_path = public
as $$
  select coalesce(
    (select array_agg(n::int) from unnest(string_to_array(substring(split_part(p_items, ' · Nota:', 1) from 'Mesas? ([0-9]+(?:\+[0-9]+)*)'), '+')) as n where n <> ''),
    '{}'::int[]);
$$;

-- Instant confirmation, now also for groups on two joined tables: every table must be free.
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
