-- Negocios reales de Palencia montados por NetWish y /admin con clave propia.
--   1. /admin pide, además de iniciar sesión, una clave de administración. Sin ella
--      la base de datos no trata a nadie como administrador (ni siquiera a Daniel).
--   2. El administrador crea negocios reales "sin conectar" (preview): se ven en la app
--      con un aviso y cualquier reserva o pedido es una prueba que no se guarda.
--   3. El administrador entra en el panel de cualquier negocio y se lo asigna a su
--      dueño escribiendo su correo. Si aún no tiene cuenta, le llega al registrarse.
-- Se puede ejecutar más de una vez.

-- ---------- 1. Clave de administración ----------
create table if not exists private.admin_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  hash text not null,
  updated_at timestamptz not null default now()
);

-- Cada clave introducida desbloquea solo esa sesión (ese dispositivo) durante 12 horas.
create table if not exists private.admin_unlocks (
  session_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists private.admin_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);

-- La cuenta está en la lista de administradores (aunque aún no haya puesto la clave).
create or replace function public.is_admin_account()
returns boolean language sql stable security definer
set search_path to 'public', 'private'
as $$ select exists (select 1 from private.admins where user_id = auth.uid()); $$;

-- Administrador de verdad: cuenta de la lista + clave puesta en esta sesión.
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path to 'public', 'private'
as $$
  select exists (select 1 from private.admins where user_id = auth.uid())
     and exists (
       select 1 from private.admin_unlocks u
       where u.user_id = auth.uid()
         and u.session_id = coalesce(auth.jwt() ->> 'session_id', '')
         and u.expires_at > now()
     );
$$;

create or replace function public.admin_status()
returns jsonb language plpgsql stable security definer
set search_path to 'public', 'private'
as $$
begin
  if not public.is_admin_account() then return jsonb_build_object('account', false); end if;
  return jsonb_build_object(
    'account', true,
    'has_key', exists (select 1 from private.admin_keys where user_id = auth.uid()),
    'unlocked', public.is_admin()
  );
end;
$$;

-- La primera vez crea la clave; después la comprueba. 5 fallos = 15 minutos bloqueado.
create or replace function public.admin_unlock(p_key text)
returns boolean language plpgsql security definer
set search_path to 'public', 'private', 'extensions'
as $$
declare
  v_hash text;
  v_session text := auth.jwt() ->> 'session_id';
begin
  if not public.is_admin_account() then raise exception 'No autorizado'; end if;
  if v_session is null then raise exception 'Vuelve a iniciar sesión'; end if;
  if (select count(*) from private.admin_attempts where user_id = auth.uid() and at > now() - interval '15 minutes') >= 5 then
    raise exception 'Demasiados intentos. Espera 15 minutos.';
  end if;

  select hash into v_hash from private.admin_keys where user_id = auth.uid();
  if v_hash is null then
    if length(coalesce(p_key, '')) < 8 then raise exception 'La clave debe tener al menos 8 caracteres'; end if;
    insert into private.admin_keys (user_id, hash) values (auth.uid(), crypt(p_key, gen_salt('bf', 10)));
  elsif crypt(coalesce(p_key, ''), v_hash) <> v_hash then
    insert into private.admin_attempts (user_id) values (auth.uid());
    raise exception 'Clave incorrecta';
  end if;

  delete from private.admin_attempts where user_id = auth.uid();
  delete from private.admin_unlocks where expires_at < now();
  insert into private.admin_unlocks (session_id, user_id, expires_at)
  values (v_session, auth.uid(), now() + interval '12 hours')
  on conflict (session_id) do update set expires_at = excluded.expires_at, user_id = excluded.user_id;
  return true;
end;
$$;

create or replace function public.admin_lock()
returns void language sql security definer
set search_path to 'public', 'private'
as $$ delete from private.admin_unlocks where user_id = auth.uid() and session_id = coalesce(auth.jwt() ->> 'session_id', ''); $$;

create or replace function public.admin_change_key(p_old text, p_new text)
returns void language plpgsql security definer
set search_path to 'public', 'private', 'extensions'
as $$
declare v_hash text;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if length(coalesce(p_new, '')) < 8 then raise exception 'La clave nueva debe tener al menos 8 caracteres'; end if;
  select hash into v_hash from private.admin_keys where user_id = auth.uid();
  if v_hash is not null and crypt(coalesce(p_old, ''), v_hash) <> v_hash then raise exception 'La clave actual no es correcta'; end if;
  update private.admin_keys set hash = crypt(p_new, gen_salt('bf', 10)), updated_at = now() where user_id = auth.uid();
end;
$$;

-- ---------- 2. Negocios reales sin conectar ----------
alter table public.businesses
  add column if not exists preview boolean not null default false,
  add column if not exists pending_owner_email text;

-- El administrador entra en el panel de cualquier negocio, no solo en los de ejemplo.
create or replace function public.is_business_owner(p_business text)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where lower(trim(b.name)) = lower(trim(p_business))
      and (b.owner_id = auth.uid() or public.is_admin())
  );
$$;

