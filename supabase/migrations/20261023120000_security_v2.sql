-- NetWish v2: security hardening.
-- Business accounts move to Supabase Auth, every table gets RLS,
-- and writes that guests need (table orders, payments, notifications) go through
-- narrow SECURITY DEFINER functions instead of open table access.

begin;

-- ---------------------------------------------------------------------------
-- 1. Business accounts: link to auth.users, hide legacy passwords
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.business_credentials (
  username text primary key,
  password text not null
);

insert into private.business_credentials (username, password)
select trim(username), password from public.businesses
where password is not null
on conflict (username) do nothing;

alter table public.businesses drop constraint if exists businesses_password_key;
alter table public.businesses drop column if exists password;

alter table public.businesses add column if not exists owner_id uuid unique references auth.users (id) on delete set null;
update public.businesses set username = trim(username) where username <> trim(username);

create or replace function public.is_business_owner(p_business text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.owner_id = auth.uid()
      and lower(trim(b.name)) = lower(trim(p_business))
  );
$$;

-- A signed-in user proves they own a legacy business account once with its old
-- username and password; from then on they sign in with their own email.
create or replace function public.claim_business(p_username text, p_password text)
returns public.businesses
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_biz public.businesses;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión antes de vincular tu negocio';
  end if;

  if not exists (
    select 1 from private.business_credentials c
    where lower(c.username) = lower(trim(p_username)) and c.password = p_password
  ) then
    raise exception 'Usuario o contraseña de comercio incorrectos';
  end if;

  select * into v_biz from public.businesses
  where lower(username) = lower(trim(p_username))
  for update;

  if v_biz.owner_id is not null and v_biz.owner_id <> auth.uid() then
    raise exception 'Este negocio ya está vinculado a otra cuenta';
  end if;

  update public.businesses set owner_id = auth.uid()
  where username = v_biz.username
  returning * into v_biz;

  delete from private.business_credentials where lower(username) = lower(trim(p_username));
  return v_biz;
end;
$$;

