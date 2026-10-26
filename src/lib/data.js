import { supabase } from './supabase.js';
import { normalize, todayISO, nowTime } from './format.js';

const BUSINESS_COLUMNS = 'username, name, category, telefono, image, cover_url, owner_id, status, address';

const escapeLike = (s) => String(s || '').trim().replace(/[\\%_]/g, (c) => `\\${c}`);

const fail = (error) => {
  if (error) throw new Error(error.message || 'Error de conexión');
};

// ---------- Businesses ----------
let businessCache = null;

export async function listBusinesses({ fresh = false } = {}) {
  if (businessCache && !fresh) return businessCache;
  const { data, error } = await supabase.from('businesses').select(BUSINESS_COLUMNS).eq('status', 'approved').order('name');
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
  const found = list.find((b) => normalize(b.name) === key) || list.find((b) => normalize(b.username) === key);
  if (found) return found;
  // A pending business is hidden from the directory but its owner can preview it.
  const { data } = await supabase.from('businesses').select(BUSINESS_COLUMNS).ilike('name', escapeLike(name)).maybeSingle();
  return data || null;
}

// Self-service sign-up: the business exists at once, pending until an admin approves it.
export async function createMyBusiness({ name, category, phone, address }) {
  const { data, error } = await supabase.rpc('create_my_business', { p_name: name, p_category: category, p_phone: phone, p_address: address });
  fail(error);
  businessCache = null;
  notifyTeam({ kind: 'nuevo', name: data.name, category, phone, address });
  return data;
}

export async function isAdmin() {
  const { data } = await supabase.rpc('is_admin');
  return data === true;
}

export async function adminOverview() {
  const [biz, req] = await Promise.all([
    supabase.from('businesses').select(`${BUSINESS_COLUMNS}, notification_email, created_at`).neq('status', 'approved').order('created_at', { ascending: false }),
    supabase.from('business_requests').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  fail(biz.error);
  fail(req.error);
  return { pending: biz.data || [], requests: req.data || [] };
}

export async function setBusinessStatus(username, status) {
  const { error } = await supabase.rpc('set_business_status', { p_username: username, p_status: status });
  fail(error);
  businessCache = null;
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
    blocks: data?.blocks || [],
  };
}

// Public settings of every restaurant, for "Hoy en Palencia" on the home screen.
export async function restaurantsToday() {
  const [businesses, { data }] = await Promise.all([
    listBusinesses(),
    supabase.from('restaurant_settings').select('business_name, daily_menu, closed_days, lunch_start, dinner_start, profile'),
  ]);
  const byName = new Map((data || []).map((r) => [normalize(r.business_name), r]));
  const today = new Date().getDay();
  // `open`: takes bookings and is not closed today. Closed ones still show their events.
  return businesses
    .map((b) => ({ biz: b, settings: byName.get(normalize(b.name)) }))
    .filter(({ settings }) => settings)
    .map((r) => ({ ...r, open: !(r.settings.closed_days || []).includes(today) && r.settings.profile?.reservas !== false }));
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
  SEATED: 'Sentado',
  DONE: 'Completado',
  NOSHOW: 'No vino',
  CANCELLED: 'Cancelado',
  REJECTED: 'Rechazado',
};

export const isReservation = (o) => {
  const s = normalize(`${o.items} ${o.status}`);
  return s.includes('reserva') || s.includes('pax') || s.includes('aprobacion');
};

export async function createOrder({ business, user, items, itemsText, total, date, time, status, phone }) {
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
    ...(phone ? { phone } : {}),
  };
  const { error } = await supabase.from('orders').insert([order]);
  fail(error);
  notifyOrder(id, 'created');
  return order;
}

// A booking the restaurant writes down itself: a phone call or someone who walks in.
export async function createOwnerBooking({ business, customer, phone, itemsText, date, time, status, source }) {
  const order = {
    id: crypto.randomUUID(),
    business_name: business,
    customer: customer || 'Cliente',
    phone: phone || null,
    items: itemsText,
    total: 0,
    date,
    time,
    status,
    source,
  };
  const { error } = await supabase.from('orders').insert([order]);
  fail(error);
  return order;
}

export async function orderStatus(id) {
  const { data } = await supabase.from('orders').select('status').eq('id', id).maybeSingle();
  return data?.status || null;
}

// Status and the link token of a booking just made, for the "add to calendar" buttons.
export async function bookingState(id) {
  const { data } = await supabase.from('orders').select('status, remind_token').eq('id', id).maybeSingle();
  return { status: data?.status || null, token: data?.remind_token || null };
}

// The customer moves their table booking (link in the e-mail). Returns { id, status }.
export async function changeBooking(token, { itemsText, date, time }) {
  const { data, error } = await supabase.rpc('change_booking', { p_token: token, p_items: itemsText, p_date: date, p_time: time });
  fail(error);
  notifyOrder(data.id, 'changed');
  return data;
}

