import { supabase } from './supabase.js';
import { normalize, todayISO, nowTime } from './format.js';

const BUSINESS_COLUMNS = 'username, name, category, telefono, image, cover_url, owner_id';

const escapeLike = (s) => String(s || '').trim().replace(/[\\%_]/g, (c) => `\\${c}`);

const fail = (error) => {
  if (error) throw new Error(error.message || 'Error de conexión');
};

// ---------- Businesses ----------
let businessCache = null;

export async function listBusinesses({ fresh = false } = {}) {
  if (businessCache && !fresh) return businessCache;
  const { data, error } = await supabase.from('businesses').select(BUSINESS_COLUMNS).order('name');
  fail(error);
  const seen = new Set();
  businessCache = (data || []).filter((b) => {
    const key = normalize(b.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return businessCache;
}

export async function findBusiness(name) {
  const list = await listBusinesses();
  const key = normalize(name);
  return list.find((b) => normalize(b.name) === key) || list.find((b) => normalize(b.username) === key) || null;
}

export async function myBusiness(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('businesses')
    .select(`${BUSINESS_COLUMNS}, notification_email`)
    .eq('owner_id', userId)
    .maybeSingle();
  fail(error);
  return data;
}

export async function claimBusiness(username, password) {
  const { data, error } = await supabase.rpc('claim_business', { p_username: username, p_password: password });
  fail(error);
  businessCache = null;
  return data;
}

export async function updateBusiness(username, patch) {
  const { error } = await supabase.from('businesses').update(patch).eq('username', username);
  fail(error);
  businessCache = null;
}

export async function uploadPublicFile(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false });
  fail(error);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export const safeSlug = (s) => normalize(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'negocio';

// ---------- Products ----------
export async function listProducts(businessName) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .ilike('business_id', escapeLike(businessName))
    .order('created_at', { ascending: true });
  fail(error);
  return data || [];
}

export async function createProduct(product) {
  const { error } = await supabase.from('products').insert([product]);
  fail(error);
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  fail(error);
}

// ---------- Restaurant ----------
export const DEFAULT_SETTINGS = {
  lunch_start: '13:00',
  lunch_end: '16:00',
  dinner_start: '20:30',
  dinner_end: '23:30',
  turn_duration_min: 90,
  tables: [],
  daily_menu: null,
  staff: [],
  closed_days: [],
};

// Salons work in a morning and an afternoon shift and usually close on Sundays.
const BEAUTY_SETTINGS = {
  ...DEFAULT_SETTINGS,
  lunch_start: '10:00',
  lunch_end: '14:00',
  dinner_start: '16:30',
  dinner_end: '20:30',
  closed_days: [0],
};

export async function getRestaurantSettings(businessName, kind) {
  const { data, error } = await supabase
    .from('restaurant_settings')
    .select('*')
    .ilike('business_name', escapeLike(businessName))
    .maybeSingle();
  fail(error);
  const defaults = kind === 'beauty' ? BEAUTY_SETTINGS : DEFAULT_SETTINGS;
  return {
    ...defaults,
    ...(data || {}),
    tables: data?.tables || [],
    staff: data?.staff || [],
    closed_days: data?.closed_days || defaults.closed_days,
  };
}

export async function saveRestaurantSettings(businessName, patch) {
  const { error } = await supabase
    .from('restaurant_settings')
    .upsert([{ business_name: businessName, ...patch, updated_at: new Date().toISOString() }], { onConflict: 'business_name' });
  fail(error);
}

export async function reservationsOn(businessName, date) {
  const { data } = await supabase.rpc('reserved_slots', { p_business: businessName, p_date: date });
  return (data || []).map((r) => ({ items: r.slot_items, time: r.slot_time }));
}

// ---------- Orders ----------
export const STATUS = {
  PAID: 'Pagado Online', // only on old orders: NetWish no longer takes payments
  PENDING: 'Pendiente de Aprobación',
  KITCHEN: 'Comanda en Cocina',
  CONFIRMED: 'Mesa Confirmada',
  READY: 'Listo para servir',
  DONE: 'Completado',
  REJECTED: 'Rechazado',
};

export const isReservation = (o) => {
  const s = normalize(`${o.items} ${o.status}`);
  return s.includes('reserva') || s.includes('pax') || s.includes('aprobacion');
};

export async function createOrder({ business, user, items, itemsText, total, date, time, status }) {
  const id = crypto.randomUUID();
  const meta = user?.user_metadata || {};
  const order = {
    id,
    business_name: business,
    customer: meta.full_name || meta.name || user?.email?.split('@')[0] || 'Cliente',
    customer_email: user?.email || null,
    customer_id: user?.id || null,
    items: itemsText || items.map((i) => `${i.qty}x ${i.name}`).join(', '),
    total,
    date: date || todayISO(),
    time: time || nowTime(),
    status,
  };
  const { error } = await supabase.from('orders').insert([order]);
  fail(error);
  notifyOrder(id, 'created');
  return order;
}

export function notifyOrder(orderId, kind = 'created') {
  supabase.auth.getSession().then(({ data }) => {
    fetch('/api/notify-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      },
      body: JSON.stringify({ orderId, kind }),
    }).catch(() => {});
  });
}

export async function myOrders() {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
  fail(error);
  return data || [];
}

export async function businessOrders(businessName) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .ilike('business_name', escapeLike(businessName))
    .order('created_at', { ascending: false })
    .limit(300);
  fail(error);
  return data || [];
}

