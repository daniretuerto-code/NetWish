import { bookingTimes, SITE_URL, supabaseRest } from './_lib.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// netwish.es/api/ics?t=<token>: the booking as a calendar file (iPhone, Outlook, Android).
export default async function handler(req, res) {
  const token = String(req.query?.t || '');
  if (!UUID.test(token)) return res.status(400).send('Enlace no válido');
  try {
    const b = await supabaseRest('rpc/respond_booking', { method: 'POST', body: { p_token: token, p_action: 'view' } });
    const times = b && bookingTimes(b.date, b.time);
    if (!times) return res.status(404).send('No encontramos esta reserva');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NetWish//Reservas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${token}@netwish.es`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Madrid:${times[0]}`,
      `DTEND;TZID=Europe/Madrid:${times[1]}`,
      `SUMMARY:${icsText(`Reserva en ${b.business_name}`)}`,
      `DESCRIPTION:${icsText(`${b.items}\n\nVer o cambiar: ${SITE_URL}/reserva/${token}`)}`,
      `LOCATION:${icsText(b.address ? `${b.address}, Palencia` : `${b.business_name}, Palencia`)}`,
      `URL:${SITE_URL}/reserva/${token}`,
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(`Reserva en ${b.business_name}`)}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR', '',
    ].join('\r\n');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reserva-netwish.ics"');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(ics);
  } catch (error) {
    console.error('ics', error);
    return res.status(500).send('No se pudo crear el calendario');
  }
}
