// E-mails shared by the panel's /api/remind and the hourly /api/cron.
import { button, calendarButtons, emailLayout, escapeHtml, euro, sendEmail, SITE_URL } from './_lib.js';

export function sendReminder(o) {
  const link = `${SITE_URL}/reserva/${o.token}`;
  const start = String(o.time).split(' - ')[0];
  // o.second: same-day nudge for someone who has not answered the first one.
  const title = o.second ? `Hoy a las ${start}, ¿sigues viniendo?` : `Mañana a las ${start}`;
  return sendEmail({
    to: o.customer_email,
    subject: o.second ? `¿Sigues viniendo hoy a ${o.business_name}?` : `Mañana te esperamos en ${o.business_name} a las ${start}`,
    html: emailLayout(
      title,
      `<p>Hola ${escapeHtml(o.customer)}, ${o.second ? 'tienes mesa hoy' : 'te recordamos tu reserva'} en <strong>${escapeHtml(o.business_name)}</strong>.</p>
       <p style="font-size:15px;color:#6B6862">${escapeHtml(o.items)}</p>
       <p>${button(`${link}?r=si`, 'Sí, allí estaré', true)}${button(`${link}?r=no`, 'No puedo ir')}</p>
       ${o.second && o.release ? '<p style="font-size:14px;font-weight:700">Si no nos confirmas, liberaremos la mesa hora y media antes para otra persona.</p>' : ''}
       <p style="font-size:13px;color:#6B6862">¿Necesitas otra hora o sois más? <a href="${link}?r=cambiar" style="color:#111;font-weight:700">Cambiar la reserva</a>. Si no puedes ir, avísanos y la mesa quedará libre para otra persona.</p>
       ${o.second ? '' : calendarButtons(o)}`,
    ),
  });
}

// The table was freed because nobody confirmed (only restaurants that chose it).
export function sendReleased(o) {
  return sendEmail({
    to: o.customer_email,
    subject: `Hemos liberado tu mesa en ${o.business_name}`,
    html: emailLayout(
      'Tu mesa ha quedado libre',
      `<p>Hola ${escapeHtml(o.customer)}, como no nos confirmaste la reserva de hoy a las ${escapeHtml(String(o.time).split(' - ')[0])} en <strong>${escapeHtml(o.business_name)}</strong>, la hemos liberado para otra persona.</p>
       <p>Si aun así queréis venir, llama al restaurante o vuelve a reservar si queda hueco.</p>
       <p>${button(`${SITE_URL}/negocio/${encodeURIComponent(o.business_name)}?reservar=1`, 'Volver a reservar', true)}</p>`,
    ),
  });
}

// The one-minute survey the day after. Each number is a link: one tap and it is saved.
export function sendReviewRequest(o) {
  // Before the survey existed in the database: the plain Google review request.
  if (!o.token) return o.review_url ? sendGoogleReview(o, o.review_url) : Promise.resolve(false);
  const link = (n) => `${SITE_URL}/opinion/${o.token}?n=${n}`;
  const faces = [1, 2, 3, 4, 5].map((n) => `<a href="${link(n)}" style="display:inline-block;width:44px;height:44px;line-height:44px;margin:0 4px 6px 0;border-radius:14px;text-align:center;font-weight:800;font-size:18px;text-decoration:none;${n >= 4 ? 'background:#111;color:#D4F25C' : 'background:#F2F0EB;color:#111'}">${n}</a>`).join('');
  return sendEmail({
    to: o.customer_email,
    subject: `¿Qué tal en ${o.business_name}?`,
    html: emailLayout(
      `Gracias por venir, ${o.customer}`,
      `<p>¿Qué tal lo pasaste ayer en <strong>${escapeHtml(o.business_name)}</strong>? Toca una nota del 1 al 5, es solo un segundo.</p>
       <p style="margin:14px 0 4px">${faces}</p>
       <p style="font-size:12px;color:#6B6862;margin:0">1 = mal · 5 = genial</p>`,
    ),
  });
}

