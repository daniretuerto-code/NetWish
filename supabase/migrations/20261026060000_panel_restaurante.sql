-- Panel del restaurante: cada reserva guarda personas, mesas, zona y nota en columnas propias,
-- y los clientes pueden llevar etiquetas (VIP, alergia, cumpleaños...).

-- 1. Campos de la reserva. La web sigue escribiendo el texto "Reserva 4 pax — Mesa 3 (Terraza) · Nota: …";
--    un disparador lo separa en columnas cada vez que se crea o se cambia, así nada se desincroniza.
alter table public.orders add column if not exists guests integer;
alter table public.orders add column if not exists tables integer[];
alter table public.orders add column if not exists zone text;
alter table public.orders add column if not exists note text;

create or replace function public.orders_booking_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  head text := split_part(coalesce(new.items, ''), ' · Nota:', 1);
  list text;
begin
  if coalesce(new.items, '') !~* '\d+\s*pax' then
    return new;
  end if;
  new.guests := substring(head from '(\d+)\s*[pP][aA][xX]')::integer;
  list := substring(head from 'Mesas? (\d+(?:\+\d+)*)');
  new.tables := case when list is null then '{}'::integer[] else string_to_array(list, '+')::integer[] end;
  new.zone := substring(head from 'Mesas? [0-9+]+ \(([^)]+)\)');
  new.note := nullif(btrim(substring(coalesce(new.items, '') from ' · Nota:(.*)$')), '');
  return new;
end;
$$;

drop trigger if exists orders_booking_fields on public.orders;
create trigger orders_booking_fields
  before insert or update of items on public.orders
  for each row execute function public.orders_booking_fields();

-- Rellena las reservas que ya existen (no cambia ningún otro dato).
update public.orders set items = items where items ~* '\d+\s*pax';

create index if not exists orders_business_date_idx on public.orders (business_name, date);

-- 2. Etiquetas de cliente.
alter table public.customer_notes add column if not exists tags text[] not null default '{}';