export async function setOrderStatus(id, status) {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  fail(error);
}

// ---------- Table sessions ----------
export async function openTableSession(businessName, table) {
  const { data, error } = await supabase
    .from('table_sessions')
    .select('*')
    .ilike('business_name', escapeLike(businessName))
    .eq('table_number', table)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error);
  return data;
}

export async function addItemsToTable(businessName, table, items, customer) {
  const { data, error } = await supabase.rpc('table_add_items', {
    p_business: businessName,
    p_table: table,
    p_items: items.map(({ id, name, price, qty }) => ({ id, name, price: Number(price), qty })),
    p_customer: customer || null,
  });
  fail(error);
  return data;
}

export async function kitchenSessions(businessName) {
  const { data, error } = await supabase
    .from('table_sessions')
    .select('*')
    .ilike('business_name', escapeLike(businessName))
    .neq('status', 'closed')
    .order('created_at', { ascending: true });
  fail(error);
  return data || [];
}

export async function closeTableSession(id) {
  const { error } = await supabase.from('table_sessions').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', id);
  fail(error);
}

// ---------- Messages ----------
export async function conversation(businessName, customerId) {
  let q = supabase.from('messages').select('*').ilike('business_name', escapeLike(businessName));
  if (customerId) q = q.eq('customer_id', customerId);
  const { data, error } = await q.order('created_at', { ascending: true });
  fail(error);
  return data || [];
}

export async function businessInbox(businessName) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .ilike('business_name', escapeLike(businessName))
    .order('created_at', { ascending: false })
    .limit(500);
  fail(error);
  const threads = new Map();
  for (const m of data || []) {
    const key = m.customer_id || `legacy:${normalize(m.sender_type === 'customer' ? m.sender_name : m.receiver_name)}`;
    if (!threads.has(key)) threads.set(key, { key, customerId: m.customer_id, name: '', last: m, unread: 0, avatar: null, messages: [] });
    const t = threads.get(key);
    t.messages.unshift(m);
    if (m.sender_type === 'customer') {
      t.name = t.name || m.sender_name;
      t.avatar = t.avatar || m.avatar_url;
      if (!m.is_read) t.unread += 1;
    } else {
      t.name = t.name || m.receiver_name;
    }
  }
  return [...threads.values()];
}

export async function sendMessage({ businessName, customerId, customerName, senderType, text, avatarUrl }) {
  const msg = {
    business_name: businessName,
    customer_id: customerId,
    sender_type: senderType,
    sender_name: senderType === 'customer' ? customerName : businessName,
    receiver_name: senderType === 'customer' ? businessName : customerName,
    sender_id: senderType === 'customer' ? customerId : businessName,
    text,
    avatar_url: avatarUrl || null,
    is_read: false,
  };
  const { error } = await supabase.from('messages').insert([msg]);
  fail(error);
}

export async function markThreadRead(businessName, customerId) {
  if (!customerId) return;
  await supabase
    .from('messages')
    .update({ is_read: true })
    .ilike('business_name', escapeLike(businessName))
    .eq('customer_id', customerId)
    .eq('sender_type', 'customer');
}

// ---------- Business sign-up requests ----------
export async function requestBusinessSignup(form) {
  const { error } = await supabase.from('business_requests').insert([form]);
  fail(error);
  fetch('/api/business-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  }).catch(() => {});
}

// ---------- Realtime ----------
export function subscribe(table, onChange, filter) {
  const channel = supabase
    .channel(`${table}:${filter || 'all'}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
