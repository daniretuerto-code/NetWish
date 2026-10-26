import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseRest } from './_lib.js';
import { campaignEmail } from './_emails.js';

// A restaurant e-mails a group of its customers. The database checks the owner, the pace
// (one a day) and who unsubscribed, and hands back the list; this only sends.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const auth = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization : null;
  if (!auth) return res.status(401).json({ error: 'Inicia sesión' });
  const { segment, subject, body, offer } = req.body || {};

  try {
    const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth } }).then((r) => (r.ok ? r.json() : null));
    if (!user?.id) return res.status(401).json({ error: 'Sesión no válida' });
    const [biz] = await supabaseRest(`businesses?select=name&owner_id=eq.${user.id}`, { authorization: auth });
    if (!biz) return res.status(403).json({ error: 'No tienes un negocio' });

    const out = await supabaseRest('rpc/start_campaign', {
      method: 'POST',
      authorization: auth,
      body: { p_business: biz.name, p_segment: segment, p_subject: String(subject || ''), p_body: String(body || ''), p_offer: offer ? String(offer) : null },
    });
    const key = process.env.RESEND_API_KEY;
    if (!key) return res.status(500).json({ error: 'El correo no está configurado' });

    const mail = { business: biz.name, username: out.username, subject: String(subject).trim().slice(0, 120), body: String(body).trim().slice(0, 2000), offer: offer ? String(offer).trim().slice(0, 200) : '' };
    const list = out.recipients || [];
    let sent = 0;
    // Resend takes up to 100 e-mails per call.
    for (let i = 0; i < list.length; i += 100) {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(list.slice(i, i + 100).map((p) => campaignEmail(mail, p))),
      });
      if (r.ok) sent += Math.min(100, list.length - i);
      else console.error('Resend batch', r.status, await r.text());
    }
    return res.status(200).json({ sent, total: list.length });
  } catch (error) {
    console.error('campaign', error);
    return res.status(400).json({ error: error.message || 'No se pudo enviar' });
  }
}
