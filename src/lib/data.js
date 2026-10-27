import { supabase } from './supabase.js';
import { normalize, todayISO, nowTime } from './format.js';
import { kindOf } from './categories.js';

const BUSINESS_COLUMNS = 'username, name, category, telefono, image, cover_url, owner_id, status, address';

const escapeLike = (s) => String(s || '').trim().replace(/[\\%_]/g, (c) => `\\${c}`);

const fail = (error) => {
  if (error) throw new Error(error.message || 'Error de conexión');
};

// ---------- Businesses ----------
let businessCache = null;

// `demo` marks the example businesses and `preview` the real ones NetWish set up that no
// owner runs yet. Until a column exists the query goes without it.
let hasDemo = true;
let hasPreview = true;
const columns = (extra = '') => `${BUSINESS_COLUMNS}${hasDemo ? ', demo' : ''}${hasPreview ? ', preview' : ''}${extra}`;
async function selectBusinesses(build, extra) {
  let res = await build(supabase.from('businesses').select(columns(extra)));
  while (res.error && ((hasDemo && /demo/.test(res.error.message || '')) || (hasPreview && /preview/.test(res.error.message || '')))) {
    if (/preview/.test(res.error.message)) hasPreview = false;
    else hasDemo = false;
    res = await build(supabase.from('businesses').select(columns(extra)));
  }
  return res;
}