function sendGoogleReview(o, reviewUrl) {
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

// A low score goes straight to the owner, not to Google.
export function sendBadRating(o) {
  const day = new Date(`${o.date}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
  return sendEmail({
    to: o.business_email,
    subject: `Un cliente puntuó ${o.rating}/5 su visita del ${day}`,
    html: emailLayout(
      `${o.customer} os ha puesto un ${o.rating}`,
      `<p>Nos lo ha contado a nosotros en lugar de dejarlo en Google, así que aún estás a tiempo de arreglarlo.</p>
       ${o.rating_comment ? `<p style="background:#F2F0EB;border-radius:14px;padding:12px 14px;font-size:15px">«${escapeHtml(o.rating_comment)}»</p>` : ''}
       <p style="font-size:14px">${[o.phone && `Teléfono: <strong>${escapeHtml(o.phone)}</strong>`, o.customer_email && `Correo: <strong>${escapeHtml(o.customer_email)}</strong>`].filter(Boolean).join(' · ')}</p>
       <p style="font-size:13px;color:#6B6862">Una llamada o un correo para disculparte suele convertir a un cliente enfadado en uno fiel.</p>
       <p>${button(`${SITE_URL}/panel/clientes`, 'Ver en mi panel', true)}</p>`,
    ),
  });
}

const optoutLink = (business, email, sig) =>
  `${SITE_URL}/baja?n=${encodeURIComponent(business)}&e=${encodeURIComponent(email)}&s=${sig}`;

const optoutFooter = (business, email, sig) =>
  `<p style="font-size:11px;color:#6B6862;margin-top:18px">Recibes este correo porque has reservado en ${escapeHtml(business)}. <a href="${optoutLink(business, email, sig)}" style="color:#6B6862">No quiero recibir más</a>.</p>`;

// A campaign the restaurant writes: plain text, an optional offer and a booking button.
export function campaignEmail({ business, username, subject, body, offer }, r) {
  const book = `${SITE_URL}/${username ? `r/${encodeURIComponent(username)}` : `negocio/${encodeURIComponent(business)}?reservar=1`}`;
  const text = escapeHtml(String(body).replace(/\{nombre\}/gi, r.name || '')).replace(/\n/g, '<br>');
  return {
    from: `${business.replace(/[<>"]/g, '')} vía NetWish <notificaciones@netwish.es>`,
    to: [r.email],
    subject,
    headers: { 'List-Unsubscribe': `<${optoutLink(business, r.email, r.sig)}>` },
    html: emailLayout(subject, `<p style="font-size:16px;line-height:1.5">${text}</p>
      ${offer ? `<p style="background:#D4F25C;border-radius:16px;padding:14px 16px;font-weight:800;font-size:17px">${escapeHtml(offer)}</p>` : ''}
      <p>${button(book, 'Reservar mesa', true)}</p>${optoutFooter(business, r.email, r.sig)}`),
  };
}

// Birthdays a week ahead, for restaurants that switched it on.
export function sendBirthday(o) {
  const book = `${SITE_URL}/${o.username ? `r/${encodeURIComponent(o.username)}` : `negocio/${encodeURIComponent(o.business_name)}?reservar=1`}`;
  return sendEmail({
    to: o.email,
    subject: `Tu cumpleaños se acerca 🎂 ${o.business_name} quiere celebrarlo contigo`,
    html: emailLayout(
      `¡Feliz cumpleaños${o.name ? `, ${o.name}` : ''}!`,
      `<p>En <strong>${escapeHtml(o.business_name)}</strong> sabemos que tu cumpleaños es la semana que viene y nos encantaría celebrarlo contigo.</p>
       ${o.offer ? `<p style="background:#D4F25C;border-radius:16px;padding:14px 16px;font-weight:800;font-size:17px">${escapeHtml(o.offer)}</p>` : ''}
       <p>${button(book, 'Reservar mesa', true)}</p>${optoutFooter(o.business_name, o.email, o.sig)}`,
    ),
  });
}

// Average spend per person from the questionnaire, for the money estimate.
const TICKET = { '€': 12, '€€': 22, '€€€': 40, '€€€€': 60 };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// The 1st of each month: what NetWish did for the restaurant last month.
export function sendMonthly(m) {
  const n = m.now || {};
  const before = m.before || {};
  const ticket = Number(m.ticket) || TICKET[m.precio] || 20;
  const money = (n.online_diners || 0) * ticket;
  const month = MONTHS[Number(String(m.month).slice(5, 7)) - 1] || '';
  const diff = before.online_diners ? Math.round(((n.online_diners - before.online_diners) / before.online_diners) * 100) : null;
  const tile = (value, label) => `<td style="width:50%;padding:6px"><div style="background:#F2F0EB;border-radius:18px;padding:14px"><div style="font-size:26px;font-weight:800;letter-spacing:-0.02em">${value}</div><div style="font-size:13px;color:#6B6862">${label}</div></div></td>`;
  const lines = [
    n.night && `<strong>${n.night}</strong> reservas llegaron con el local cerrado (de 23:00 a 9:00), sin coger el teléfono.`,
    n.confirmed && `<strong>${n.confirmed}</strong> clientes confirmaron su visita desde el recordatorio.`,
    m.waitlist && `<strong>${m.waitlist}</strong> personas de la lista de espera recibieron aviso de mesa libre.`,
    n.cancelled_notice && `<strong>${n.cancelled_notice}</strong> cancelaciones avisadas a tiempo, mesas que pudiste volver a llenar.`,
    n.new_customers && `<strong>${n.new_customers}</strong> clientes nuevos que nunca habían venido.`,
    n.ratings && `Nota media de tus clientes: <strong>${n.rating} / 5</strong> (${n.ratings} opiniones).`,
  ].filter(Boolean);
  return sendEmail({
    to: m.email,
    subject: `${m.business_name}: lo que NetWish te trajo en ${month}`,
    html: emailLayout(
      `Tu ${month} con NetWish`,
      `<p>Así fue el mes en <strong>${escapeHtml(m.business_name)}</strong>:</p>
       <div style="background:#111;color:#fff;border-radius:22px;padding:18px 20px;margin:12px 0">
         <div style="color:#D4F25C;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Reservado por NetWish</div>
         <div style="font-size:40px;font-weight:800;letter-spacing:-0.03em">${n.online_diners || 0} comensales</div>
         <div style="opacity:.8">≈ ${euro(money)} en mesas · ${n.online || 0} reservas${diff !== null ? ` · ${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)} % que el mes anterior` : ''}</div>
       </div>
       <table style="width:100%;border-collapse:collapse"><tr>${tile(n.diners || 0, 'comensales en total')}${tile(n.no_shows || 0, 'no vinieron')}</tr></table>
       ${lines.length ? `<ul style="padding-left:18px;line-height:1.6">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}
       <p style="font-size:12px;color:#6B6862">El dinero es una estimación: comensales que reservaron por NetWish y vinieron × ${euro(ticket)} de gasto medio por persona.</p>
       <p>${button(`${SITE_URL}/panel/numeros`, 'Ver todos mis datos', true)}</p>`,
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
