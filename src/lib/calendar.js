// "Add to calendar" links for a booking: Google Calendar, and the .ics file served by /api/ics.
const stamp = (date, t) => `${date.replace(/-/g, '')}T${t.split(':').map((n) => n.padStart(2, '0')).join('')}00`;

export function calendarLinks({ token, business_name, date, time, items, address }) {
  const [from, to] = String(time || '').split(' - ').map((t) => t.trim());
  if (!token || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{1,2}:\d{2}$/.test(from || '')) return null;
  const end = /^\d{1,2}:\d{2}$/.test(to || '') ? to : `${String(Number(from.split(':')[0]) + 1).padStart(2, '0')}:${from.split(':')[1]}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Reserva en ${business_name}`,
    dates: `${stamp(date, from)}/${stamp(date, end)}`,
    ctz: 'Europe/Madrid',
    details: `${String(items || '').split(' · Nota:')[0]}\n\nVer o cambiar: ${window.location.origin}/reserva/${token}`,
    location: address ? `${address}, Palencia` : `${business_name}, Palencia`,
  });
  return { google: `https://calendar.google.com/calendar/render?${params}`, ics: `/api/ics?t=${token}` };
}
