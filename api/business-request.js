import { SITE_URL } from './_lib.js';

const FIELDS = ['kind', 'name', 'city', 'address', 'category', 'modality', 'email', 'phone', 'description', 'business'];
const clean = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

const TITLES = {
  nuevo: 'Nuevo negocio en NetWish (pendiente de aprobar)',
  alta: 'Un negocio quiere entrar en NetWish',
  otro: 'Negocio que no encaja en los tipos de NetWish',
  contacto: 'Un negocio quiere más de NetWish',
  listo: 'Un negocio ha completado su página y quiere publicarse',
};

// Sends a heads-up to the NetWish team's Telegram. The data itself is already
// stored in Supabase by the browser; this is only the notification.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(200).json({ sent: false });

  const body = req.body || {};
  const data = Object.fromEntries(FIELDS.map((k) => [k, clean(body[k], k === 'description' ? 1200 : 200)]));
  const kind = TITLES[data.kind] ? data.kind : 'alta';
  if ((data.name || data.business).length < 2) return res.status(400).json({ error: 'Datos incompletos' });

  const text = [
    TITLES[kind],
    `Negocio: ${data.name || data.business}`,
    data.category && `Tipo: ${data.category}${data.modality ? ` (${data.modality})` : ''}`,
    (data.address || data.city) && `Dirección: ${[data.address, data.city].filter(Boolean).join(', ')}`,
    data.email && `Correo: ${data.email}`,
    data.phone && `Teléfono: ${data.phone}`,
    data.description && `\n${kind === 'contacto' ? 'Mensaje' : 'Qué hace'}: ${data.description}`,
    ['nuevo', 'listo'].includes(kind) && `\nApruébalo en ${SITE_URL}/admin`,
  ].filter(Boolean).join('\n');

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.status(200).json({ sent: r.ok });
  } catch {
    return res.status(200).json({ sent: false });
  }
}
