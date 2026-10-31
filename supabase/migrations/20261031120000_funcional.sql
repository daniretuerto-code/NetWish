-- NetWish "totalmente funcional" (31/10/2026).

-- ---------- 1. Hygiene: owner-only functions are not for anonymous visitors ----------
-- They already return nothing to non-owners; this also takes them off the anonymous API.
revoke execute on function public.claim_reminders(text) from anon, public;
revoke execute on function public.claim_review_requests(text) from anon, public;
revoke execute on function public.expire_pending(text) from anon, public;
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.claim_reminders(text) to authenticated;
grant execute on function public.claim_review_requests(text) to authenticated;
grant execute on function public.expire_pending(text) to authenticated;
grant execute on function public.is_admin() to authenticated;
-- Trigger functions can't be called through the API anyway; don't list them there.
do $$
declare f text;
begin
  foreach f in array array['auto_confirm_booking()', 'auto_confirm_class()', 'free_slot_for_waitlist()', 'pickup_restock()'] loop
    begin
      execute format('revoke execute on function public.%s from anon, authenticated, public', f);
    exception when undefined_function then null;
    end;
  end loop;
end $$;

-- ---------- 2. Delete my account (RGPD) ----------
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if v_uid is null then raise exception 'Inicia sesión'; end if;
  if exists (select 1 from public.businesses where owner_id = v_uid) then
    raise exception 'Tu cuenta lleva un negocio. Escríbenos para darlo de baja primero.';
  end if;
  -- Bookings stay with the business (its records), without who made them.
  update public.orders set customer = 'Cliente (cuenta borrada)', customer_email = null, phone = null, customer_id = null,
    note = null, rating_comment = null
  where customer_id = v_uid or (v_email is not null and lower(customer_email) = v_email);
  delete from public.messages where customer_id = v_uid;
  delete from public.waitlist where v_email is not null and lower(email) = v_email;
  delete from public.customer_notes where v_email is not null and customer_key = 'mail:' || v_email;
  delete from auth.users where id = v_uid;
end;
$$;
revoke execute on function public.delete_my_account() from anon, public;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- 3. Bookings made without an account join the account with that e-mail ----------
create or replace function public.claim_my_guest_bookings()
returns int
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_n int;
begin
  if auth.uid() is null then return 0; end if;
  -- Only a confirmed e-mail proves the bookings are yours.
  if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then return 0; end if;
  update public.orders set customer_id = auth.uid()
  where customer_id is null and customer_email is not null and lower(customer_email) = lower(auth.jwt() ->> 'email');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.claim_my_guest_bookings() from anon, public;
grant execute on function public.claim_my_guest_bookings() to authenticated;

-- ---------- 4. Public rating of each place (from the survey after the visit) ----------
create or replace function public.business_ratings()
returns table (business_name text, rating numeric, reviews int)
language sql stable security definer set search_path = public
as $$
  select min(o.business_name), round(avg(o.rating)::numeric, 1), count(*)::int
  from public.orders o
  where o.rating is not null
  group by lower(trim(o.business_name))
  having count(*) >= 3;
$$;
grant execute on function public.business_ratings() to anon, authenticated;

-- Last written comments (4 and 5 stars, first name only) for the business page.
create or replace function public.business_reviews(p_business text)
returns table (name text, rating smallint, comment text, date text)
language sql stable security definer set search_path = public
as $$
  select split_part(btrim(o.customer), ' ', 1), o.rating, o.rating_comment, o.date
  from public.orders o
  where lower(trim(o.business_name)) = lower(trim(p_business))
    and o.rating >= 4 and length(btrim(coalesce(o.rating_comment, ''))) >= 8
  order by o.rated_at desc nulls last
  limit 6;
$$;
grant execute on function public.business_reviews(text) to anon, authenticated;

-- ---------- 5. Allergens on the menu (the 14 of EU Regulation 1169/2011) ----------
alter table public.products add column if not exists allergens text[] not null default '{}';

