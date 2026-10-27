-- Más tipos de negocio: tiendas con catálogo, tallas y stock, pedidos para recoger
-- en el local, mostrador del día de las panaderías, clases con plazas y negocios de
-- ejemplo para enseñar NetWish. Se puede ejecutar más de una vez.

-- ---------- 1. Productos con fotos, stock y tallas ----------
alter table public.products
  add column if not exists image_url text,
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists stock integer,
  add column if not exists daily_qty integer,
  add column if not exists variants jsonb,
  add column if not exists sold_out boolean not null default false,
  add column if not exists hidden boolean not null default false,
  add column if not exists featured boolean not null default false,
  add column if not exists unit text,
  add column if not exists old_price numeric,
  add column if not exists preorder_days integer not null default 0;

-- ---------- 2. Pedidos para recoger ----------
alter table public.orders
  add column if not exists lines jsonb,
  add column if not exists pickup_code text,
  add column if not exists payment text,
  add column if not exists ready_notified_at timestamptz;

-- ---------- 3. Negocios de ejemplo: el administrador entra a su panel ----------
alter table public.businesses add column if not exists demo boolean not null default false;

create or replace function public.is_business_owner(p_business text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where lower(trim(b.name)) = lower(trim(p_business))
      and (b.owner_id = auth.uid() or (b.demo and public.is_admin()))
  );
$$;

alter policy businesses_owner_update on public.businesses
  using (owner_id = auth.uid() or (demo and public.is_admin()))
  with check (owner_id = auth.uid() or (demo and public.is_admin()));

-- Antes de abrir NetWish al público se ocultan todos los ejemplos de golpe.
create or replace function public.set_demo_visibility(p_visible boolean)
returns int language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede hacer esto'; end if;
  update public.businesses set status = case when p_visible then 'approved' else 'rejected' end where demo;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.set_demo_visibility(boolean) from public, anon;
grant execute on function public.set_demo_visibility(boolean) to authenticated;

