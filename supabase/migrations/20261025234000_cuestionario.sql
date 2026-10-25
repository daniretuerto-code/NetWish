-- Respuestas del cuestionario de cada negocio: deciden su panel y lo que ve el cliente.
alter table public.restaurant_settings add column if not exists profile jsonb not null default '{}'::jsonb;