-- ---------- 6. Where each booking came from (Instagram, Google, QR, own web…) ----------
alter table public.orders add column if not exists channel text;
create or replace function public.tag_order_channel(p_order uuid, p_channel text)
returns void
language sql security definer set search_path = public
as $$
  update public.orders set channel = left(lower(btrim(p_channel)), 30)
  where id = p_order and channel is null and created_at > now() - interval '15 minutes'
    and p_channel ~ '^[a-z0-9_-]{2,30}$';
$$;
grant execute on function public.tag_order_channel(uuid, text) to anon, authenticated;

-- ---------- 7. Every business has an e-mail for its notices ----------
create or replace function public.fill_notification_email()
returns trigger
language plpgsql security definer set search_path = public, auth
as $$
begin
  if nullif(btrim(coalesce(new.notification_email, '')), '') is null and new.owner_id is not null then
    select email into new.notification_email from auth.users where id = new.owner_id;
  end if;
  return new;
end;
$$;
drop trigger if exists businesses_notification_email on public.businesses;
create trigger businesses_notification_email before insert or update of owner_id, notification_email on public.businesses
  for each row execute function public.fill_notification_email();
update public.businesses b set notification_email = u.email
from auth.users u
where u.id = b.owner_id and nullif(btrim(coalesce(b.notification_email, '')), '') is null;

-- ---------- 8. Tell the owner when their business is approved ----------
alter table public.businesses add column if not exists approved_notified_at timestamptz;
create or replace function public.claim_approval_notice(p_username text)
returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
declare
  b public.businesses;
  v_email text;
begin
  if not public.is_admin() then return null; end if;
  update public.businesses set approved_notified_at = now()
  where username = p_username and status = 'approved' and approved_notified_at is null
  returning * into b;
  if b.username is null then return null; end if;
  select email into v_email from auth.users where id = b.owner_id;
  return jsonb_build_object('name', b.name, 'username', b.username, 'email', coalesce(v_email, b.notification_email, b.pending_owner_email));
end;
$$;
revoke execute on function public.claim_approval_notice(text) from anon, public;
grant execute on function public.claim_approval_notice(text) to authenticated;
-- Businesses already approved don't get the e-mail now.
update public.businesses set approved_notified_at = now() where status = 'approved' and approved_notified_at is null;

-- ---------- 9. Cancellation rule: up to N hours before (profile.cancelar_horas) ----------
-- And 10. the history of each booking: who confirmed, moved or cancelled it, and when.
create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  business_name text not null,
  at timestamptz not null default now(),
  actor text not null,
  what text not null
);
create index if not exists order_events_order on public.order_events (order_id, at);
alter table public.order_events enable row level security;
drop policy if exists order_events_owner on public.order_events;
create policy order_events_owner on public.order_events for select using (public.is_business_owner(business_name));

create or replace function public.order_guard_and_log()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := coalesce(auth.role(), '');
  v_owner boolean := v_role <> '' and public.is_business_owner(old.business_name);
  v_actor text := case when v_role = '' then 'NetWish' when v_owner then 'Negocio' else 'Cliente' end;
  v_hours int;
  v_start timestamp;
  v_moved boolean := new.date is distinct from old.date or new.time is distinct from old.time;
  -- NetWish freeing an unconfirmed table (cron) is not the customer.
  v_system boolean := new.released_at is distinct from old.released_at;