revoke execute on function public.claim_business(text, text) from public, anon;
grant execute on function public.claim_business(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Table-level policies
-- ---------------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.table_sessions enable row level security;

drop policy if exists "Permitir lectura publica de businesses" on public.businesses;
drop policy if exists "Permitir update publico en businesses" on public.businesses;
drop policy if exists "Permitir todo en messages" on public.messages;
drop policy if exists "Permitir update en messages" on public.messages;
drop policy if exists "Permitir insercion y actualizacion" on public.restaurant_settings;
drop policy if exists "Permitir lectura publica de configuracion" on public.restaurant_settings;

-- businesses: public directory, owners edit their own row
create policy businesses_read on public.businesses for select using (true);
create policy businesses_owner_update on public.businesses for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke update on public.businesses from anon, authenticated;
grant update (category, telefono, notification_email, image, cover_url) on public.businesses to authenticated;

-- products
create policy products_read on public.products for select using (true);
create policy products_owner_write on public.products for all
  using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

-- restaurant settings
create policy settings_read on public.restaurant_settings for select using (true);
create policy settings_owner_write on public.restaurant_settings for all
  using (public.is_business_owner(business_name)) with check (public.is_business_owner(business_name));

create policy restaurant_tables_read on public.restaurant_tables for select using (true);
create policy restaurant_tables_owner_write on public.restaurant_tables for all
  using (public.is_business_owner(business_name)) with check (public.is_business_owner(business_name));

-- orders: anyone can place one, only the shop and the customer can read it
alter table public.orders add column if not exists customer_id uuid references auth.users (id) on delete set null;
alter table public.orders add column if not exists notified_at timestamptz;
alter table public.orders add column if not exists confirm_notified_at timestamptz;

create policy orders_insert on public.orders for insert
  with check (
    status in ('Pagado Online', 'Pendiente de Aprobación', 'Comanda en Cocina')
    and (customer_id is null or customer_id = auth.uid())
    and (customer_email is null or lower(customer_email) = lower(auth.jwt() ->> 'email'))
    and total >= 0
  );
create policy orders_read on public.orders for select
  using (
    public.is_business_owner(business_name)
    or (auth.uid() is not null and customer_id = auth.uid())
    or (auth.jwt() ->> 'email' is not null and lower(customer_email) = lower(auth.jwt() ->> 'email'))
  );
create policy orders_owner_update on public.orders for update
  using (public.is_business_owner(business_name)) with check (public.is_business_owner(business_name));

-- messages: a conversation belongs to one customer account and one business
alter table public.messages add column if not exists customer_id uuid references auth.users (id) on delete cascade;

create policy messages_read on public.messages for select
  using (customer_id = auth.uid() or public.is_business_owner(business_name));
create policy messages_customer_insert on public.messages for insert to authenticated
  with check (sender_type = 'customer' and customer_id = auth.uid());
create policy messages_business_insert on public.messages for insert to authenticated
  with check (sender_type = 'business' and public.is_business_owner(business_name));
create policy messages_business_update on public.messages for update to authenticated
  using (public.is_business_owner(business_name)) with check (public.is_business_owner(business_name));

-- table sessions: readable for the table's guests, written only through functions
create policy table_sessions_read on public.table_sessions for select using (true);
create policy table_sessions_owner_update on public.table_sessions for update
  using (public.is_business_owner(business_name)) with check (public.is_business_owner(business_name));

-- ---------------------------------------------------------------------------
-- 3. Guest actions at a table
-- ---------------------------------------------------------------------------
create or replace function public.table_add_items(p_business text, p_table integer, p_items jsonb, p_customer text default null)
returns public.table_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.table_sessions;
  v_added numeric;
  v_biz text;
  v_items jsonb;
begin
  select name into v_biz from public.businesses where lower(trim(name)) = lower(trim(p_business));
  if v_biz is null then raise exception 'Negocio no encontrado'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Pedido vacío'; end if;

  -- Names and prices always come from the shop's own products, never from the guest.
  select jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'price', p.price,
           'qty', least(greatest(coalesce((i ->> 'qty')::int, 1), 1), 50))),
         sum(p.price * least(greatest(coalesce((i ->> 'qty')::int, 1), 1), 50))
    into v_items, v_added
  from jsonb_array_elements(p_items) i
  join public.products p
    on p.id::text = i ->> 'id'
   and lower(trim(p.business_id)) = lower(trim(v_biz));
  if v_items is null or coalesce(v_added, 0) <= 0 then raise exception 'Pedido no válido'; end if;

  select * into v_session from public.table_sessions
  where lower(trim(business_name)) = lower(trim(v_biz)) and table_number = p_table and status = 'open'
  order by created_at desc limit 1
  for update;

  if v_session.id is null then
    insert into public.table_sessions (business_name, table_number, items, total_amount, paid_amount, remaining_amount, status, payers)
    values (v_biz, p_table, v_items, v_added, 0, v_added, 'open', '[]'::jsonb)
    returning * into v_session;
  else
    update public.table_sessions set
      items = coalesce(items, '[]'::jsonb) || v_items,
      total_amount = coalesce(total_amount, 0) + v_added,
      remaining_amount = coalesce(remaining_amount, 0) + v_added,
      updated_at = now()
    where id = v_session.id
    returning * into v_session;
  end if;

  insert into public.orders (business_name, customer, items, total, date, time, status)
  values (
    v_biz,
    coalesce(nullif(trim(p_customer), ''), 'Comensal') || ' (Mesa ' || p_table || ')',
    (select string_agg((i ->> 'qty') || 'x ' || (i ->> 'name'), ', ') from jsonb_array_elements(v_items) i),
    v_added,
    to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD'),
    to_char(now() at time zone 'Europe/Madrid', 'HH24:MI'),
    'Comanda en Cocina'
  );

  return v_session;
end;
$$;

create or replace function public.table_pay(p_session uuid, p_amount numeric, p_name text default null, p_email text default null)
returns public.table_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.table_sessions;
  v_amount numeric;
