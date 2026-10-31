import { pushToBusiness } from './_push.js';
import { calendarButtons, emailLayout, escapeHtml, euro, sendEmail, SITE_URL, supabaseRest } from './_lib.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const row = (label, value) =>
  `<tr><td style="color:#6B6862;padding:6px 0">${escapeHtml(label)}</td><td style="text-align:right;font-weight:600;padding:6px 0">${escapeHtml(value)}</td></tr>`;

const manage = (order) => (order.token
  ? `<p><a href="${SITE_URL}/reserva/${order.token}" style="color:#111;font-weight:700">Ver, cambiar o cancelar mi reserva</a></p>`
  : '');

// Confirmed bookings also carry the "add to calendar" buttons.
const confirmedBody = (order, intro) => `<p>${intro}</p>${summary(order)}${calendarButtons(order)}${manage(order)}`;

function summary(order) {
  return `<table style="width:100%;border-collapse:collapse;font-size:15px">
    ${row('Comercio', order.business_name)}
    ${row('Detalle', order.items)}
    ${row('Fecha', `${order.date} · ${order.time}`)}
    ${Number(order.total) > 0 ? row('Precio orientativo', euro(order.total)) : ''}
  </table>`;
}

const PAY = { tarjeta: 'con tarjeta en la tienda', efectivo: 'en efectivo en la tienda', bizum: 'por Bizum al recoger' };

// Orders to pick up at a shop: what was ordered, the code and where to go.
function pickupSummary(order) {
  const lines = Array.isArray(order.lines) && order.lines.length
    ? order.lines.map((l) => `${l.qty}× ${l.name}${l.variant ? ` (${String(l.variant).split('|').join(' · ')})` : ''}`)
    : [String(order.items || '').replace(/^Pedido para recoger:\s*/i, '')];
  return `<table style="width:100%;border-collapse:collapse;font-size:15px">
    ${row('Tienda', order.business_name)}
    ${lines.map((l, i) => row(i ? '' : 'Pedido', l)).join('')}
    ${row('Recoger', `${order.date} · ${String(order.time || '').slice(0, 5)}`)}
    ${row('Total', euro(order.total))}
    ${row('Pago', PAY[order.payment] || 'en la tienda')}
    ${order.address ? row('Dirección', order.address) : ''}
  </table>`;
}
const codeBox = (code) => (code
  ? `<p style="margin:18px 0;text-align:center"><span style="display:inline-block;background:#D4FF3A;color:#111;font-size:28px;font-weight:800;letter-spacing:4px;padding:10px 22px;border-radius:14px">${escapeHtml(code)}</span><br><span style="color:#6B6862;font-size:13px">Enséñalo al recoger</span></p>`
  : '');

// The owner's business was approved in /admin: tell them it is live, with the way in.
async function approvedNotice(req, res, username) {
  const auth = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization : undefined;
  if (!auth || !username) return res.status(400).json({ error: 'Petición no válida' });
  const b = await supabaseRest('rpc/claim_approval_notice', { method: 'POST', body: { p_username: String(username).slice(0, 80) }, authorization: auth });
  if (!b?.email) return res.status(200).json({ sent: false });
  await sendEmail({
    to: b.email,
    subject: `${b.name} ya está en NetWish`,
    html: emailLayout('¡Tu negocio ya está publicado!', `<p>Hemos revisado ${escapeHtml(b.name)} y ya sale en NetWish. Tus clientes pueden encontrarte y reservar.</p>
      <p>Tu enlace para compartir en Instagram, Google y WhatsApp:<br><a href="${SITE_URL}/r/${encodeURIComponent(b.username)}" style="color:#111;font-weight:700">${SITE_URL.replace(/^https?:\/\//, '')}/r/${escapeHtml(b.username)}</a></p>
      <p><a href="${SITE_URL}/panel" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#111;color:#D4F25C;font-weight:700;text-decoration:none">Abrir mi panel</a></p>
      <p style="color:#6B6862;font-size:13px">¿Dudas? Responde a este correo o escríbenos por WhatsApp desde el panel.</p>`),
  });
  return res.status(200).json({ sent: true });
}

