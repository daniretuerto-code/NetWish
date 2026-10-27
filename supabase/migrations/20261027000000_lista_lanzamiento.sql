-- Lista de espera del lanzamiento: correos de la pantalla "Muy pronto" de netwish.es.
-- El público solo puede apuntarse (función join_launch_list); leer la lista y marcar
-- a quién se avisó es solo para el administrador.

create table if not exists public.launch_signups (
  id bigint generated always as identity primary key,
  email text not null unique,
  source text,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

alter table public.launch_signups enable row level security;

drop policy if exists launch_signups_admin_read on public.launch_signups;
create policy launch_signups_admin_read on public.launch_signups
  for select using (public.is_admin());

drop policy if exists launch_signups_admin_update on public.launch_signups;
create policy launch_signups_admin_update on public.launch_signups
  for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.join_launch_list(p_email text, p_source text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
begin
  if length(e) > 254 or e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Escribe un correo válido';
  end if;
  insert into public.launch_signups (email, source)
  values (e, left(nullif(trim(coalesce(p_source, '')), ''), 60))
  on conflict (email) do nothing;
  return true;
end;
$$;

revoke all on function public.join_launch_list(text, text) from public;
grant execute on function public.join_launch_list(text, text) to anon, authenticated;