begin
  select * into v_session from public.table_sessions where id = p_session and status = 'open' for update;
  if v_session.id is null then raise exception 'La cuenta ya está cerrada'; end if;

  v_amount := least(greatest(coalesce(p_amount, 0), 0), v_session.remaining_amount);
  if v_amount <= 0 then raise exception 'Importe no válido'; end if;

  update public.table_sessions set
    paid_amount = paid_amount + v_amount,
    remaining_amount = remaining_amount - v_amount,
    status = case when remaining_amount - v_amount <= 0 then 'paid' else 'open' end,
    payers = coalesce(payers, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'name', left(coalesce(nullif(trim(p_name), ''), 'Comensal'), 40),
      'amount', v_amount,
      'time', to_char(now() at time zone 'Europe/Madrid', 'HH24:MI')
    )),
    updated_at = now()
  where id = p_session
  returning * into v_session;

  return v_session;
end;
$$;

grant execute on function public.table_add_items(text, integer, jsonb, text) to anon, authenticated;
grant execute on function public.table_pay(uuid, numeric, text, text) to anon, authenticated;

-- Booked tables for a day, without any customer data, so guests can see free slots.
create or replace function public.reserved_slots(p_business text, p_date text)
returns table (slot_items text, slot_time text)
language sql
stable
security definer
set search_path = public
as $$
  select o.items, o.time from public.orders o
  where lower(trim(o.business_name)) = lower(trim(p_business))
    and o.date = p_date
    and o.items ilike 'Reserva%'
    and o.status not in ('Rechazado');
$$;

grant execute on function public.reserved_slots(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. One-shot e-mail notifications (used by /api/notify-order)
-- ---------------------------------------------------------------------------
create or replace function public.claim_order_notification(p_order uuid, p_kind text default 'created')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_biz_email text;
begin
  if p_kind = 'created' then
    update public.orders set notified_at = now()
    where id = p_order and notified_at is null and created_at > now() - interval '15 minutes'
    returning * into v_order;
  elsif p_kind = 'confirmed' then
    update public.orders set confirm_notified_at = now()
    where id = p_order and confirm_notified_at is null and status = 'Mesa Confirmada'
      and public.is_business_owner(business_name)
    returning * into v_order;
  end if;

  if v_order.id is null then return null; end if;

  select notification_email into v_biz_email from public.businesses
  where lower(trim(name)) = lower(trim(v_order.business_name));

  return jsonb_build_object(
    'id', v_order.id,
    'business_name', v_order.business_name,
    'business_email', v_biz_email,
    'customer', v_order.customer,
    'customer_email', v_order.customer_email,
    'items', v_order.items,
    'total', v_order.total,
    'date', v_order.date,
    'time', v_order.time,
    'status', v_order.status
  );
end;
$$;

grant execute on function public.claim_order_notification(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Sign-up requests from new businesses
-- ---------------------------------------------------------------------------
create table if not exists public.business_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(name) between 2 and 120),
  city text,
  address text,
  category text,
  modality text,
  email text not null check (position('@' in email) > 1),
  phone text
);
alter table public.business_requests enable row level security;
create policy business_requests_insert on public.business_requests for insert with check (true);

-- ---------------------------------------------------------------------------
-- 6. Storage: only signed-in accounts can upload
-- ---------------------------------------------------------------------------
drop policy if exists "Permitir actualizar en public-images" on storage.objects;
drop policy if exists "Permitir subida publica en public-images" on storage.objects;
drop policy if exists "Permitir subida de audio" on storage.objects;

create policy "Subida autenticada de imagenes" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-images');
create policy "Actualizar imagenes propias" on storage.objects for update to authenticated
  using (bucket_id = 'public-images' and owner = auth.uid());
create policy "Subida autenticada de audio" on storage.objects for insert to authenticated
  with check (bucket_id = 'beats');

-- ---------------------------------------------------------------------------
-- 7. Realtime
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['orders', 'messages', 'table_sessions'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;
