// E-mails shared by the panel's /api/remind and the hourly /api/cron.
import { button, calendarButtons, emailLayout, escapeHtml, sendEmail, SITE_URL } from './_lib.js';

export function sendReminder(o) {
  const link = `${SITE_URL}/reserva/${o.token}`;
  const start = String(o.time).split(' - ')[0];
  return sendEmail({
    to: o.customer_email,
    subject: `Mañana te esperamos en ${o.business_name} a las ${start}`,
    html: emailLayout(
      `Mañana a las ${start}`,
      `<p>Hola ${escapeHtml(o.customer)}, te recordamos tu reserva en <strong>${escapeHtml(o.business_name)}</strong>.</p>
       <p style="font-size:15px;color:#6B6862">${escapeHtml(o.items)}</p>
       <p>${button(`${link}?r=si`, 'Sí, allí estaré', true)}${button(`${link}?r=no`, 'No puedo ir')}</p>
       <p style="font-size:13px;color:#6B6862">¿Necesitas otra hora o sois más? <a href="${link}?r=cambiar" style="color:#111;font-weight:700">Cambiar la reserva</a>. Si no puedes ir, avísanos y la mesa quedará libre para otra persona.</p>
       ${calendarButtons(o)}`,
    ),
  });
}

export function sendReviewRequest(o, reviewUrl) {
  return sendEmail({
    to: o.customer_email,
    subject: `¿Qué tal en ${o.business_name}?`,
    html: emailLayout(
      `Gracias por venir, ${o.customer}`,
      `<p>Esperamos que disfrutaras en <strong>${escapeHtml(o.business_name)}</strong>. Si te gustó, una reseña en Google les ayuda muchísimo.</p>
       <p>${button(escapeHtml(reviewUrl), 'Dejar una reseña', true)}</p>`,
    ),
  });
}

const longDay = (iso) => {
  const s = new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// A table came free on a day this person was waiting for. Whoever books first gets it.
export function sendWaitlistNotice(w) {
  const params = new URLSearchParams({ reservar: '1', dia: w.date, pax: String(w.guests || 2) });
  const link = `${SITE_URL}/negocio/${encodeURIComponent(w.business_name)}?${params}`;
  return sendEmail({
    to: w.email,
    subject: `¡Se ha liberado una mesa en ${w.business_name}!`,
    html: emailLayout(
      'Se ha liberado una mesa',
      `<p>Hola ${escapeHtml(w.name)}, estabas en la lista de espera de <strong>${escapeHtml(w.business_name)}</strong> para el ${escapeHtml(longDay(w.date))}${w.freed_time ? ` y acaba de quedar libre una mesa a las ${escapeHtml(w.freed_time)}` : ' y acaba de quedar una mesa libre'}.</p>
       <p>${button(link, `Reservar para ${w.guests || 2}`, true)}</p>
       <p style="font-size:13px;color:#6B6862">Avisamos a todos los que esperaban ese día, así que se la queda quien reserve antes.</p>`,
    ),
  });
}
