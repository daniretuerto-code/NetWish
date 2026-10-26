import { isReservation, STATUS } from './data.js';
import { normalize, timeToMinutes } from './format.js';

// Restaurant bookings are stored as "Reserva 4 pax — Mesa 3 (Terraza) · Nota: …" with time "21:00 - 22:30".
// A group on two tables pushed together reads "Mesas 2+3 (Sala Principal)".
export const TABLES_RE = /Mesas? (\d+(?:\+\d+)*)/;
export const tablesIn = (items) => (TABLES_RE.exec(String(items || '').split(' · Nota:')[0])?.[1] || '').split('+').filter(Boolean).map(Number);
export const tableLabel = (list, zone) => `${list.length > 1 ? 'Mesas' : 'Mesa'} ${list.join('+')}${zone ? ` (${zone})` : ''}`;

// Since the panel update each booking also has guests, tables, zone and note columns (filled by the database);
// older rows and lists that only carry the text fall back to reading it.
export function parseTableBooking(o) {
  const items = String(o.items || '');
  const range = /(\d{1,2}:\d{2})\s*(?:-\s*(\d{1,2}:\d{2}))?/.exec(o.time || '') || [];
  if (o.guests != null && Array.isArray(o.tables)) {
    return { guests: o.guests, table: o.tables[0] || null, tables: o.tables, zone: o.zone || '', note: o.note || '', start: range[1] || '', end: range[2] || '' };
  }
  const tables = tablesIn(items);
  return {
    guests: Number(/(\d+)\s*pax/i.exec(items)?.[1]) || 0,
    table: tables[0] || null,
    tables,
    zone: /Mesas? [\d+]+ \(([^)]+)\)/.exec(items)?.[1] || '',
    note: items.split(' · Nota:')[1]?.trim() || '',
    start: range[1] || '',
    end: range[2] || '',
  };
}

export const ACTIVE_BOOKING = [STATUS.PENDING, STATUS.CONFIRMED, STATUS.SEATED];

export const STATUS_LOOK = {
  [STATUS.PENDING]: { label: 'Por confirmar', bg: 'var(--accent)', fg: 'var(--ink)' },
  [STATUS.CONFIRMED]: { label: 'Confirmada', bg: 'var(--ink)', fg: 'var(--on-ink)' },
  [STATUS.SEATED]: { label: 'Sentados', bg: 'var(--seated-ink)', fg: '#fff' },
  [STATUS.DONE]: { label: 'Terminada', bg: 'var(--bg)', fg: 'var(--muted)' },
  [STATUS.NOSHOW]: { label: 'No vino', bg: 'var(--danger-soft)', fg: 'var(--danger-ink)' },
  [STATUS.CANCELLED]: { label: 'Cancelada', bg: 'var(--bg)', fg: 'var(--muted)' },
  [STATUS.REJECTED]: { label: 'Rechazada', bg: 'var(--bg)', fg: 'var(--muted)' },
};

export const bookingsOf = (orders) => orders.filter(isReservation);

export const byTime = (a, b) => String(a.time).localeCompare(String(b.time));

// Lunch or dinner, from the start time and the restaurant's shifts.
export const shiftOf = (o, settings) => slotShift(settings, parseTableBooking(o).start);

export const guestsOf = (list) => list.reduce((n, o) => n + parseTableBooking(o).guests, 0);

// One customer across bookings: by e-mail, else phone, else name.
export const customerKey = (o) =>
  (o.customer_email && `mail:${o.customer_email.toLowerCase()}`)
  || (o.phone && `tel:${String(o.phone).replace(/\D/g, '')}`)
  || `name:${normalize(o.customer)}`;

export function customersFrom(orders) {
  const map = new Map();
  for (const o of bookingsOf(orders)) {
    const key = customerKey(o);
    if (!map.has(key)) map.set(key, { key, name: o.customer, email: o.customer_email, phone: o.phone, visits: 0, noShows: 0, cancelled: 0, last: '', next: '', bookings: [] });
    const c = map.get(key);
    c.bookings.push(o);
    c.email = c.email || o.customer_email;
    c.phone = c.phone || o.phone;
    if ([STATUS.DONE, STATUS.SEATED].includes(o.status)) c.visits += 1;
    if (o.status === STATUS.NOSHOW) c.noShows += 1;
    if (o.status === STATUS.CANCELLED) c.cancelled += 1;
    if (c.visits && (!c.last || o.date > c.last) && [STATUS.DONE, STATUS.SEATED].includes(o.status)) c.last = o.date;
  }
  return [...map.values()];
}

export const telLink = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

export function whatsappLink(phone, text) {
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 9) digits = `34${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export const dayLabel = (iso, today) => {
  if (iso === today) return 'Hoy';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const text = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// A table takes bookings from `min` to `capacity` people; by default up to two seats can go empty.
export const tableMin = (t) => Math.max(1, Number(t.min) || Number(t.capacity) - 2 || 1);
export const tableFits = (t, guests) => guests >= tableMin(t) && guests <= Number(t.capacity);

// Days or shifts the restaurant closed to online bookings ("Completo").
export function blockFor(settings, date) {
  const list = (settings?.blocks || []).filter((b) => b.date === date);
  return { todo: list.some((b) => b.shift === 'todo'), comida: list.some((b) => b.shift === 'comida' || b.shift === 'todo'), cena: list.some((b) => b.shift === 'cena' || b.shift === 'todo') };
}

export function slotShift(settings, slot) {
  const dinner = settings?.dinner_start ? timeToMinutes(settings.dinner_start) - 60 : 18 * 60;
  return timeToMinutes(slot) >= dinner ? 'cena' : 'comida';
}