// A customer wrote in the chat: the business gets an e-mail (once every 30 minutes per conversation).
async function messageNotice(req, res, messageId) {
  const auth = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization : undefined;
  if (!auth || !/^\d+$/.test(String(messageId))) return res.status(400).json({ error: 'Petición no válida' });
  const m = await supabaseRest('rpc/claim_message_notice', { method: 'POST', body: { p_id: Number(messageId) }, authorization: auth });
  if (!m?.email) return res.status(200).json({ sent: false });
  await sendEmail({
    to: m.email,
    subject: `Mensaje nuevo de ${m.sender} en NetWish`,
    html: emailLayout('Tienes un mensaje nuevo', `<p><strong>${escapeHtml(m.sender)}</strong> te ha escrito:</p>
      <blockquote style="margin:12px 0;padding:12px 16px;background:#F2F0EB;border-radius:14px">${escapeHtml(m.text)}</blockquote>
      <p><a href="${SITE_URL}/panel/mensajes" style="color:#111;font-weight:700">Contestar desde el panel</a></p>`),
  });
  return res.status(200).json({ sent: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { orderId, kind = 'created' } = req.body || {};
  try {
    if (kind === 'approved') return await approvedNotice(req, res, req.body?.username);
    if (kind === 'message') return await messageNotice(req, res, req.body?.messageId);
  } catch (error) {
    console.error('notify', kind, error);
    return res.status(200).json({ sent: false });
  }
  if (!UUID.test(String(orderId)) || !['created', 'confirmed', 'changed', 'ready'].includes(kind)) {
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
    const pickup = /^Pedido para recoger/i.test(order.items || '') || !!order.pickup_code;

    if (kind === 'ready') {
      await sendEmail({
        to: order.customer_email,
        subject: `Tu pedido está listo en ${order.business_name}`,
        html: emailLayout('¡Tu pedido está listo!', `<p>Hola ${escapeHtml(order.customer)}, ya puedes pasar a recogerlo por ${escapeHtml(order.business_name)}.</p>${codeBox(order.pickup_code)}${pickupSummary(order)}`),
      });
      return res.status(200).json({ sent: true });
    }

    if (kind === 'created' && pickup) {
      await Promise.all([
        sendEmail({
          to: order.customer_email,
          subject: `Pedido recibido en ${order.business_name} · ${order.pickup_code || ''}`.trim(),
          html: emailLayout('Hemos recibido tu pedido', `<p>Hola ${escapeHtml(order.customer)}, ${escapeHtml(order.business_name)} te lo deja apartado. Te avisamos cuando esté listo. Pagas al recogerlo.</p>${codeBox(order.pickup_code)}${pickupSummary(order)}`),
        }),
        sendEmail({
          to: order.business_email,
          subject: `Nuevo pedido para recoger: ${order.customer}${order.pickup_code ? ` · ${order.pickup_code}` : ''}`,
          html: emailLayout('Nuevo pedido para recoger', `${pickupSummary(order)}<p>Cliente: ${escapeHtml(order.customer)}${order.customer_email ? ` · ${escapeHtml(order.customer_email)}` : ''}${order.phone ? ` · ${escapeHtml(order.phone)}` : ''}</p><p><a href="${SITE_URL}/panel/reservas">Abrir el panel</a></p>`),
        }),
       pushToBusiness(orderId, { title: `Pedido nuevo: ${order.customer}`, body: `${order.pickup_code ? `${order.pickup_code} · ` : ''}recoger ${order.date} ${String(order.time || '').slice(0, 5)}` }).catch(() => 0),
      ]);
      return res.status(200).json({ sent: true });
    }

    if (kind === 'confirmed') {
      await sendEmail({
        to: order.customer_email,
        subject: `Reserva confirmada en ${order.business_name}`,
        html: emailLayout('¡Tu reserva está confirmada!', confirmedBody(order, `Hola ${escapeHtml(order.customer)}, ${escapeHtml(order.business_name)} te espera.`)),
      });
      return res.status(200).json({ sent: true });
    }

    // The customer moved their booking from the e-mail link.
    if (kind === 'changed') {
      const ok = order.status === 'Mesa Confirmada';
      await Promise.all([
        sendEmail({
          to: order.customer_email,
          subject: ok ? `Reserva cambiada en ${order.business_name}` : `Hemos recibido tu cambio en ${order.business_name}`,
          html: ok
            ? emailLayout('Reserva cambiada', confirmedBody(order, `Hola ${escapeHtml(order.customer)}, ya está: ${escapeHtml(order.business_name)} te espera a la nueva hora.`))
            : emailLayout('Hemos recibido tu cambio', `<p>${escapeHtml(order.business_name)} lo confirmará en breve y te avisaremos por correo.</p>${summary(order)}${manage(order)}`),
        }),
        sendEmail({
          to: order.business_email,
          subject: `Reserva cambiada: ${order.customer}`,
          html: emailLayout(
            ok ? 'Un cliente ha cambiado su reserva' : 'Cambio de reserva por confirmar',
            `${summary(order)}<p>Cliente: ${escapeHtml(order.customer)}${order.customer_email ? ` · ${escapeHtml(order.customer_email)}` : ''}${order.phone ? ` · ${escapeHtml(order.phone)}` : ''}</p><p><a href="${SITE_URL}/panel/reservas">Abrir el panel</a></p>`,
          ),
        }),
      ]);
      return res.status(200).json({ sent: true });
    }

    // Only reservations are emailed; table orders go straight to the kitchen screen.
    if (!reservation) return res.status(200).json({ sent: false });

    // Bookings the database confirmed on the spot get a "confirmed" e-mail straight away.
    const instant = order.status === 'Mesa Confirmada';
    await Promise.all([
      sendEmail({
        to: order.customer_email,
        subject: instant ? `Reserva confirmada en ${order.business_name}` : `Solicitud de reserva en ${order.business_name}`,
        html: instant
          ? emailLayout('¡Tu reserva está confirmada!', confirmedBody(order, `Hola ${escapeHtml(order.customer)}, ${escapeHtml(order.business_name)} te espera. El día antes te mandaremos un recordatorio.`))
          : emailLayout(
            'Hemos recibido tu solicitud',
            `<p>${escapeHtml(order.business_name)} la confirmará en breve y te avisaremos por correo. El pago se hace en el local.</p>${summary(order)}${manage(order)}`,
          ),
      }),
      sendEmail({
        to: order.business_email,
        subject: instant ? `Reserva nueva confirmada: ${order.customer}` : `Nueva reserva por confirmar: ${order.customer}`,
        html: emailLayout(
          instant ? 'Reserva nueva (ya confirmada)' : 'Nueva solicitud de reserva',
          `${summary(order)}${order.customer_email ? `<p>Cliente: ${escapeHtml(order.customer)} · ${escapeHtml(order.customer_email)}${order.phone ? ` · ${escapeHtml(order.phone)}` : ''}</p>` : ''}<p><a href="${SITE_URL}/panel/reservas">Abrir el panel</a></p>`,
        ),
      }),
     pushToBusiness(orderId, {
        title: instant ? `Reserva nueva: ${order.customer}` : `Reserva por confirmar: ${order.customer}`,
        body: `${String(order.items || '').split(' · Nota:')[0]} · ${order.date} ${String(order.time || '').slice(0, 5)}`,
      }).catch(() => 0),
    ]);
    return res.status(200).json({ sent: true });
  } catch (error) {
    console.error('notify-order', error);
    return res.status(500).json({ error: 'No se pudo enviar el aviso' });
  }
}
