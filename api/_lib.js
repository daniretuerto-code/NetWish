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