alter policy businesses_owner_update on public.businesses
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create or replace function public.admin_create_business(p_name text, p_category text, p_phone text default null, p_address text default null)
returns jsonb language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
  v_base text;
  v_user text;
  v_n int := 1;
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede hacer esto'; end if;
  if length(v_name) < 2 then raise exception 'Escribe el nombre del negocio'; end if;
  if exists (select 1 from public.businesses where lower(trim(name)) = lower(v_name)) then
    raise exception 'Ya hay un negocio con ese nombre. Añade la calle o el barrio.';
  end if;
  v_base := trim(both '-' from regexp_replace(lower(translate(v_name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'negocio'; end if;
  v_user := v_base;
  while exists (select 1 from public.businesses where lower(username) = v_user) loop
    v_n := v_n + 1;
    v_user := v_base || '-' || v_n;
  end loop;
  insert into public.businesses (username, name, category, telefono, address, owner_id, status, preview)
  values (v_user, v_name, left(coalesce(p_category, ''), 60), left(nullif(trim(p_phone), ''), 30),
          left(nullif(trim(p_address), ''), 160), null, 'approved', true);
  return jsonb_build_object('username', v_user, 'name', v_name);
end;
$$;

-- Todos los negocios de verdad, con el correo de su dueño, para /admin.
create or replace function public.admin_businesses()
returns table (username text, name text, category text, status text, preview boolean, owner_email text, pending_owner_email text, created_at timestamptz)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede hacer esto'; end if;
  return query
    select b.username, b.name, b.category, b.status, b.preview, u.email::text, b.pending_owner_email, b.created_at
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    where not b.demo
    order by b.created_at desc;
end;
$$;

-- Asigna el negocio a la cuenta con ese correo. Si aún no existe, se le asigna al registrarse.
create or replace function public.admin_assign_owner(p_username text, p_email text)
returns jsonb language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
  v_other text;
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede hacer esto'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido'; end if;
  if not exists (select 1 from public.businesses where username = p_username) then raise exception 'No encuentro ese negocio'; end if;

  select id into v_user from auth.users where lower(email) = v_email limit 1;
  if v_user is null then
    update public.businesses set pending_owner_email = v_email where username = p_username;
    return jsonb_build_object('assigned', false, 'email', v_email);
  end if;

  select name into v_other from public.businesses where owner_id = v_user and username <> p_username limit 1;
  if v_other is not null then raise exception 'Esa cuenta ya lleva otro negocio: %', v_other; end if;

  update public.businesses
  set owner_id = v_user, preview = false, pending_owner_email = null,
      notification_email = coalesce(nullif(notification_email, ''), v_email)
  where username = p_username;
  return jsonb_build_object('assigned', true, 'email', v_email);
end;
$$;

-- Quita el dueño: el negocio vuelve a estar sin conectar.
create or replace function public.admin_release_owner(p_username text)
returns void language plpgsql security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede hacer esto'; end if;
  update public.businesses set owner_id = null, pending_owner_email = null, preview = true where username = p_username and not demo;
end;
$$;

-- Al entrar con una cuenta confirmada recoge el negocio que tenga esperando su correo.
create or replace function public.claim_invited_business()
returns text language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_email text;
  v_name text;
begin
  if auth.uid() is null then return null; end if;
  if exists (select 1 from public.businesses where owner_id = auth.uid()) then return null; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return null; end if;
  update public.businesses
  set owner_id = auth.uid(), preview = false, pending_owner_email = null,
      notification_email = coalesce(nullif(notification_email, ''), v_email)
  where username = (
    select username from public.businesses
    where owner_id is null and lower(pending_owner_email) = v_email
    order by created_at limit 1
  )
  returning name into v_name;
  return v_name;
end;
$$;

-- Un negocio sin conectar no recibe reservas ni pedidos de verdad: la app enseña el aviso.
create or replace function public.orders_block_preview()
returns trigger language plpgsql security definer
set search_path to 'public'
as $$
declare v_biz public.businesses;
begin
  select * into v_biz from public.businesses
  where lower(trim(name)) = lower(trim(new.business_name)) and preview limit 1;
  if v_biz.name is not null and not public.is_admin() then
    raise exception '%', 'Esto es una prueba: ' || v_biz.name || ' aún no está conectado con NetWish y no se ha guardado nada.'
      || coalesce(' Para reservar de verdad, llama al ' || nullif(btrim(v_biz.telefono), '') || '.', '');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_block_preview on public.orders;
create trigger orders_block_preview before insert on public.orders
  for each row execute function public.orders_block_preview();

revoke execute on function public.is_admin_account() from public, anon;
revoke execute on function public.admin_status() from public, anon;
revoke execute on function public.admin_unlock(text) from public, anon;
revoke execute on function public.admin_lock() from public, anon;
revoke execute on function public.admin_change_key(text, text) from public, anon;
revoke execute on function public.admin_create_business(text, text, text, text) from public, anon;
revoke execute on function public.admin_businesses() from public, anon;
revoke execute on function public.admin_assign_owner(text, text) from public, anon;
revoke execute on function public.admin_release_owner(text) from public, anon;
revoke execute on function public.claim_invited_business() from public, anon;
revoke execute on function public.orders_block_preview() from public, anon, authenticated;
grant execute on function public.is_admin_account() to authenticated;
grant execute on function public.admin_status() to authenticated;
grant execute on function public.admin_unlock(text) to authenticated;
grant execute on function public.admin_lock() to authenticated;
grant execute on function public.admin_change_key(text, text) to authenticated;
grant execute on function public.admin_create_business(text, text, text, text) to authenticated;
grant execute on function public.admin_businesses() to authenticated;
grant execute on function public.admin_assign_owner(text, text) to authenticated;
grant execute on function public.admin_release_owner(text) to authenticated;
grant execute on function public.claim_invited_business() to authenticated;