begin
  if v_system then v_actor := 'NetWish'; end if;
  -- Customers (not the business, not the automatic jobs) respect the cancellation window.
  if v_role in ('anon', 'authenticated') and not v_owner and not v_system
     and ((new.status = 'Cancelado' and old.status <> 'Cancelado') or v_moved) then
    select nullif(s.profile ->> 'cancelar_horas', '')::int into v_hours
    from public.restaurant_settings s where lower(trim(s.business_name)) = lower(trim(old.business_name));
    if coalesce(v_hours, 0) > 0 and old.date ~ '^\d{4}-\d{2}-\d{2}$' and old.time ~ '^\d{1,2}:\d{2}' then
      v_start := (old.date || ' ' || substring(old.time from '^(\d{1,2}:\d{2})'))::timestamp;
      if v_start - make_interval(hours => v_hours) < (now() at time zone 'Europe/Madrid') then
        raise exception 'Ya no se puede % online (hasta % h antes). Llama a %.',
          case when v_moved then 'cambiar' else 'cancelar' end, v_hours, old.business_name;
      end if;
    end if;
  end if;

  if new.status is distinct from old.status then
    insert into public.order_events (order_id, business_name, actor, what)
    values (new.id, new.business_name, v_actor, 'Estado: ' || coalesce(old.status, '—') || ' → ' || coalesce(new.status, '—'));
  end if;
  if v_moved then
    insert into public.order_events (order_id, business_name, actor, what)
    values (new.id, new.business_name, v_actor, 'Cambio: ' || coalesce(old.date, '') || ' ' || coalesce(old.time, '') || ' → ' || coalesce(new.date, '') || ' ' || coalesce(new.time, ''));
  end if;
  if new.tables is distinct from old.tables and old.tables is not null then
    insert into public.order_events (order_id, business_name, actor, what)
    values (new.id, new.business_name, v_actor, 'Mesa: ' || array_to_string(old.tables, '+') || ' → ' || coalesce(array_to_string(new.tables, '+'), '—'));
  end if;
  return new;
end;
$$;
drop trigger if exists orders_guard_and_log on public.orders;
create trigger orders_guard_and_log before update on public.orders
  for each row execute function public.order_guard_and_log();

create or replace function public.order_log_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.order_events (order_id, business_name, actor, what)
  values (new.id, new.business_name,
    case when coalesce(auth.role(), '') <> '' and public.is_business_owner(new.business_name) then 'Negocio' else 'Cliente' end,
    'Creada' || case when new.status is not null then ' (' || new.status || ')' else '' end);
  return null;
end;
$$;
drop trigger if exists orders_log_created on public.orders;
create trigger orders_log_created after insert on public.orders
  for each row execute function public.order_log_created();

-- ---------- 11. Chat: the business hears about a new message ----------
alter table public.messages add column if not exists notified_at timestamptz;
create or replace function public.claim_message_notice(p_id bigint)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  m public.messages;
  v_email text;
begin
  select * into m from public.messages where id = p_id and sender_type = 'customer' and notified_at is null
    and created_at > now() - interval '10 minutes';
  if m.id is null then return null; end if;
  -- One e-mail per conversation every 30 minutes is enough.
  if exists (select 1 from public.messages x where x.business_name = m.business_name and x.customer_id = m.customer_id
             and x.notified_at > now() - interval '30 minutes') then
    update public.messages set notified_at = now() where id = m.id;
    return null;
  end if;
  update public.messages set notified_at = now() where id = m.id;
  select notification_email into v_email from public.businesses where lower(trim(name)) = lower(trim(m.business_name)) limit 1;
  return jsonb_build_object('business_name', m.business_name, 'email', v_email, 'sender', m.sender_name, 'text', left(m.text, 500));
end;
$$;
grant execute on function public.claim_message_notice(bigint) to authenticated;

-- ---------- 12. Push notifications to the owner's phone ----------
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  business_name text not null,
  user_id uuid not null default auth.uid(),
  keys jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_owner on public.push_subscriptions;
create policy push_owner on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_business_owner(business_name));

-- The notice e-mail endpoint asks for these (only for an order it was just told about).
create or replace function public.push_targets(p_order uuid)
returns table (endpoint text, keys jsonb)
language sql stable security definer set search_path = public
as $$
  select p.endpoint, p.keys from public.push_subscriptions p
  join public.orders o on lower(trim(o.business_name)) = lower(trim(p.business_name))
  where o.id = p_order and o.created_at > now() - interval '10 minutes';
$$;
grant execute on function public.push_targets(uuid) to anon, authenticated;
create or replace function public.forget_push(p_endpoint text)
returns void language sql security definer set search_path = public
as $$ delete from public.push_subscriptions where endpoint = p_endpoint; $$;
grant execute on function public.forget_push(text) to anon, authenticated;

-- ---------- 13. /admin: who is using NetWish and who needs a call ----------
alter table public.businesses add column if not exists last_seen_at timestamptz;
create or replace function public.touch_my_business()
returns void language sql security definer set search_path = public
as $$ update public.businesses set last_seen_at = now() where owner_id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '5 minutes'); $$;
grant execute on function public.touch_my_business() to authenticated;

