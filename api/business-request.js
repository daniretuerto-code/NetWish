const FIELDS = ['name', 'city', 'address', 'category', 'modality', 'email', 'phone'];
const clean = (v) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);

// Sends a heads-up to the NetWish team's Telegram. The request itself is already
// stored in business_requests by the browser; this is only the notification.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(200).json({ sent: false });

  const body = req.body || {};
  const data = Object.fromEntries(FIELDS.map((k) => [k, clean(body[k])]));
  if (data.name.length < 2 || !data.email.includes('@')) return res.status(400).json({ error: 'Datos incompletos' });

  const text = [
    'Nueva solicitud de alta en NetWish',
    `Negocio: ${data.name}`,
    `Sector: ${data.category || '-'} (${data.modality || '-'})`,
    `Dirección: ${[data.address, data.city].filter(Boolean).join(', ') || '-'}`,
    `Correo: ${data.email}`,
    `Teléfono: ${data.phone || '-'}`,
  ].join('\n');

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
