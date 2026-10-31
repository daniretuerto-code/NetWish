import { supabaseRest } from './_lib.js';

// Push notifications to the owner's phone or computer (the panel asks for permission once).
// Needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel; without them nothing is sent.
export async function pushToBusiness(orderId, { title, body, url = '/panel/reservas' }) {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return 0;
  const { default: webpush } = await import('web-push');
  webpush.setVapidDetails('mailto:hola@netwish.es', pub.trim(), priv.trim());
  const targets = await supabaseRest('rpc/push_targets', { method: 'POST', body: { p_order: orderId } }).catch(() => []);
  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  await Promise.all((targets || []).map(async (t) => {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: t.keys }, payload, { TTL: 3600, urgency: 'high' });
      sent += 1;
    } catch (e) {
      // The phone unsubscribed or the browser forgot it: stop trying.
      if (e.statusCode === 404 || e.statusCode === 410) {
        await supabaseRest('rpc/forget_push', { method: 'POST', body: { p_endpoint: t.endpoint } }).catch(() => {});
      }
    }
  }));
  return sent;
}
