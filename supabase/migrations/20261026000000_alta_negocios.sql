-- Alta de negocios desde la app: el dueño crea su negocio al momento, queda
-- pendiente y su página no es pública hasta que un administrador lo aprueba.

alter table public.businesses
  add column if not exists status text not null default 'approved',
  add column if not exists address text,
  add column if not exists created_at timestamptz not null default now();

do $$ begin
  alter table public.businesses add constraint businesses_status_check check (status in ('pending', 'approved', 'rejected'));
exception when duplicate_object then null; end $$;

create table if not exists private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
-- Daniel, dueño de NetWish.
insert into private.admins (user_id) values ('26405283-7ca9-4d97-aca1-f7080d3b78a8') on conflict do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path to 'public', 'private'
as $$ select exists (select 1 from private.admins where user_id = auth.uid()); $$;

-- El directorio solo enseña negocios aprobados; el dueño y el admin ven el suyo pendiente.
alter policy businesses_read on public.businesses
  using (status = 'approved' or owner_id = auth.uid() or public.is_admin());

create or replace function public.create_my_business(p_name text, p_category text, p_phone text default null, p_address text default null)
returns jsonb language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
  v_base text;
  v_user text;
  v_n int := 1;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para dar de alta tu negocio'; end if;
  if length(v_name) < 2 then raise exception 'Escribe el nombre de tu negocio'; end if;
  if exists (select 1 from public.businesses where owner_id = auth.uid()) then
    raise exception 'Tu cuenta ya tiene un negocio';
  end if;
  if exists (select 1 from public.businesses where lower(trim(name)) = lower(v_name)) then
    raise exception 'Ya hay un negocio con ese nombre. Prueba a añadir la calle o el barrio.';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(translate(v_name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'negocio'; end if;
  v_user := v_base;
  while exists (select 1 from public.businesses where lower(username) = v_user) loop
    v_n := v_n + 1;
    v_user := v_base || '-' || v_n;
  end loop;

  insert into public.businesses (username, name, category, telefono, address, owner_id, status, notification_email)
  values (v_user, v_name, left(coalesce(p_category, ''), 60), left(nullif(trim(p_phone), ''), 30),
          left(nullif(trim(p_address), ''), 160), auth.uid(), 'pending', auth.jwt() ->> 'email');

  return jsonb_build_object('username', v_user, 'name', v_name);
end;
$$;

create or replace function public.set_business_status(p_username text, p_status text)
returns void language plpgsql security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede hacer esto'; end if;
  if p_status not in ('pending', 'approved', 'rejected') then raise exception 'Estado no válido'; end if;
  update public.businesses set status = p_status where username = p_username;
end;
$$;

revoke execute on function public.create_my_business(text, text, text, text) from public, anon;
revoke execute on function public.set_business_status(text, text) from public, anon;
grant execute on function public.create_my_business(text, text, text, text) to authenticated;
grant execute on function public.set_business_status(text, text) to authenticated;

-- Solicitudes y mensajes de contacto: con explicación y cuenta; solo el admin las lee.
alter table public.business_requests
  add column if not exists description text,
  add column if not exists kind text not null default 'alta',
  add column if not exists user_id uuid default auth.uid();

do $$ begin
  create policy business_requests_admin_read on public.business_requests for select using (public.is_admin());
exception when duplicate_object then null; end $$;
