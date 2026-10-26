import { emailLayout, escapeHtml, sendEmail, SITE_URL, SUPABASE_ANON_KEY, SUPABASE_URL, supabaseRest } from './_lib.js';

const button = (href, label, dark) =>
  `<a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:999px;margin:4px 6px 4px 0;font-weight:700;text-decoration:none;${dark ? 'background:#111;color:#D4F25C' : 'background:#F2F0EB;color:#111'}">${escapeHtml(label)}</a>`;

// Day-before reminders. The owner's panel calls this with their session; the database hands
// out each of tomorrow's confirmed bookings once, so calling it again sends nothing new.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const auth = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization : null;
  if (!auth) return res.status(401).json({ error: 'Inicia sesión' });

  try {
    // The business comes from the session, never from the request body.
    const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth },
    }).then((r) => (r.ok ? r.json() : null));
    if (!user?.id) return res.status(401).json({ error: 'Sesión no válida' });
    const [biz] = await supabaseRest(`businesses?select=name&owner_id=eq.${user.id}`, { authorization: auth });
    if (!biz) return res.status(200).json({ sent: 0 });

    const due = await supabaseRest('rpc/claim_reminders', { method: 'POST', body: { p_business: biz.name }, authorization: auth });
    let sent = 0;
    for (const row of due || []) {
      const o = row.claim_reminders || row;
      const link = `${SITE_URL}/reserva/${o.token}`;
      const start = String(o.time).split(' - ')[0];
      const ok = await sendEmail({
        to: o.customer_email,
        subject: `Mañana te esperamos en ${o.business_name} a las ${start}`,
        html: emailLayout(
          `Mañana a las ${start}`,
          `<p>Hola ${escapeHtml(o.customer)}, te recordamos tu reserva en <strong>${escapeHtml(o.business_name)}</strong>.</p>
           <p style="font-size:15px;color:#6B6862">${escapeHtml(o.items)}</p>
           <p>${button(`${link}?r=si`, 'Sí, allí estaré', true)}${button(`${link}?r=no`, 'No puedo ir')}</p>
           <p style="font-size:13px;color:#6B6862">Si no puedes ir, avísanos y la mesa quedará libre para otra persona.</p>`,
        ),
      });
      if (ok) sent += 1;
    }
    return res.status(200).json({ sent });
  } catch (error) {
    console.error('remind', error);
    return res.status(500).json({ error: 'No se pudieron enviar los recordatorios' });
  }
}
