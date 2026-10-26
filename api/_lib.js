// Shared helpers for the serverless functions. Files starting with "_" are not routes.

export const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://gamjjnyomhnyswbxlhgq.supabase.co').replace(/\/$/, '');
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_096WH9RGLik4I_DsDR5iBg_QEKxC7bK';
export const SITE_URL = (process.env.SITE_URL || 'https://netwish.es').replace(/\/$/, '');

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function supabaseRest(path, { method = 'GET', body, authorization } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authorization || `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `Supabase ${res.status}`);
  return data;
}

export async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'NetWish <notificaciones@netwish.es>', to: [to], subject, html }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text());
  return res.ok;
}

export function emailLayout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#F2F0EB;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#111">
  <div style="max-width:520px;margin:0 auto;padding:28px 16px">
    <div style="font-weight:800;font-size:20px;margin-bottom:16px">NetWish</div>
    <div style="background:#fff;border-radius:24px;padding:24px">
      <h1 style="font-size:24px;margin:0 0 12px;letter-spacing:-0.02em">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </div>
    <p style="color:#6B6862;font-size:12px;margin-top:16px">Palencia · netwish.es</p>
  </div></body></html>`;
}

export const euro = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

export const button = (href, label, dark) =>
  `<a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:999px;margin:4px 6px 4px 0;font-weight:700;text-decoration:none;${dark ? 'background:#111;color:#D4F25C' : 'background:#F2F0EB;color:#111'}">${escapeHtml(label)}</a>`;

// "2026-10-27" + "21:00 - 22:30" → ["20261027T210000", "20261027T223000"], local time in Madrid.
export function bookingTimes(date, time) {
  const [from, to] = String(time || '').split(' - ').map((t) => t.trim());
  const stamp = (t) => `${String(date).replace(/-/g, '')}T${t.split(':').map((n) => n.padStart(2, '0')).join('')}00`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(from || '')) return null;
  const end = /^\d{1,2}:\d{2}$/.test(to || '') ? to : `${String(Number(from.split(':')[0]) + 1).padStart(2, '0')}:${from.split(':')[1]}`;
  return [stamp(from), stamp(end)];
}

export function googleCalendarUrl(order) {
  const times = bookingTimes(order.date, order.time);
  if (!times) return null;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Reserva en ${order.business_name}`,
    dates: times.join('/'),
    ctz: 'Europe/Madrid',
    details: `${String(order.items || '').split(' · Nota:')[0]}${order.token ? `\n\nVer o cambiar: ${SITE_URL}/reserva/${order.token}` : ''}`,
    location: order.address ? `${order.address}, Palencia` : `${order.business_name}, Palencia`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// Two buttons: Google Calendar and the .ics file that iPhone, Outlook and the rest open.
export function calendarButtons(order) {
  const google = googleCalendarUrl(order);
  if (!google || !order.token) return '';
  return `<p style="margin:16px 0 4px;font-size:13px;color:#6B6862">Añadir al calendario</p>
    <p style="margin:0">${button(escapeHtml(google), 'Google Calendar')}${button(`${SITE_URL}/api/ics?t=${order.token}`, 'iPhone / Outlook')}</p>`;
}
