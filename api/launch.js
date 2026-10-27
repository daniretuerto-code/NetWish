import { SITE_URL, button, emailLayout, escapeHtml, supabaseRest } from './_lib.js';

// "Ya estamos abiertos": e-mails everyone on the "Muy pronto" list who has not been told yet.
// Only NetWish's admin; the database checks it (is_admin and the table's policies).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const auth = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization : null;
  if (!auth) return res.status(401).json({ error: 'Inicia sesión' });
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'El correo no está configurado' });

  const subject = String(req.body?.subject || '').trim().slice(0, 120) || 'NetWish ya está abierto en Palencia';
  const body = String(req.body?.body || '').trim().slice(0, 2000);

  try {
    const admin = await supabaseRest('rpc/is_admin', { method: 'POST', authorization: auth, body: {} });
    if (admin !== true) return res.status(403).json({ error: 'Solo el administrador' });

    const list = await supabaseRest('launch_signups?select=email&notified_at=is.null&order=created_at', { authorization: auth });
    const html = emailLayout(subject, `<p style="font-size:16px;line-height:1.5">${escapeHtml(body).replace(/\n/g, '<br>')}</p>
      <p>${button(SITE_URL, 'Abrir NetWish', true)}</p>
      <p style="color:#6B6862;font-size:12px;margin-top:18px">Te llega porque pediste que te avisáramos en netwish.es. No volveremos a escribirte por esta lista.</p>`);

    let sent = 0;
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map((p) => ({ from: 'NetWish <notificaciones@netwish.es>', to: [p.email], subject, html }))),
      });
      if (!r.ok) { console.error('Resend batch', r.status, await r.text()); continue; }
      sent += chunk.length;
      const emails = chunk.map((p) => `"${p.email.replace(/"/g, '')}"`).join(',');
      await supabaseRest(`launch_signups?email=in.(${encodeURIComponent(emails)})`, {
        method: 'PATCH',
        authorization: auth,
        body: { notified_at: new Date().toISOString() },
      });
    }
    return res.status(200).json({ sent, total: list.length });
  } catch (error) {
    console.error('launch', error);
    return res.status(400).json({ error: error.message || 'No se pudo enviar' });
  }
}