export async function listBusinesses({ fresh = false } = {}) {
  if (businessCache && !fresh) return businessCache;
  const { data, error } = await selectBusinesses((q) => q.eq('status', 'approved').order('name'));
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
  const { data } = await selectBusinesses((q) => q.ilike('name', escapeLike(name)).maybeSingle());
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

// /admin needs the admin account AND its own key, typed once per session (12 h).
export async function adminStatus() {
  const { data, error } = await supabase.rpc('admin_status');
  if (error) return null;
  return data;
}

export async function adminUnlock(key) {
  const { error } = await supabase.rpc('admin_unlock', { p_key: key });
  fail(error);
}

export async function adminLock() {
  await supabase.rpc('admin_lock');
}

export async function adminChangeKey(oldKey, newKey) {
  const { error } = await supabase.rpc('admin_change_key', { p_old: oldKey, p_new: newKey });
  fail(error);
}

// ---------- Real businesses NetWish sets up and hands over ----------
export async function adminBusinesses() {
  const { data, error } = await supabase.rpc('admin_businesses');
  fail(error);
  return data || [];
}

export async function adminCreateBusiness({ name, category, phone, address }) {
  const { data, error } = await supabase.rpc('admin_create_business', { p_name: name, p_category: category, p_phone: phone, p_address: address });
  fail(error);
  businessCache = null;
  return data;
}

export async function adminAssignOwner(username, email) {
  const { data, error } = await supabase.rpc('admin_assign_owner', { p_username: username, p_email: email });
  fail(error);
  return data;
}

export async function adminReleaseOwner(username) {
  const { error } = await supabase.rpc('admin_release_owner', { p_username: username });
  fail(error);
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
  // The admin can open the panel of any business (see /admin).
  const demo = demoAs();
  if (demo) {
    const { data } = await selectBusinesses((q) => q.eq('username', demo).maybeSingle(), ', notification_email');
    if (data && (await isAdmin())) return { ...data, viewingAs: true, viewingDemo: !!data.demo };
    setDemoAs(null);
  }
  const { data, error } = await selectBusinesses((q) => q.eq('owner_id', userId).maybeSingle(), ', notification_email');
  fail(error);
  if (data) return data;
  // A business NetWish set up and assigned to this e-mail before the account existed.
  const { data: claimed } = await supabase.rpc('claim_invited_business');
  if (!claimed) return null;
  businessCache = null;
  const again = await selectBusinesses((q) => q.eq('owner_id', userId).maybeSingle(), ', notification_email');
  return again.data || null;
}

// ---------- Example businesses ----------
const DEMO_KEY = 'netwish.demoAs';
export function demoAs() {
  try { return localStorage.getItem(DEMO_KEY); } catch { return null; }
}
export function setDemoAs(username) {
  try {
    if (username) localStorage.setItem(DEMO_KEY, username);
    else localStorage.removeItem(DEMO_KEY);
  } catch { /* storage unavailable */ }
}

export async function demoBusinesses() {
  if (!hasDemo) return [];
  const { data, error } = await selectBusinesses((q) => q.eq('demo', true).order('created_at'), ', created_at');
  if (error || !hasDemo) return [];
  return data || [];
}

export async function setDemoVisibility(visible) {
  const { data, error } = await supabase.rpc('set_demo_visibility', { p_visible: visible });
  fail(error);
  businessCache = null;
  directoryCache = null;
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

export async function updateProduct(id, patch) {
  const { error } = await supabase.from('products').update(patch).eq('id', id);
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
  const defaults = kind && kind !== 'restaurant' ? BEAUTY_SETTINGS : DEFAULT_SETTINGS;
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
// Every listed business with its public settings (hours, menu, profile), for Explore and Home.
let directoryCache = null;
export async function directory() {
  if (directoryCache) return directoryCache;
  const [businesses, { data }] = await Promise.all([
    listBusinesses(),
    supabase.from('restaurant_settings').select('business_name, daily_menu, closed_days, lunch_start, lunch_end, dinner_start, dinner_end, profile, tables'),
  ]);
  const byName = new Map((data || []).map((r) => [normalize(r.business_name), r]));
  directoryCache = businesses.map((b) => ({ biz: b, settings: byName.get(normalize(b.name)) || null }));
  return directoryCache;
}

// What each business sells, so searching "lechazo" finds the restaurant that has it.
let dishesCache = null;
export async function dishIndex() {
  if (dishesCache) return dishesCache;
  const { data } = await supabase.from('products').select('business_id, name, section').limit(5000);
  const map = new Map();
  for (const p of data || []) {
    const key = normalize(p.business_id);
    map.set(key, `${map.get(key) || ''} ${p.name || ''} ${p.section || ''}`);
  }
  dishesCache = map;
  return map;
}

export async function restaurantsToday() {
  const list = await directory();
  const today = new Date().getDay();
  // Only restaurants. `open`: takes bookings and is not closed today. Closed ones still show their events.
  return list
    .filter(({ biz, settings }) => settings && kindOf(biz) === 'restaurant')
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
  // Orders to pick up at a shop.
  ORDERED: 'Pedido Recibido',
  PREPARING: 'Preparando',
  PICKUP: 'Listo para recoger',
  COLLECTED: 'Recogido',
};

export const isPickup = (o) => /^Pedido para recoger/i.test(o?.items || '') || !!o?.pickup_code;

// The customer's basket goes to the shop; the database checks prices and stock and keeps the items aside.
export async function createPickupOrder({ business, lines, date, time, payment, name, email, phone, note }) {
  const { data, error } = await supabase.rpc('create_pickup_order', {
    p_business: business,
    p_lines: lines.map((l) => ({ id: l.pid, qty: l.qty, variant: l.variant || null })),
    p_date: date,
    p_time: time,
    p_payment: payment,
    p_name: name,
    p_email: email,
    p_phone: phone || null,
    p_note: note || null,
  });
  if (error && /create_pickup_order/.test(error.message || '')) throw new Error('Esta tienda aún no recibe pedidos online. Llámala o escríbele.');
  fail(error);
  notifyOrder(data.id, 'created');
  return data;
}

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

// "Muy pronto" waiting list.
export async function joinLaunchList(email, source) {
  const { error } = await supabase.rpc('join_launch_list', { p_email: email, p_source: source || null });
  fail(error);
}

export async function launchSignups() {
  const { data, error } = await supabase.from('launch_signups').select('email, source, created_at, notified_at').order('created_at', { ascending: false });
  fail(error);
  return data || [];
}

export async function announceLaunch({ subject, body }) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify({ subject, body }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'No se pudo enviar');
  return out;
}

// A booking request from the public page, with or without an account. Returns { id, status, token }.
export async function requestBooking({ business, user, guest, itemsText, date, time, total = 0 }) {
  if (user) {
    const order = await createOrder({ business, user, items: [], itemsText, total, date, time, status: STATUS.PENDING, phone: guest?.phone?.trim() || undefined });
    // The database may have confirmed it on the spot (a class with places left).
    const state = await bookingState(order.id);
    return { id: order.id, ...state };
  }
  return createGuestBooking({ business, name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone?.trim(), itemsText, date, time });
}
