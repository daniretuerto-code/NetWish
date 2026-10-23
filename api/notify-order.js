import { emailLayout, escapeHtml, euro, sendEmail, SITE_URL, supabaseRest } from './_lib.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escapeLike = (s) => String(s || '').replace(/[\\%_*]/g, (c) => `\\${c}`);

// Beat masters bought in this order, looked up from the shop's own catalogue.
async function downloadLinks(order) {
  const products = await supabaseRest(
    `products?select=name,full_audio_url&full_audio_url=not.is.null&business_id=ilike.${encodeURIComponent(escapeLike(order.business_name))}`,
  ).catch(() => []);
  const bought = String(order.items || '').toLowerCase();
  return (products || [])
    .filter((p) => p.full_audio_url && bought.includes(String(p.name).toLowerCase()))
    .map((p) => ({
      name: p.name,
      url: `${SITE_URL}/api/download?url=${encodeURIComponent(p.full_audio_url)}&filename=${encodeURIComponent(`${p.name}.mp3`)}`,
    }));
}

const row = (label, value) =>
  `<tr><td style="color:#6B6862;padding:6px 0">${escapeHtml(label)}</td><td style="text-align:right;font-weight:600;padding:6px 0">${escapeHtml(value)}</td></tr>`;

function summary(order) {
  return `<table style="width:100%;border-collapse:collapse;font-size:15px">
    ${row('Comercio', order.business_name)}
    ${row('Detalle', order.items)}
    ${row('Fecha', `${order.date} · ${order.time}`)}
    ${Number(order.total) > 0 ? row('Total', euro(order.total)) : ''}
  </table>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { orderId, kind = 'created' } = req.body || {};
  if (!UUID.test(String(orderId)) || !['created', 'confirmed'].includes(kind)) {
    return res.status(400).json({ error: 'Petición no válida' });
  }

  try {
    const auth = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization : undefined;
    // One-shot: the database hands out each notification only once.
    const order = await supabaseRest('rpc/claim_order_notification', {
      method: 'POST',
      body: { p_order: orderId, p_kind: kind },
      authorization: auth,
    });
    if (!order) return res.status(200).json({ sent: false });

    const reservation = /reserva/i.test(order.items) || /aprobaci/i.test(order.status);

    if (kind === 'confirmed') {
      await sendEmail({
        to: order.customer_email,
        subject: `Reserva confirmada en ${order.business_name}`,
        html: emailLayout('¡Tu reserva está confirmada!', `<p>Hola ${escapeHtml(order.customer)}, ${escapeHtml(order.business_name)} te espera.</p>${summary(order)}`),
      });
      return res.status(200).json({ sent: true });
    }

    const links = reservation ? [] : await downloadLinks(order);
    const linksHtml = links.length
      ? `<p style="margin-top:18px;font-weight:700">Tus descargas</p>${links.map((l) => `<p><a href="${escapeHtml(l.url)}" style="display:inline-block;background:#111;color:#D4F25C;padding:12px 18px;border-radius:20px;text-decoration:none;font-weight:700">Descargar ${escapeHtml(l.name)}</a></p>`).join('')}`
      : '';

    await Promise.all([
      sendEmail({
        to: order.customer_email,
        subject: reservation ? `Solicitud de reserva en ${order.business_name}` : `Tu pedido en ${order.business_name}`,
        html: emailLayout(
          reservation ? 'Hemos recibido tu solicitud' : 'Gracias por tu pedido',
          `<p>${reservation ? 'El restaurante la confirmará en breve y te avisaremos por correo.' : 'Aquí tienes el resumen.'}</p>${summary(order)}${linksHtml}`,
        ),
      }),
      sendEmail({
        to: order.business_email,
        subject: reservation ? `Nueva reserva: ${order.customer}` : `Nuevo pedido: ${order.customer}`,
        html: emailLayout(
          reservation ? 'Nueva solicitud de reserva' : 'Nuevo pedido',
          `${summary(order)}${order.customer_email ? `<p>Cliente: ${escapeHtml(order.customer)} · ${escapeHtml(order.customer_email)}</p>` : ''}<p><a href="${SITE_URL}/panel/pedidos">Abrir el panel</a></p>`,
        ),
      }),
    ]);
    return res.status(200).json({ sent: true });
  } catch (error) {
    console.error('notify-order', error);
    return res.status(500).json({ error: 'No se pudo enviar el aviso' });
  }
}
