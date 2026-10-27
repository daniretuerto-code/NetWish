-- Eventos en Palencia: los planes de la ciudad que publica NetWish (fiestas, mercados,
-- conciertos…). Los de cada negocio siguen en restaurant_settings.profile.eventos y la
-- app los junta. Todo el mundo los lee; solo el administrador los escribe.
-- Se puede ejecutar más de una vez.

create table if not exists public.city_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 100),
  date date not null,
  end_date date,
  time text,
  place text,
  category text not null default 'cultura',
  description text,
  price numeric,
  image_url text,
  link text,
  business_name text,
  created_at timestamptz not null default now()
);

create index if not exists city_events_date on public.city_events (date);

alter table public.city_events enable row level security;

drop policy if exists city_events_read on public.city_events;
create policy city_events_read on public.city_events for select using (true);

drop policy if exists city_events_admin_write on public.city_events;
create policy city_events_admin_write on public.city_events
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.city_events to anon, authenticated;
grant insert, update, delete on public.city_events to authenticated;
