-- NetWish deja de cobrar: solo reservas. Servicios con duración para peluquerías,
-- horario y equipo por negocio, y fuera los pedidos "pagados" sin cobro real.

alter table public.products
  add column if not exists duration_min integer,
  add column if not exists extra_long_min integer not null default 0,
  add column if not exists price_from boolean not null default false;

alter table public.restaurant_settings
  add column if not exists staff jsonb not null default '[]'::jsonb,
  add column if not exists closed_days integer[] not null default '{}';

-- Desde el navegador solo se pueden crear solicitudes de reserva pendientes.
alter policy orders_insert on public.orders with check (
  status = 'Pendiente de Aprobación'
  and items ilike 'Reserva%'
  and (customer_id is null or customer_id = auth.uid())
  and (customer_email is null or lower(customer_email) = lower(auth.jwt() ->> 'email'))
  and total >= 0
);

-- Huecos ocupados: sin la nota del cliente, que es privada.
create or replace function public.reserved_slots(p_business text, p_date text)
returns table(slot_items text, slot_time text)
language sql stable security definer
set search_path to 'public'
as $$
  select split_part(o.items, ' · Nota:', 1), o.time from public.orders o
  where lower(trim(o.business_name)) = lower(trim(p_business))
    and o.date = p_date
    and o.items ilike 'Reserva%'
    and o.status not in ('Rechazado');
$$;

-- Ya no hay pagos desde la mesa ni el antiguo aviso por pg_net.
revoke execute on function public.table_pay(uuid, numeric, text, text) from public, anon, authenticated;
revoke execute on function public.trigger_send_order_email() from public, anon, authenticated;
alter function public.trigger_send_order_email() set search_path = public;