-- ---------- 4. Hacer un pedido para recoger ----------
-- Precios y stock salen siempre de la tienda, nunca del navegador. Descuenta el stock
-- al momento (por talla y color si los hay) y devuelve el código de recogida.
create or replace function public.create_pickup_order(
  p_business text, p_lines jsonb, p_date text, p_time text, p_payment text,
  p_name text, p_email text, p_phone text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_biz public.businesses;
  v_id uuid := gen_random_uuid();
  v_email text := lower(btrim(coalesce(nullif(btrim(p_email), ''), auth.jwt() ->> 'email', '')));
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_line jsonb;
  v_p public.products;
  v_qty int;
  v_var text;
  v_have int;
  v_total numeric := 0;
  v_text text[] := '{}';
  v_lines jsonb := '[]'::jsonb;
  v_code text := lpad((floor(random() * 10000))::int::text, 4, '0');
  v_pay text := case when p_payment in ('tarjeta', 'efectivo', 'bizum', 'online') then p_payment else 'tienda' end;
  v_note text := nullif(btrim(left(coalesce(p_note, ''), 240)), '');
begin
  select * into v_biz from public.businesses where lower(trim(name)) = lower(trim(p_business)) and status = 'approved' limit 1;
  if v_biz.name is null then raise exception 'Este comercio no acepta pedidos'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Escribe tu nombre'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido'; end if;
  if coalesce(p_date, '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_time, '') !~ '^\d{1,2}:\d{2}$' then raise exception 'Elige día y hora de recogida'; end if;
  if p_date::date < v_today or p_date::date > v_today + 60 then raise exception 'Elige un día de recogida de los próximos dos meses'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'La cesta está vacía'; end if;
  if jsonb_array_length(p_lines) > 40 then raise exception 'Demasiados productos en un pedido'; end if;
  if (select count(*) from public.orders where lower(customer_email) = v_email and created_at > now() - interval '1 day') >= 6 then
    raise exception 'Has hecho demasiados pedidos hoy. Llama a la tienda.';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := greatest(1, least(99, coalesce((v_line ->> 'qty')::int, 1)));
    select * into v_p from public.products
    where id = (v_line ->> 'id')::uuid and lower(trim(business_id)) = lower(trim(v_biz.name))
    for update;
    if v_p.id is null or v_p.hidden then raise exception 'Un producto de tu cesta ya no está a la venta'; end if;
    if v_p.sold_out then raise exception '% está agotado', v_p.name; end if;
    if coalesce(v_p.preorder_days, 0) > 0 and p_date::date < v_today + v_p.preorder_days then
      raise exception '% se encarga con % % de antelación', v_p.name, v_p.preorder_days, case when v_p.preorder_days = 1 then 'día' else 'días' end;
    end if;
    v_var := nullif(btrim(coalesce(v_line ->> 'variant', '')), '');
    if v_var is null and (jsonb_array_length(coalesce(v_p.variants -> 'sizes', '[]')) > 0 or jsonb_array_length(coalesce(v_p.variants -> 'colors', '[]')) > 0) then
      raise exception 'Elige talla o color de %', v_p.name;
    end if;

    if v_var is not null and coalesce(v_p.variants -> 'stock', '{}'::jsonb) ? v_var then
      v_have := coalesce((v_p.variants -> 'stock' ->> v_var)::int, 0);
      if v_have < v_qty then
        raise exception '%', case when v_have = 0 then format('%s (%s) está agotado', v_p.name, replace(v_var, '|', ' · '))
          else format('Solo quedan %s de %s (%s)', v_have, v_p.name, replace(v_var, '|', ' · ')) end;
      end if;
      update public.products set variants = jsonb_set(variants, array['stock', v_var], to_jsonb(v_have - v_qty)) where id = v_p.id;
    elsif v_p.stock is not null then
      if v_p.stock < v_qty then
        raise exception '%', case when v_p.stock <= 0 then format('%s está agotado', v_p.name) else format('Solo quedan %s de %s', v_p.stock, v_p.name) end;
      end if;
      update public.products set stock = stock - v_qty, sold_out = (stock - v_qty <= 0) where id = v_p.id;
    end if;

    v_total := v_total + coalesce(v_p.price, 0) * v_qty;
    v_text := v_text || format('%sx %s%s', v_qty, v_p.name, case when v_var is not null then ' (' || replace(v_var, '|', ' · ') || ')' else '' end);
    v_lines := v_lines || jsonb_build_object('id', v_p.id, 'name', v_p.name, 'qty', v_qty, 'variant', v_var,
      'price', v_p.price, 'unit', v_p.unit, 'image', v_p.image_url);
  end loop;

  insert into public.orders (id, business_name, customer, customer_email, customer_id, phone, items, total, date, time, status, source, lines, pickup_code, payment, note)
  values (v_id, v_biz.name, left(btrim(p_name), 60), v_email, auth.uid(), left(nullif(btrim(p_phone), ''), 20),
          left('Pedido para recoger: ' || array_to_string(v_text, ', ') || coalesce(' · Nota: ' || v_note, ''), 900),
          round(v_total, 2), p_date, p_time, 'Pedido Recibido', 'app', v_lines, v_code, v_pay, v_note);

  return jsonb_build_object('id', v_id, 'code', v_code, 'total', round(v_total, 2),
    'token', (select remind_token from public.orders where id = v_id));
end;
$$;
grant execute on function public.create_pickup_order(text, jsonb, text, text, text, text, text, text, text) to anon, authenticated;

-- Un pedido cancelado devuelve lo que se había apartado.
create or replace function public.pickup_restock()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  l jsonb;
  v_key text;
begin
  if new.lines is null or new.status not in ('Cancelado', 'Rechazado') or old.status in ('Cancelado', 'Rechazado', 'Recogido') then
    return null;
  end if;
  for l in select * from jsonb_array_elements(new.lines) loop
    v_key := l ->> 'variant';
    update public.products p set
      variants = case when v_key is not null and coalesce(p.variants -> 'stock', '{}'::jsonb) ? v_key
        then jsonb_set(p.variants, array['stock', v_key], to_jsonb(coalesce((p.variants -> 'stock' ->> v_key)::int, 0) + (l ->> 'qty')::int))
        else p.variants end,
      stock = case when p.stock is not null and not (v_key is not null and coalesce(p.variants -> 'stock', '{}'::jsonb) ? v_key)
        then p.stock + (l ->> 'qty')::int else p.stock end,
      sold_out = case when p.stock is not null and not (v_key is not null and coalesce(p.variants -> 'stock', '{}'::jsonb) ? v_key)
        then false else p.sold_out end
    where p.id = (l ->> 'id')::uuid;
  end loop;
  return null;
end;
$$;

drop trigger if exists orders_pickup_restock on public.orders;
create trigger orders_pickup_restock after update of status on public.orders
  for each row when (new.status is distinct from old.status) execute function public.pickup_restock();

-- The customer can still cancel an order the shop has not started.
create or replace function public.cancel_my_booking(p_order uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.orders set status = 'Cancelado'
  where id = p_order
    and status in ('Pendiente de Aprobación', 'Mesa Confirmada', 'Pedido Recibido')
    and date >= to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD')
    and ((auth.uid() is not null and customer_id = auth.uid())
      or (auth.jwt() ->> 'email' is not null and lower(customer_email) = lower(auth.jwt() ->> 'email')));
  if not found then raise exception 'No se puede cancelar'; end if;
end;
$$;

-- ---------- 5. Avisos por correo: también "tu pedido está listo" ----------
create or replace function public.claim_order_notification(p_order uuid, p_kind text default 'created')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_biz_email text;
  v_address text;
  v_phone text;
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
  elsif p_kind = 'changed' then
    update public.orders set change_notified_at = now()
    where id = p_order and change_notified_at is null and changed_at > now() - interval '15 minutes'
    returning * into v_order;
  elsif p_kind = 'ready' then
    update public.orders set ready_notified_at = now()
    where id = p_order and ready_notified_at is null and status = 'Listo para recoger'
      and public.is_business_owner(business_name)
    returning * into v_order;
  end if;

  if v_order.id is null then return null; end if;

  select notification_email, address, telefono into v_biz_email, v_address, v_phone from public.businesses
  where lower(trim(name)) = lower(trim(v_order.business_name)) limit 1;

  return jsonb_build_object(
    'id', v_order.id,
    'business_name', v_order.business_name,
    'business_email', v_biz_email,
    'business_phone', v_phone,
    'address', v_address,
    'customer', v_order.customer,
    'customer_email', v_order.customer_email,
    'phone', v_order.phone,
    'items', v_order.items,
    'total', v_order.total,
    'date', v_order.date,
    'time', v_order.time,
    'status', v_order.status,
    'token', v_order.remind_token,
    'pickup_code', v_order.pickup_code,
    'payment', v_order.payment,
    'lines', v_order.lines
  );
end;
$$;

-- ---------- 6. Clases con plazas: se confirman solas mientras quede sitio ----------
create or replace function public.auto_confirm_class()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_start text := split_part(coalesce(new.time, ''), ' - ', 1);
  v_cap int;
  v_taken int;
begin
  if new.status <> 'Pendiente de Aprobación' or new.items not ilike 'Reserva clase:%' then return null; end if;
  v_name := lower(btrim(split_part(regexp_replace(new.items, '^Reserva clase:\s*', '', 'i'), ' · ', 1)));
  select max((c ->> 'plazas')::int) into v_cap
  from public.restaurant_settings s, jsonb_array_elements(coalesce(s.profile -> 'clases', '[]'::jsonb)) c
  where lower(trim(s.business_name)) = lower(trim(new.business_name))
    and lower(btrim(c ->> 'name')) = v_name and c ->> 'time' = v_start;
  if v_cap is null then return null; end if;
  select count(*) into v_taken from public.orders o
  where o.id <> new.id and lower(trim(o.business_name)) = lower(trim(new.business_name))
    and o.date = new.date and split_part(o.time, ' - ', 1) = v_start and o.items ilike 'Reserva clase:%'
    and lower(btrim(split_part(regexp_replace(o.items, '^Reserva clase:\s*', '', 'i'), ' · ', 1))) = v_name
    and o.status not in ('Rechazado', 'Cancelado', 'No vino');
  if v_taken >= v_cap then return null; end if;
  update public.orders set status = 'Mesa Confirmada', confirm_notified_at = now() where id = new.id;
  return null;
end;
$$;

drop trigger if exists orders_auto_confirm_class on public.orders;
create trigger orders_auto_confirm_class after insert on public.orders
  for each row execute function public.auto_confirm_class();

-- ---------- 7. Negocios de ejemplo ----------
-- Marcados con demo = true. Sin dueño ni correo de avisos: no se manda nada a nadie.
-- Solo se crean si no existen; nunca se toca otro negocio.
do $$
declare
  d date := (now() at time zone 'Europe/Madrid')::date;
  img text := '?w=900&q=70&auto=format&fit=crop';
  u text := 'https://images.unsplash.com/photo-';
  c jsonb;
  i int;
  k int;
  day date;
  names text[] := array['María G.', 'Javier R.', 'Lucía M.', 'Pablo S.', 'Carmen D.', 'Álvaro T.', 'Elena F.', 'Sergio P.', 'Marta L.', 'Raúl C.', 'Irene V.', 'Diego H.'];
begin
  -- ===== Tienda de ropa =====
  if not exists (select 1 from public.businesses where username = 'demo-lucia-moda') then
    insert into public.businesses (username, name, category, telefono, address, image, cover_url, status, demo)
    values ('demo-lucia-moda', 'Lucía Moda', 'Tienda de ropa', '979 70 12 34', 'Calle Mayor 45, Palencia',
      u || '1567401893414-76b7b1e5a7a5' || img, u || '1705675451868-014a161e591b' || img, 'approved', true);
    insert into public.restaurant_settings (business_name, lunch_start, lunch_end, dinner_start, dinner_end, closed_days, tables, daily_menu, profile)
    values ('Lucía Moda', '10:00', '14:00', '17:00', '20:30', '{0}', '[]', null, jsonb_build_object(
      'onboarded', true, 'recogida', true, 'pagos', jsonb_build_array('tarjeta', 'efectivo', 'bizum'), 'prep_min', 60, 'guardar_dias', 3,
      'probador', true, 'arreglos', true, 'regalo', true, 'partido', true, 'cambios', 'Cambios y devoluciones en 30 días con el ticket.', 'stock_bajo', 2));
    insert into public.products (business_id, name, description, price, old_price, section, image_url, variants, featured, created_at) values
      ('Lucía Moda', 'Jersey de punto trenzado', 'Punto grueso de lana y algodón, cuello redondo. Muy calentito.', 49.95, 59.95, 'Mujer', u || '1574201635302-388dd92a4c3f' || img,
        '{"sizes":["S","M","L","XL"],"colors":["Crudo","Gris"],"stock":{"S|Crudo":2,"M|Crudo":4,"L|Crudo":1,"XL|Crudo":0,"S|Gris":3,"M|Gris":0,"L|Gris":2,"XL|Gris":1}}', true, now() - interval '9 day'),
      ('Lucía Moda', 'Vestido midi de flores', 'Vaporoso, con forro y cinturón a juego.', 59.90, null, 'Mujer', u || '1544586947-3e09d1a036f1' || img,
        '{"sizes":["XS","S","M","L"],"colors":[],"stock":{"XS":1,"S":3,"M":2,"L":0}}', true, now() - interval '8 day'),
      ('Lucía Moda', 'Vaqueros rectos', 'Tiro alto, denim 100 % algodón.', 45.00, null, 'Mujer', u || '1602293589930-45aad59ba3ab' || img,
        '{"sizes":["36","38","40","42","44"],"colors":[],"stock":{"36":2,"38":5,"40":4,"42":2,"44":1}}', false, now() - interval '7 day'),
      ('Lucía Moda', 'Abrigo de paño', 'Paño de lana, largo hasta la rodilla. Novedad de temporada.', 129.00, null, 'Mujer', u || '1604882767135-b41fac508fff' || img,
        '{"sizes":["S","M","L"],"colors":["Camel"],"stock":{"S|Camel":1,"M|Camel":2,"L|Camel":1}}', true, now() - interval '6 day'),
      ('Lucía Moda', 'Camisa de lino', 'Lino lavado, corte relajado.', 39.90, null, 'Hombre', u || '1605450081927-6b40c11c661f' || img,
        '{"sizes":["S","M","L","XL"],"colors":["Blanco"],"stock":{"S|Blanco":2,"M|Blanco":3,"L|Blanco":3,"XL|Blanco":1}}', false, now() - interval '5 day'),
      ('Lucía Moda', 'Polo de algodón', 'Piqué de algodón orgánico.', 29.90, 35.00, 'Hombre', u || '1625698311031-f0dd15be5144' || img,
        '{"sizes":["S","M","L","XL"],"colors":[],"stock":{"S":0,"M":4,"L":2,"XL":2}}', false, now() - interval '4 day'),
      ('Lucía Moda', 'Zapatillas de piel blancas', 'Piel lisa, suela de goma cosida.', 69.00, null, 'Calzado', u || '1600269452121-4f2416e55c28' || img,
        '{"sizes":["36","37","38","39","40","41"],"colors":[],"stock":{"36":1,"37":2,"38":2,"39":3,"40":1,"41":0}}', false, now() - interval '3 day'),
      ('Lucía Moda', 'Bolso de piel', 'Piel curtida en España, asa larga regulable.', 79.00, null, 'Complementos', u || '1598532163257-ae3c6b2524b6' || img,
        null, false, now() - interval '2 day');
    update public.products set stock = 3 where business_id = 'Lucía Moda' and name = 'Bolso de piel';

    insert into public.orders (business_name, customer, phone, items, total, date, time, status, source, lines, pickup_code, payment, created_at) values
      ('Lucía Moda', 'Carmen D.', '600 11 22 33', 'Pedido para recoger: 1x Jersey de punto trenzado (M · Crudo), 1x Vaqueros rectos (38)', 94.95, d::text, '18:00', 'Pedido Recibido', 'app',
        '[{"name":"Jersey de punto trenzado","qty":1,"variant":"M|Crudo","price":49.95},{"name":"Vaqueros rectos","qty":1,"variant":"38","price":45}]', '4821', 'tarjeta', now() - interval '25 min'),
      ('Lucía Moda', 'Elena F.', '600 44 55 66', 'Pedido para recoger: 1x Vestido midi de flores (S)', 59.90, d::text, '12:30', 'Preparando', 'app',
        '[{"name":"Vestido midi de flores","qty":1,"variant":"S","price":59.9}]', '1307', 'efectivo', now() - interval '3 hour'),
      ('Lucía Moda', 'Pablo S.', '600 77 88 99', 'Pedido para recoger: 1x Camisa de lino (L · Blanco), 1x Polo de algodón (L)', 69.80, d::text, '11:00', 'Listo para recoger', 'app',
        '[{"name":"Camisa de lino","qty":1,"variant":"L|Blanco","price":39.9},{"name":"Polo de algodón","qty":1,"variant":"L","price":29.9}]', '5590', 'bizum', now() - interval '1 day'),
      ('Lucía Moda', 'Irene V.', null, 'Pedido para recoger: 1x Abrigo de paño (M · Camel)', 129.00, (d - 2)::text, '19:00', 'Recogido', 'app',
        '[{"name":"Abrigo de paño","qty":1,"variant":"M|Camel","price":129}]', '7734', 'tarjeta', now() - interval '3 day'),
      ('Lucía Moda', 'Marta L.', null, 'Pedido para recoger: 1x Bolso de piel', 79.00, (d - 5)::text, '13:00', 'Recogido', 'app',
        '[{"name":"Bolso de piel","qty":1,"variant":null,"price":79}]', '2210', 'efectivo', now() - interval '6 day');
  end if;

  -- ===== Panadería =====
  if not exists (select 1 from public.businesses where username = 'demo-horno-san-lazaro') then
    insert into public.businesses (username, name, category, telefono, address, image, cover_url, status, demo)
    values ('demo-horno-san-lazaro', 'Horno San Lázaro', 'Panadería y pastelería', '979 74 56 78', 'Calle San Lázaro 12, Palencia',
      u || '1608198093002-ad4e005484ec' || img, u || '1568254183919-78a4f43a2877' || img, 'approved', true);
    insert into public.restaurant_settings (business_name, lunch_start, lunch_end, dinner_start, dinner_end, closed_days, tables, daily_menu, profile)
    values ('Horno San Lázaro', '07:30', '14:30', '17:30', '20:30', '{}', '[]', null, jsonb_build_object(
      'onboarded', true, 'recogida', true, 'pagos', jsonb_build_array('tarjeta', 'efectivo'), 'prep_min', 15, 'stock_bajo', 5,
      'hornadas', jsonb_build_array(jsonb_build_object('time', '07:30', 'label', 'Pan del día'), jsonb_build_object('time', '12:00', 'label', 'Pan y empanadas'), jsonb_build_object('time', '18:30', 'label', 'Pan de tarde')),
      'masa_madre', true, 'sin_gluten', true, 'obrador_propio', true, 'encargos', true, 'partido', true, 'stock_dia', d::text));
    insert into public.products (business_id, name, description, price, section, image_url, stock, daily_qty, sold_out, preorder_days, unit, featured, created_at) values
      ('Horno San Lázaro', 'Barra de pan', 'La de siempre, de leña.', 0.90, 'Pan', u || '1554475659-9fd915c8f156' || img, 34, 80, false, 0, 'ud', true, now() - interval '9 day'),
      ('Horno San Lázaro', 'Hogaza de masa madre', '24 horas de fermentación. 800 g.', 3.50, 'Pan', u || '1608198093002-ad4e005484ec' || img, 6, 15, false, 0, 'ud', true, now() - interval '8 day'),
      ('Horno San Lázaro', 'Pan integral de semillas', 'Centeno, pipas, lino y sésamo.', 2.80, 'Pan', u || '1599819055803-717bba43890f' || img, 0, 10, true, 0, 'ud', false, now() - interval '7 day'),
      ('Horno San Lázaro', 'Croissant de mantequilla', 'Hojaldrado a mano con mantequilla.', 1.40, 'Bollería', u || '1623334044303-241021148842' || img, 18, 40, false, 0, 'ud', true, now() - interval '6 day'),
      ('Horno San Lázaro', 'Napolitana de chocolate', 'Rellena de chocolate negro.', 1.50, 'Bollería', u || '1530610476181-d83430b64dcd' || img, 3, 30, false, 0, 'ud', false, now() - interval '5 day'),
      ('Horno San Lázaro', 'Magdalenas caseras', 'Bolsa de 6, con aceite de oliva.', 3.20, 'Bollería', u || '1563729784474-d77dbb933a9e' || img, 9, 20, false, 0, 'bolsa', false, now() - interval '4 day'),
      ('Horno San Lázaro', 'Amarguillos de Palencia', 'El dulce de almendra de toda la vida. Caja de 12.', 6.50, 'Dulces de aquí', u || '1583338917451-face2751d8d5' || img, 12, 12, false, 0, 'caja', true, now() - interval '3 day'),
      ('Horno San Lázaro', 'Tarta de fresa y nata', 'Bizcocho, nata fresca y fresas. 8 raciones.', 22.00, 'Tartas por encargo', u || '1568827999250-3f6afff96e66' || img, null, null, false, 1, 'ud', false, now() - interval '2 day'),
      ('Horno San Lázaro', 'Tarta de chocolate', 'Tres chocolates. 8 raciones. Te escribimos el nombre.', 24.00, 'Tartas por encargo', u || '1606890737304-57a1ca8a5b62' || img, null, null, false, 1, 'ud', false, now() - interval '1 day');
    insert into public.orders (business_name, customer, phone, items, total, date, time, status, source, lines, pickup_code, payment, note, created_at) values
      ('Horno San Lázaro', 'Javier R.', '600 12 34 56', 'Pedido para recoger: 2x Barra de pan, 4x Croissant de mantequilla', 7.40, d::text, '09:15', 'Pedido Recibido', 'app',
        '[{"name":"Barra de pan","qty":2,"price":0.9},{"name":"Croissant de mantequilla","qty":4,"price":1.4}]', '3391', 'efectivo', null, now() - interval '15 min'),
      ('Horno San Lázaro', 'Lucía M.', '600 65 43 21', 'Pedido para recoger: 1x Tarta de chocolate · Nota: Que ponga "Felicidades Ana"', 24.00, (d + 1)::text, '17:30', 'Preparando', 'app',
        '[{"name":"Tarta de chocolate","qty":1,"price":24}]', '8812', 'tarjeta', 'Que ponga "Felicidades Ana"', now() - interval '5 hour'),
      ('Horno San Lázaro', 'Álvaro T.', null, 'Pedido para recoger: 1x Hogaza de masa madre, 1x Amarguillos de Palencia', 10.00, d::text, '13:00', 'Listo para recoger', 'app',
        '[{"name":"Hogaza de masa madre","qty":1,"price":3.5},{"name":"Amarguillos de Palencia","qty":1,"price":6.5}]', '6040', 'tarjeta', null, now() - interval '2 hour'),
      ('Horno San Lázaro', 'Carmen D.', null, 'Pedido para recoger: 3x Barra de pan', 2.70, (d - 1)::text, '08:30', 'Recogido', 'app',
        '[{"name":"Barra de pan","qty":3,"price":0.9}]', '1188', 'efectivo', null, now() - interval '1 day');
  end if;

  -- ===== Carnicería =====
  if not exists (select 1 from public.businesses where username = 'demo-carniceria-pastor') then
    insert into public.businesses (username, name, category, telefono, address, image, cover_url, status, demo)
    values ('demo-carniceria-pastor', 'Carnicería Hermanos Pastor', 'Carnicería y charcutería', '979 72 33 44', 'Mercado de Abastos, puesto 8, Palencia',
      u || '1602470521007-20293bd1fd31' || img, u || '1784807739590-ddb4704d30dc' || img, 'approved', true);
    insert into public.restaurant_settings (business_name, lunch_start, lunch_end, dinner_start, dinner_end, closed_days, tables, daily_menu, profile)
    values ('Carnicería Hermanos Pastor', '09:00', '14:00', '17:30', '20:00', '{0}', '[]', null, jsonb_build_object(
      'onboarded', true, 'recogida', true, 'pagos', jsonb_build_array('tarjeta', 'efectivo'), 'prep_min', 30, 'stock_bajo', 2,
      'peso_aviso', true, 'producto_local', true, 'elaboracion_propia', true, 'envasado', true, 'partido', true));
    insert into public.products (business_id, name, description, price, section, image_url, stock, preorder_days, unit, featured, created_at) values
      ('Carnicería Hermanos Pastor', 'Chuletillas de lechazo', 'Lechazo churro con IGP Castilla y León.', 24.90, 'Lechazo', u || '1602470521007-20293bd1fd31' || img, null, 0, 'kg', true, now() - interval '6 day'),
      ('Carnicería Hermanos Pastor', 'Lechazo entero para asar', 'Pieza de unos 10 kg, troceado como lo quieras. Precio orientativo.', 220.00, 'Lechazo', u || '1767491654834-13bf58ed9522' || img, null, 2, 'pieza', true, now() - interval '5 day'),
      ('Carnicería Hermanos Pastor', 'Filetes de ternera', 'Ternera de la montaña palentina.', 16.90, 'Vacuno', u || '1606677661991-446cea8ee182' || img, null, 0, 'kg', false, now() - interval '4 day'),
      ('Carnicería Hermanos Pastor', 'Hamburguesas caseras', 'Pack de 4, vacuno y cerdo ibérico.', 6.00, 'Elaborados', u || '1597417321971-45e034f7a993' || img, 8, 0, 'pack', false, now() - interval '3 day'),
      ('Carnicería Hermanos Pastor', 'Chorizo de la casa', 'Curado en nuestra bodega, dulce o picante.', 14.90, 'Embutido', u || '1624772398061-bbfa87ec6b5a' || img, null, 0, 'kg', false, now() - interval '2 day'),
      ('Carnicería Hermanos Pastor', 'Morcilla de arroz', 'Hecha aquí cada jueves.', 9.50, 'Embutido', u || '1688895061981-4f7b10d4e4da' || img, 0, 0, 'kg', false, now() - interval '1 day');
    update public.products set sold_out = true where business_id = 'Carnicería Hermanos Pastor' and name = 'Morcilla de arroz';
    insert into public.orders (business_name, customer, phone, items, total, date, time, status, source, lines, pickup_code, payment, note, created_at) values
      ('Carnicería Hermanos Pastor', 'Sergio P.', '600 98 76 54', 'Pedido para recoger: 1x Lechazo entero para asar · Nota: Troceado en cuartos', 220.00, (d + 3)::text, '12:00', 'Pedido Recibido', 'app',
        '[{"name":"Lechazo entero para asar","qty":1,"price":220,"unit":"pieza"}]', '9021', 'tarjeta', 'Troceado en cuartos', now() - interval '40 min'),
      ('Carnicería Hermanos Pastor', 'María G.', null, 'Pedido para recoger: 1x Chuletillas de lechazo, 2x Hamburguesas caseras', 36.90, d::text, '13:30', 'Preparando', 'app',
        '[{"name":"Chuletillas de lechazo","qty":1,"price":24.9,"unit":"kg"},{"name":"Hamburguesas caseras","qty":2,"price":6,"unit":"pack"}]', '4470', 'efectivo', null, now() - interval '2 hour');
  end if;

  -- ===== Floristería =====
  if not exists (select 1 from public.businesses where username = 'demo-flores-carrion') then
    insert into public.businesses (username, name, category, telefono, address, image, cover_url, status, demo)
    values ('demo-flores-carrion', 'Flores del Carrión', 'Floristería', '979 75 10 20', 'Calle Don Sancho 6, Palencia',
      u || '1564046710162-5959a502ffe6' || img, u || '1487070183336-b863922373d4' || img, 'approved', true);
    insert into public.restaurant_settings (business_name, lunch_start, lunch_end, dinner_start, dinner_end, closed_days, tables, daily_menu, profile)
    values ('Flores del Carrión', '09:30', '14:00', '17:00', '20:30', '{0}', '[]', null, jsonb_build_object(
      'onboarded', true, 'recogida', true, 'pagos', jsonb_build_array('tarjeta', 'efectivo', 'bizum'), 'prep_min', 60, 'tarjeta_dedicatoria', true, 'bodas', true, 'plantas', true, 'funeraria', true, 'partido', true, 'envio_interes', true, 'envio_zona', 'ciudad'));
    insert into public.products (business_id, name, description, price, section, image_url, stock, preorder_days, featured, created_at) values
      ('Flores del Carrión', 'Centro para Todos los Santos', 'Crisantemos y flor de temporada. Encárgalo antes del 30 de octubre.', 45.00, 'Todos los Santos', u || '1531120364508-a6b656c3e78d' || img, null, 1, true, now() - interval '7 day'),
      ('Flores del Carrión', 'Ramo de 12 rosas rojas', 'Rosa de tallo largo con verde y papel kraft.', 35.00, 'Ramos', u || '1487530811176-3780de880c2d' || img, 6, 0, true, now() - interval '6 day'),
      ('Flores del Carrión', 'Ramo silvestre de temporada', 'Lo que mejor esté hoy en la tienda.', 25.00, 'Ramos', u || '1523694576729-dc99e9c0f9b4' || img, 4, 0, false, now() - interval '5 day'),
      ('Flores del Carrión', 'Claveles en jarrón', 'Con jarrón de cristal incluido.', 18.00, 'Ramos', u || '1497276236755-0f85ba99a126' || img, 3, 0, false, now() - interval '4 day'),
      ('Flores del Carrión', 'Ramo de flores secas', 'Dura meses. Tonos melocotón.', 22.00, 'Ramos', u || '1622658641558-235f26dd270b' || img, 5, 0, false, now() - interval '3 day'),
      ('Flores del Carrión', 'Centro de mesa', 'Para comidas y celebraciones.', 30.00, 'Eventos', u || '1561181286-d3fee7d55364' || img, null, 1, false, now() - interval '2 day'),
      ('Flores del Carrión', 'Ramo de novia', 'Lo diseñamos contigo. Señal en tienda.', 90.00, 'Eventos', u || '1521543832500-49e69fb2bea2' || img, null, 7, false, now() - interval '1 day');
    insert into public.orders (business_name, customer, phone, items, total, date, time, status, source, lines, pickup_code, payment, note, created_at) values
      ('Flores del Carrión', 'Raúl C.', '600 33 22 11', 'Pedido para recoger: 2x Centro para Todos los Santos', 90.00, (d + 2)::text, '10:30', 'Pedido Recibido', 'app',
        '[{"name":"Centro para Todos los Santos","qty":2,"price":45}]', '6158', 'tarjeta', null, now() - interval '1 hour'),
      ('Flores del Carrión', 'Elena F.', null, 'Pedido para recoger: 1x Ramo de 12 rosas rojas · Nota: Tarjeta: "Te quiero, Luis"', 35.00, d::text, '19:30', 'Preparando', 'app',
        '[{"name":"Ramo de 12 rosas rojas","qty":1,"price":35}]', '2903', 'bizum', 'Tarjeta: "Te quiero, Luis"', now() - interval '4 hour');
  end if;

  -- ===== Barbería =====
  if not exists (select 1 from public.businesses where username = 'demo-barberia-la-mayor') then
    insert into public.businesses (username, name, category, telefono, address, image, cover_url, status, demo)
    values ('demo-barberia-la-mayor', 'Barbería La Mayor', 'Barbería', '979 71 98 76', 'Calle Mayor 102, Palencia',
      u || '1621605815971-fbc98d665033' || img, u || '1503951914875-452162b0f3f1' || img, 'approved', true);
    insert into public.restaurant_settings (business_name, lunch_start, lunch_end, dinner_start, dinner_end, closed_days, tables, daily_menu, staff, profile)
    values ('Barbería La Mayor', '10:00', '14:00', '16:30', '20:30', '{0,1}', '[]', null, '[{"name":"Rubén"},{"name":"Óscar"}]', jsonb_build_object('onboarded', true, 'partido', true, 'sin_cita', true, 'ninos', true, 'pagos', jsonb_build_array('tarjeta', 'efectivo')));
    insert into public.products (business_id, name, description, price, section, duration_min, extra_long_min, price_from, created_at) values
      ('Barbería La Mayor', 'Corte de pelo', 'Lavado, corte y peinado.', 14, 'Cortes', 30, 0, false, now() - interval '5 day'),
      ('Barbería La Mayor', 'Corte + barba', 'El combo de siempre.', 20, 'Cortes', 45, 0, false, now() - interval '4 day'),
      ('Barbería La Mayor', 'Corte infantil', 'Hasta 12 años.', 10, 'Cortes', 20, 0, false, now() - interval '3 day'),
      ('Barbería La Mayor', 'Arreglo de barba', 'Perfilado y aceite.', 9, 'Barba', 20, 0, false, now() - interval '2 day'),
      ('Barbería La Mayor', 'Afeitado clásico a navaja', 'Toalla caliente y bálsamo.', 15, 'Barba', 30, 0, false, now() - interval '1 day');
    insert into public.orders (business_name, customer, phone, items, total, date, time, status, source, created_at) values
      ('Barbería La Mayor', 'Diego H.', '600 10 20 30', 'Reserva cita: Corte + barba (45 min) · con Rubén', 20, d::text, '10:30 - 11:15', 'Mesa Confirmada', 'app', now() - interval '1 day'),
      ('Barbería La Mayor', 'Pablo S.', null, 'Reserva cita: Corte de pelo (30 min) · con Óscar', 14, d::text, '12:00 - 12:30', 'Mesa Confirmada', 'app', now() - interval '5 hour'),
      ('Barbería La Mayor', 'Álvaro T.', '600 40 50 60', 'Reserva cita: Afeitado clásico a navaja (30 min) · con Rubén', 15, d::text, '17:00 - 17:30', 'Pendiente de Aprobación', 'app', now() - interval '20 min'),
      ('Barbería La Mayor', 'Sergio P.', null, 'Reserva cita: Corte infantil + Corte de pelo (50 min) · con Óscar', 24, (d + 1)::text, '18:00 - 18:50', 'Pendiente de Aprobación', 'app', now() - interval '2 hour');
  end if;

  -- ===== Estética =====
  if not exists (select 1 from public.businesses where username = 'demo-alba-estetica') then
    insert into public.businesses (username, name, category, telefono, address, image, cover_url, status, demo)
    values ('demo-alba-estetica', 'Alba Estética y Uñas', 'Estética y uñas', '979 70 55 66', 'Avenida Manuel Rivera 9, Palencia',
      u || '1519824145371-296894a0daa9' || img, u || '1519823551278-64ac92734fb1' || img, 'approved', true);
    insert into public.restaurant_settings (business_name, lunch_start, lunch_end, dinner_start, dinner_end, closed_days, tables, daily_menu, staff, profile)
    values ('Alba Estética y Uñas', '10:00', '14:00', '16:00', '20:00', '{0}', '[]', null, '[{"name":"Alba"},{"name":"Noelia"}]', jsonb_build_object('onboarded', true, 'partido', true, 'bonos', true, 'regalo', true, 'pagos', jsonb_build_array('tarjeta', 'efectivo', 'bizum')));
    insert into public.products (business_id, name, description, price, section, duration_min, price_from, created_at) values
      ('Alba Estética y Uñas', 'Manicura semipermanente', 'Esmaltado que dura 3 semanas.', 20, 'Uñas', 45, false, now() - interval '6 day'),
      ('Alba Estética y Uñas', 'Pedicura completa', 'Con esmaltado normal.', 28, 'Uñas', 60, false, now() - interval '5 day'),
      ('Alba Estética y Uñas', 'Limpieza facial profunda', 'Extracción, mascarilla e hidratación.', 40, 'Facial', 60, false, now() - interval '4 day'),
      ('Alba Estética y Uñas', 'Lifting de pestañas', 'Con tinte incluido.', 35, 'Facial', 60, false, now() - interval '3 day'),
      ('Alba Estética y Uñas', 'Depilación piernas enteras', 'Cera tibia.', 22, 'Depilación', 40, false, now() - interval '2 day'),
      ('Alba Estética y Uñas', 'Masaje relajante', 'Espalda, cuello y piernas.', 35, 'Masajes', 50, true, now() - interval '1 day');
    insert into public.orders (business_name, customer, phone, items, total, date, time, status, source, created_at) values
      ('Alba Estética y Uñas', 'Marta L.', '600 21 21 21', 'Reserva cita: Manicura semipermanente (45 min) · con Noelia', 20, d::text, '11:00 - 11:45', 'Mesa Confirmada', 'app', now() - interval '1 day'),
      ('Alba Estética y Uñas', 'Irene V.', null, 'Reserva cita: Limpieza facial profunda (1 h) · con Alba · Nota: Piel sensible', 40, (d + 1)::text, '17:00 - 18:00', 'Pendiente de Aprobación', 'app', now() - interval '1 hour');
  end if;

  -- ===== Fisioterapia =====
  if not exists (select 1 from public.businesses where username = 'demo-fisiocarrion') then
    insert into public.businesses (username, name, category, telefono, address, image, cover_url, status, demo)
    values ('demo-fisiocarrion', 'FisioCarrión', 'Fisioterapia', '979 73 40 50', 'Calle Los Soldados 4, Palencia',
      u || '1540205895360-4ad4cffb3aa8' || img, u || '1645005512968-0c1fe99f0093' || img, 'approved', true);
    insert into public.restaurant_settings (business_name, lunch_start, lunch_end, dinner_start, dinner_end, closed_days, tables, daily_menu, staff, profile)
    values ('FisioCarrión', '09:00', '14:00', '16:00', '21:00', '{0,6}', '[]', null, '[{"name":"Laura"},{"name":"Diego"}]', jsonb_build_object('onboarded', true, 'pagos', jsonb_build_array('tarjeta', 'efectivo', 'bizum'), 'mutuas', true, 'factura', true, 'partido', true));
    insert into public.products (business_id, name, description, price, section, duration_min, price_from, created_at) values
      ('FisioCarrión', 'Sesión de fisioterapia', 'Valoración y tratamiento.', 35, 'Fisioterapia', 50, false, now() - interval '5 day'),
      ('FisioCarrión', 'Punción seca', 'Para contracturas y puntos gatillo.', 40, 'Fisioterapia', 45, false, now() - interval '4 day'),
      ('FisioCarrión', 'Fisioterapia deportiva', 'Lesiones, readaptación y vendaje.', 40, 'Deporte', 60, false, now() - interval '3 day'),
      ('FisioCarrión', 'Masaje descontracturante', 'Espalda y cervicales.', 30, 'Masaje', 45, false, now() - interval '2 day'),
      ('FisioCarrión', 'Suelo pélvico', 'Primera visita con valoración.', 45, 'Especialidades', 60, false, now() - interval '1 day');
    insert into public.orders (business_name, customer, phone, items, total, date, time, status, source, created_at) values
      ('FisioCarrión', 'Javier R.', '600 31 31 31', 'Reserva cita: Fisioterapia deportiva (1 h) · con Diego · Nota: Esguince de tobillo', 40, d::text, '18:00 - 19:00', 'Mesa Confirmada', 'app', now() - interval '2 day'),
      ('FisioCarrión', 'Carmen D.', null, 'Reserva cita: Sesión de fisioterapia (50 min) · con Laura', 35, (d + 1)::text, '10:00 - 10:50', 'Pendiente de Aprobación', 'app', now() - interval '30 min');
  end if;

  -- ===== Taller =====
  if not exists (select 1 from public.businesses where username = 'demo-talleres-villamuriel') then
    insert into public.businesses (username, name, category, telefono, address, image, cover_url, status, demo)
    values ('demo-talleres-villamuriel', 'Talleres Villamuriel', 'Taller mecánico', '979 77 60 70', 'Polígono Nuestra Señora de los Ángeles, nave 14, Palencia',
      u || '1619642751034-765dfdf7c58e' || img, u || '1625047509248-ec889cbff17f' || img, 'approved', true);
    insert into public.restaurant_settings (business_name, lunch_start, lunch_end, dinner_start, dinner_end, closed_days, tables, daily_menu, staff, profile)
    values ('Talleres Villamuriel', '08:30', '13:30', '15:30', '19:00', '{0,6}', '[]', null, '[{"name":"Elevador 1"},{"name":"Elevador 2"}]', jsonb_build_object('onboarded', true, 'pagos', jsonb_build_array('tarjeta', 'efectivo'), 'coche_sustitucion', true, 'recogida_coche', true, 'presupuesto', true, 'partido', true));
    insert into public.products (business_id, name, description, price, section, duration_min, price_from, created_at) values
      ('Talleres Villamuriel', 'Cambio de aceite y filtro', 'Aceite según fabricante. Revisamos niveles gratis.', 59, 'Mantenimiento', 60, true, now() - interval '6 day'),
      ('Talleres Villamuriel', 'Pre-ITV', 'Lo revisamos todo para que pases a la primera.', 30, 'Mantenimiento', 45, false, now() - interval '5 day'),
      ('Talleres Villamuriel', 'Cambio de neumáticos', 'Montaje, equilibrado y válvulas. Neumático aparte.', 25, 'Ruedas', 45, true, now() - interval '4 day'),
      ('Talleres Villamuriel', 'Revisión de frenos', 'Pastillas, discos y líquido.', 0, 'Mantenimiento', 60, false, now() - interval '3 day'),
      ('Talleres Villamuriel', 'Diagnosis electrónica', 'Si te ha salido un testigo en el cuadro.', 35, 'Averías', 30, false, now() - interval '2 day'),
      ('Talleres Villamuriel', 'Carga de aire acondicionado', 'Con revisión de fugas.', 49, 'Climatización', 60, false, now() - interval '1 day');
    insert into public.orders (business_name, customer, phone, items, total, date, time, status, source, created_at) values
      ('Talleres Villamuriel', 'Raúl C.', '600 51 51 51', 'Reserva cita: Cambio de aceite y filtro (1 h) · con Elevador 1 · Nota: Seat León 2017, 1234 KLM', 59, d::text, '09:00 - 10:00', 'Mesa Confirmada', 'app', now() - interval '2 day'),
      ('Talleres Villamuriel', 'Elena F.', '600 61 61 61', 'Reserva cita: Pre-ITV (45 min) · con Elevador 2 · Nota: Citroën C3, ITV el día 5', 30, (d + 1)::text, '16:00 - 16:45', 'Pendiente de Aprobación', 'app', now() - interval '1 hour');
  end if;

  -- ===== Yoga y pilates (clases) =====
  if not exists (select 1 from public.businesses where username = 'demo-estudio-om') then
    insert into public.businesses (username, name, category, telefono, address, image, cover_url, status, demo)
    values ('demo-estudio-om', 'Estudio Om Palencia', 'Yoga y pilates', '979 76 80 90', 'Calle Colón 21, Palencia',
      u || '1506126613408-eca07ce68773' || img, u || '1687783615494-b4a1f1af8b58' || img, 'approved', true);
    insert into public.restaurant_settings (business_name, lunch_start, lunch_end, dinner_start, dinner_end, closed_days, tables, daily_menu, profile)
    values ('Estudio Om Palencia', '09:00', '13:00', '17:00', '21:30', '{0}', '[]', null, jsonb_build_object(
      'onboarded', true, 'pagos', jsonb_build_array('tarjeta', 'efectivo', 'bizum'), 'primera_gratis', true, 'cancelar_horas', 4, 'esterillas', true, 'duchas', true, 'partido', true,
      'clases', jsonb_build_array(
        jsonb_build_object('id', 'hatha-m', 'name', 'Hatha yoga', 'days', jsonb_build_array(1, 3), 'time', '09:30', 'min', 60, 'plazas', 12, 'teacher', 'Marta', 'level', 'Todos los niveles'),
        jsonb_build_object('id', 'vinyasa', 'name', 'Vinyasa', 'days', jsonb_build_array(1, 3), 'time', '19:00', 'min', 60, 'plazas', 14, 'teacher', 'Marta', 'level', 'Intermedio'),
        jsonb_build_object('id', 'pilates-m', 'name', 'Pilates', 'days', jsonb_build_array(2, 4), 'time', '10:00', 'min', 50, 'plazas', 10, 'teacher', 'Sara', 'level', 'Todos los niveles'),
        jsonb_build_object('id', 'pilates-t', 'name', 'Pilates', 'days', jsonb_build_array(2, 4), 'time', '19:30', 'min', 50, 'plazas', 10, 'teacher', 'Sara', 'level', 'Todos los niveles'),
        jsonb_build_object('id', 'suave', 'name', 'Yoga suave', 'days', jsonb_build_array(5), 'time', '11:00', 'min', 60, 'plazas', 12, 'teacher', 'Marta', 'level', 'Mayores y principiantes'),
        jsonb_build_object('id', 'familia', 'name', 'Yoga en familia', 'days', jsonb_build_array(6), 'time', '11:00', 'min', 45, 'plazas', 8, 'teacher', 'Sara', 'level', 'Con niños de 4 a 10 años'),
        jsonb_build_object('id', 'medita', 'name', 'Meditación', 'days', jsonb_build_array(1, 2, 3, 4, 5), 'time', '20:30', 'min', 30, 'plazas', 16, 'teacher', 'Marta', 'level', 'Todos los niveles'))));
    insert into public.products (business_id, name, description, price, section, created_at) values
      ('Estudio Om Palencia', 'Clase suelta', 'La primera es gratis.', 10, 'Tarifas', now() - interval '3 day'),
      ('Estudio Om Palencia', 'Bono 8 clases', 'Caduca a los 2 meses.', 64, 'Tarifas', now() - interval '2 day'),
      ('Estudio Om Palencia', 'Mensual ilimitado', 'Todas las clases que quieras.', 55, 'Tarifas', now() - interval '1 day');
    -- Gente apuntada esta semana.
    select profile -> 'clases' into c from public.restaurant_settings where business_name = 'Estudio Om Palencia';
    for k in 0..6 loop
      day := d + k;
      for i in 0..jsonb_array_length(c) - 1 loop
        if (c -> i -> 'days') @> to_jsonb(extract(dow from day)::int) then
          insert into public.orders (business_name, customer, items, total, date, time, status, source, created_at)
          select 'Estudio Om Palencia', names[1 + (n + k + i) % 12],
            'Reserva clase: ' || (c -> i ->> 'name') || ' · con ' || (c -> i ->> 'teacher') || ' · 1 plaza', 0, day::text,
            (c -> i ->> 'time') || ' - ' || to_char(((c -> i ->> 'time')::time + make_interval(mins => (c -> i ->> 'min')::int)), 'HH24:MI'),
            'Mesa Confirmada', 'app', now() - interval '1 day'
          from generate_series(1, greatest(2, ((c -> i ->> 'plazas')::int * (3 + (k + i) % 6)) / 9)) n;
        end if;
      end loop;
    end loop;
  end if;

  -- ===== Taxi =====
  if not exists (select 1 from public.businesses where username = 'demo-taxi-javier') then
    insert into public.businesses (username, name, category, telefono, address, image, cover_url, status, demo)
    values ('demo-taxi-javier', 'Taxi Javier Palencia', 'Taxi', '639 12 34 56', 'Parada de la Estación de tren, Palencia',
      u || '1556122071-e404eaedb77f' || img, u || '1593950315186-76a92975b60c' || img, 'approved', true);
    insert into public.restaurant_settings (business_name, lunch_start, lunch_end, dinner_start, dinner_end, closed_days, tables, daily_menu, profile)
    values ('Taxi Javier Palencia', '06:00', '15:00', '15:00', '23:59', '{}', '[]', null, jsonb_build_object(
      'onboarded', true, 'pagos', jsonb_build_array('tarjeta', 'efectivo', 'bizum'), 'plazas', 4, 'adaptado', false, 'maletero', true, 'mascotas', true, 'largas', true, 'aviso_min', 30));
    insert into public.products (business_id, name, description, price, section, price_from, created_at) values
      ('Taxi Javier Palencia', 'Dentro de Palencia', 'Bajada de bandera y taxímetro.', 5, 'Precios orientativos', true, now() - interval '5 day'),
      ('Taxi Javier Palencia', 'Estación de tren o autobuses', 'A cualquier punto de la ciudad.', 6, 'Precios orientativos', true, now() - interval '4 day'),
      ('Taxi Javier Palencia', 'Hospital Río Carrión', 'Desde el centro.', 7, 'Precios orientativos', true, now() - interval '3 day'),
      ('Taxi Javier Palencia', 'Aeropuerto de Valladolid', 'Precio cerrado, hasta 4 personas con maletas.', 75, 'Viajes largos', false, now() - interval '2 day'),
      ('Taxi Javier Palencia', 'Madrid (Barajas o Chamartín)', 'Precio cerrado.', 260, 'Viajes largos', false, now() - interval '1 day');
    insert into public.orders (business_name, customer, phone, items, total, date, time, status, source, created_at) values
      ('Taxi Javier Palencia', 'Carmen D.', '600 71 71 71', 'Reserva taxi: Calle Mayor 30 → Estación de tren · 2 pers. · Con maletas', 0, d::text, '17:40 - 18:10', 'Mesa Confirmada', 'app', now() - interval '6 hour'),
      ('Taxi Javier Palencia', 'Diego H.', '600 81 81 81', 'Reserva taxi: Avda. de Madrid 12 → Aeropuerto de Valladolid · 3 pers. · Con maletas · Nota: Vuelo a las 10:20', 75, (d + 1)::text, '07:30 - 08:30', 'Pendiente de Aprobación', 'app', now() - interval '45 min');
  end if;
end $$;
