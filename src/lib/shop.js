// Shops: products with photos, sizes and colours, stock, and orders picked up at the counter.
import { minutesToTime, money, timeToMinutes, todayISO } from './format.js';
import { isClosed, nextDays } from './booking.js';

// Real card payments online are not switched on yet: the option shows as "pronto".
export const ONLINE_PAYMENTS = false;

export const PAYMENTS = {
  tarjeta: { label: 'Tarjeta en tienda', short: 'Tarjeta', icon: 'card' },
  efectivo: { label: 'Efectivo en tienda', short: 'Efectivo', icon: 'cash' },
  bizum: { label: 'Bizum al recoger', short: 'Bizum', icon: 'phone' },
  online: { label: 'Pagar ahora con tarjeta', short: 'Online', icon: 'lock' },
};
export const paymentLabel = (key) => PAYMENTS[key]?.short || 'En tienda';

export const UNITS = [
  { value: 'ud', label: 'Unidad', per: '' },
  { value: 'kg', label: 'Kilo', per: '/kg' },
  { value: '500 g', label: 'Medio kilo', per: '/500 g' },
  { value: 'docena', label: 'Docena', per: '/docena' },
  { value: 'bolsa', label: 'Bolsa', per: '' },
  { value: 'caja', label: 'Caja', per: '' },
  { value: 'pack', label: 'Pack', per: '' },
  { value: 'pieza', label: 'Pieza', per: '/pieza' },
  { value: 'ración', label: 'Ración', per: '/ración' },
];
export const perUnit = (unit) => UNITS.find((u) => u.value === unit)?.per || '';
export const priceText = (p) => `${p.price_from ? 'desde ' : ''}${money(p.price)}${perUnit(p.unit)}`;
export const byWeight = (p) => p.unit === 'kg' || p.unit === '500 g';

export const sizesOf = (p) => p?.variants?.sizes || [];
export const colorsOf = (p) => p?.variants?.colors || [];
export const hasVariants = (p) => sizesOf(p).length > 0 || colorsOf(p).length > 0;
export const variantKey = (size, color) => [size, color].filter(Boolean).join('|');
export const variantLabel = (key) => String(key || '').split('|').join(' · ');

// Units left of one size/colour, or null when that combination is not counted.
export function variantStock(p, key) {
  const map = p?.variants?.stock;
  if (!map || !(key in map)) return null;
  return Math.max(0, Number(map[key]) || 0);
}

// Units left of the whole product, or null when the shop doesn't count it.
export function stockLeft(p) {
  const map = p?.variants?.stock;
  if (map && Object.keys(map).length) return Object.values(map).reduce((a, n) => a + Math.max(0, Number(n) || 0), 0);
  return p?.stock === null || p?.stock === undefined ? null : Math.max(0, Number(p.stock) || 0);
}

export function availability(p, low = 3) {
  const left = stockLeft(p);
  const soldOut = !!p.sold_out || left === 0;
  return {
    soldOut,
    left,
    low: !soldOut && left !== null && left <= low,
    preorder: Number(p.preorder_days) || 0,
    sale: Number(p.old_price) > Number(p.price) ? Math.round((1 - Number(p.price) / Number(p.old_price)) * 100) : 0,
  };
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Pickup times every half hour while the shop is open, from `prep` minutes from now.
export function pickupTimes(settings, date, prep = 30) {
  if (!settings || isClosed(settings, date)) return [];
  const now = new Date();
  const earliest = date === todayISO() ? now.getHours() * 60 + now.getMinutes() + prep : 0;
  const out = [];
  for (const [a, b] of [[settings.lunch_start, settings.lunch_end], [settings.dinner_start, settings.dinner_end]]) {
    if (!a || !b) continue;
    const from = timeToMinutes(a);
    const to = timeToMinutes(b) <= from ? 24 * 60 - 1 : timeToMinutes(b);
    for (let m = Math.ceil(Math.max(from, earliest) / 30) * 30; m <= to - 15; m += 30) out.push(minutesToTime(m));
  }
  return [...new Set(out)];
}

// Days the order can be picked up: open, after the longest "order ahead" time of the basket.
export function pickupDays(settings, minDays = 0, count = 21, prep = 30) {
  const first = addDays(todayISO(), minDays);
  return nextDays(count + minDays)
    .filter((d) => d.iso >= first)
    .map((d) => ({ ...d, closed: isClosed(settings, d.iso) || !pickupTimes(settings, d.iso, prep).length }));
}

// Order statuses as the shop and the customer read them.
export const PICKUP_STEPS = [
  { status: 'Pedido Recibido', label: 'Nuevo', customer: 'Recibido' },
  { status: 'Preparando', label: 'Preparando', customer: 'Preparando' },
  { status: 'Listo para recoger', label: 'Listo para recoger', customer: '¡Listo para recoger!' },
  { status: 'Recogido', label: 'Recogido', customer: 'Recogido' },
];