export async function setOrderItems(id, items) {
  const { error } = await supabase.from('orders').update({ items }).eq('id', id);
  fail(error);
}

// Booking without an account: name and e-mail. Returns { id, status, token }.
export async function createGuestBooking({ business, name, email, phone, itemsText, date, time }) {
  const { data, error } = await supabase.rpc('create_guest_booking', {
    p_business: business, p_name: name, p_email: email, p_phone: phone || null, p_items: itemsText, p_date: date, p_time: time,
  });
  fail(error);
  notifyOrder(data.id, 'created');
  return data;
}

export async function joinWaitlist(entry) {
  const { error } = await supabase.from('waitlist').insert([entry]);
  fail(error);
}

export async function businessWaitlist(businessName) {
  const { data } = await supabase.from('waitlist').select('*').ilike('business_name', escapeLike(businessName)).gte('date', todayISO()).order('created_at');
  return data || [];
}

export async function setWaitlistStatus(id, status) {
  const { error } = await supabase.from('waitlist').update({ status }).eq('id', id);
  fail(error);
}

export async function expirePending(businessName) {
  const { data } = await supabase.rpc('expire_pending', { p_business: businessName });
  return data || 0;
}

export async function cancelMyBooking(id) {
  const { error } = await supabase.rpc('cancel_my_booking', { p_order: id });
  fail(error);
}

export async function respondBooking(token, action = 'view') {
  const { data, error } = await supabase.rpc('respond_booking', { p_token: token, p_action: action });
  fail(error);
  return data;
}

// Sends tomorrow's reminders. Runs whenever the owner opens the panel; each booking goes out once.
export async function sendReminders() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return 0;
  try {
    const res = await fetch('/api/remind', { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: '{}' });
    const out = await res.json();
    return out.sent || 0;
  } catch {
    return 0;
  }
}

// What the restaurant keeps about each customer: { [customerKey]: { note, tags, birthday } }.
export async function customerNotes(businessName) {
  const { data } = await supabase.from('customer_notes').select('*').ilike('business_name', escapeLike(businessName));
  return Object.fromEntries((data || []).map((n) => [n.customer_key, { note: n.note || '', tags: n.tags || [], birthday: n.birthday || '' }]));
}

export async function saveCustomerNote(businessName, key, { note, tags, birthday }) {
  const row = { business_name: businessName, customer_key: key, note, tags, birthday: birthday || null, updated_at: new Date().toISOString() };
  let { error } = await supabase.from('customer_notes').upsert([row]);
  // Until the newer columns exist the note still saves.
  if (error && /birthday|tags/.test(error.message || '')) {
    delete row.birthday;
    ({ error } = await supabase.from('customer_notes').upsert([row]));
  }
  fail(error);
}

// ---------- Customers coming back ----------
// The survey link in the e-mail: reads the visit, or saves a 1–5 score and an optional comment.
export async function rateVisit(token, rating = null, comment = null) {
  const { data, error } = await supabase.rpc('rate_visit', { p_token: token, p_rating: rating, p_comment: comment });
  fail(error);
  return data;
}

export async function marketingUnsubscribe(business, email, sig) {
  const { error } = await supabase.rpc('marketing_unsubscribe', { p_business: business, p_email: email, p_sig: sig });
  fail(error);
}

export async function campaignsOf(businessName) {
  const [{ data }, { data: out }] = await Promise.all([
    supabase.from('campaigns').select('*').ilike('business_name', escapeLike(businessName)).order('created_at', { ascending: false }).limit(30),
    supabase.from('marketing_optouts').select('email').ilike('business_name', escapeLike(businessName)),
  ]);
  return { campaigns: data || [], optouts: new Set((out || []).map((o) => o.email)) };
}

export async function sendCampaign({ segment, subject, body, offer }) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch('/api/campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
    body: JSON.stringify({ segment, subject, body, offer }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'No se pudo enviar la campaña');
  return out;
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

// Everything from the last 13 months onwards (past visits for customers and stats, and every booking ahead),
// by booking date rather than by when it was made, so busy restaurants never lose future bookings.
export async function businessOrders(businessName) {
  const from = new Date();
  from.setMonth(from.getMonth() - 13);
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .ilike('business_name', escapeLike(businessName))
    .gte('date', from.toISOString().slice(0, 10))
    .order('date', { ascending: false })
    .limit(5000);
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
function notifyTeam(payload) {
  fetch('/api/business-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

// kind: 'alta' (a type we don't support yet), 'otro' (described in their words) or 'contacto'.
export const notifyReady = (business) => notifyTeam({ kind: 'listo', name: business.name, category: business.category, phone: business.telefono, address: business.address, email: business.notification_email });

export async function requestBusinessSignup(form) {
  const { error } = await supabase.from('business_requests').insert([form]);
  fail(error);
  notifyTeam(form);
}

// ---------- Realtime ----------
export function subscribe(table, onChange, filter) {
  const channel = supabase
    .channel(`${table}:${filter || 'all'}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