create or replace function public.admin_stats()
returns table (username text, name text, category text, status text, owner boolean, last_seen_at timestamptz,
  bookings_30 int, online_30 int, noshow_30 int, upcoming int, rating numeric, channels jsonb)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;
  return query
  select b.username, b.name, b.category, b.status, b.owner_id is not null, b.last_seen_at,
    count(o.id) filter (where o.created_at > now() - interval '30 days')::int,
    count(o.id) filter (where o.created_at > now() - interval '30 days' and coalesce(o.source, 'app') = 'app')::int,
    count(o.id) filter (where o.created_at > now() - interval '30 days' and o.status = 'No vino')::int,
    count(o.id) filter (where o.date >= to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD') and o.status in ('Mesa Confirmada', 'Pendiente de Aprobación', 'Pedido Recibido'))::int,
    round(avg(o.rating)::numeric, 1),
    coalesce((select jsonb_object_agg(c, n) from (
      select coalesce(o2.channel, 'directo') c, count(*) n from public.orders o2
      where lower(trim(o2.business_name)) = lower(trim(b.name)) and o2.created_at > now() - interval '30 days' and coalesce(o2.source, 'app') = 'app'
      group by 1) x), '{}'::jsonb)
  from public.businesses b
  left join public.orders o on lower(trim(o.business_name)) = lower(trim(b.name))
  where not coalesce(b.demo, false)
  group by b.username, b.name, b.category, b.status, b.owner_id, b.last_seen_at
  order by count(o.id) filter (where o.created_at > now() - interval '30 days') desc, b.name;
end;
$$;
revoke execute on function public.admin_stats() from anon, public;
grant execute on function public.admin_stats() to authenticated;

-- ---------- 14. Table QR: "the bill, please" and "call the waiter" ----------
-- Reuses table_sessions? No: a tiny table the kitchen/floor screen listens to.
create table if not exists public.table_calls (
  id bigint generated always as identity primary key,
  business_name text not null,
  table_no int not null,
  kind text not null check (kind in ('cuenta', 'camarero')),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.table_calls enable row level security;
drop policy if exists table_calls_owner on public.table_calls;
create policy table_calls_owner on public.table_calls for all
  using (public.is_business_owner(business_name)) with check (public.is_business_owner(business_name));
create or replace function public.call_table(p_business text, p_table int, p_kind text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_kind not in ('cuenta', 'camarero') or p_table not between 1 and 500 then raise exception 'Petición no válida'; end if;
  if not exists (select 1 from public.businesses where lower(trim(name)) = lower(trim(p_business))) then raise exception 'Negocio no encontrado'; end if;
  -- One open call per table and kind.
  if exists (select 1 from public.table_calls where lower(trim(business_name)) = lower(trim(p_business)) and table_no = p_table
             and kind = p_kind and done_at is null and created_at > now() - interval '30 minutes') then return; end if;
  insert into public.table_calls (business_name, table_no, kind) values (p_business, p_table, p_kind);
end;
$$;
grant execute on function public.call_table(text, int, text) to anon, authenticated;
do $$ begin
  alter publication supabase_realtime add table public.table_calls;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ---------- 15. Staff accounts: waiters, front desk, a hairdresser of the team ----------
-- They see and manage bookings, customers and the menu; only the owner changes the business data.
alter table public.businesses add column if not exists staff_emails text[] not null default '{}';
create or replace function public.is_business_owner(p_business text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where lower(trim(b.name)) = lower(trim(p_business))
      and (b.owner_id = auth.uid() or public.is_admin()
           or (auth.uid() is not null and lower(coalesce(auth.jwt() ->> 'email', '')) = any (b.staff_emails)))
  );
$$;
create or replace function public.my_staff_business()
returns text
language sql stable security definer set search_path = public
as $$
  select b.username from public.businesses b
  where auth.uid() is not null and lower(coalesce(auth.jwt() ->> 'email', '')) = any (b.staff_emails)
  order by b.created_at limit 1;
$$;
revoke execute on function public.my_staff_business() from anon, public;
grant execute on function public.my_staff_business() to authenticated;
