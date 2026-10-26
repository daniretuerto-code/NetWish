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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { orderId, kind = 'created' } = req.body || {};
  if (!UUID.test(String(orderId)) || !['created', 'confirmed', 'changed'].includes(kind)) {
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
    ]);
    return res.status(200).json({ sent: true });
  } catch (error) {
    console.error('notify-order', error);
    return res.status(500).json({ error: 'No se pudo enviar el aviso' });
  }
}
