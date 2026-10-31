// Errors from the app reach Daniel on Telegram, so a failure is known before a business calls.
// No secrets in the message; the text is trimmed and nothing is stored.
const recent = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  let data = req.body;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = {}; } }
  const message = String(data?.message || '').slice(0, 400);
  if (!token || !chatId || !message) return res.status(204).end();

  // The same error from many phones only once every 10 minutes per server instance.
  const now = Date.now();
  if (recent.get(message) > now - 600000) return res.status(204).end();
  recent.set(message, now);
  if (recent.size > 200) recent.clear();

  const text = [
    '⚠️ Error en NetWish',
    message,
    `Página: ${String(data.path || '').slice(0, 120)}`,
    data.where && `Dónde: ${String(data.where).slice(0, 40)}`,
    `Navegador: ${String(data.ua || '').slice(0, 160)}`,
    data.stack && `\n${String(data.stack).split('\n').slice(0, 6).join('\n').slice(0, 800)}`,
  ].filter(Boolean).join('\n');
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch { /* nothing else to do */ }
  return res.status(204).end();
}
