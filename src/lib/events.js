import { todayISO } from './format.js';

// A restaurant's events from today on, soonest first.
export const upcomingEvents = (list) => (Array.isArray(list) ? list : [])
  .filter((e) => e && e.title && e.date >= todayISO())
  .sort((a, b) => a.date.localeCompare(b.date));

// Events in the next `days` days, for "Hoy en Palencia".
export function eventsWithin(list, days = 7) {
  const end = new Date(`${todayISO()}T12:00:00`);
  end.setDate(end.getDate() + days);
  const last = end.toISOString().slice(0, 10);
  return upcomingEvents(list).filter((e) => e.date <= last);
}

export const eventDay = (iso) => {
  if (iso === todayISO()) return 'Hoy';
  const s = new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// ---------- Eventos en Palencia ----------
// City plans (table city_events, written from /admin) and each business's own events,
// shown together on /eventos and on the home page.
export const EVENT_CATEGORIES = [
  { key: 'musica', label: 'Música', icon: 'music' },
  { key: 'gastronomia', label: 'Gastronomía', icon: 'utensils' },
  { key: 'fiestas', label: 'Fiestas y tradición', icon: 'sparkle' },
  { key: 'mercados', label: 'Mercados y ferias', icon: 'basket' },
  { key: 'cultura', label: 'Cultura', icon: 'book' },
  { key: 'deporte', label: 'Deporte', icon: 'dumbbell' },
  { key: 'ninos', label: 'Para niños', icon: 'heart' },
  { key: 'negocios', label: 'Novedades de negocios', icon: 'store' },
];
export const eventCategory = (key) => EVENT_CATEGORIES.find((c) => c.key === key) || EVENT_CATEGORIES.at(-1);

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// An event that lasts several days (fiestas, a fair) is "on" every day until it ends.
const lastDay = (e) => (e.end_date && e.end_date > e.date ? e.end_date : e.date);

export const WHEN_FILTERS = [
  { key: 'todo', label: 'Próximos' },
  { key: 'hoy', label: 'Hoy' },
  { key: 'finde', label: 'Este finde' },
  { key: 'semana', label: 'Esta semana' },
];

export function inWhen(e, when) {
  const today = todayISO();
  if (when === 'hoy') return e.date <= today && lastDay(e) >= today;
  if (when === 'semana') return e.date <= addDays(today, 7) && lastDay(e) >= today;
  if (when === 'finde') {
    const dow = new Date(`${today}T12:00:00`).getDay();
    // From Friday to Sunday of this week (on Sunday, just today).
    const fri = dow === 0 ? today : addDays(today, Math.max(0, 5 - dow));
    const sun = dow === 0 ? today : addDays(today, 7 - dow);
    return e.date <= sun && lastDay(e) >= fri;
  }
  return lastDay(e) >= today;
}

// One list, soonest first: { id, title, date, end_date, time, place, category, text, price, image, biz, link }.
export function mergeEvents(cityEvents, places) {
  const city = (cityEvents || []).map((e) => ({
    id: `c-${e.id}`, title: e.title, date: e.date, end_date: e.end_date, time: e.time, place: e.place,
    category: e.category, text: e.description, price: e.price, image: e.image_url, link: e.link,
    bizName: e.business_name || null,
  }));
  const own = (places || []).flatMap(({ biz, settings }) => upcomingEvents(settings?.profile?.eventos).map((e) => ({
    id: `b-${biz.username}-${e.id}`, title: e.title, date: e.date, time: e.time, place: biz.name,
    category: e.category || 'negocios', text: e.text, price: e.price, image: e.image || biz.cover_url, biz,
  })));
  return [...city, ...own].filter((e) => e.title && lastDay(e) >= todayISO())
    .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));
}

export function eventWhen(e) {
  const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const range = e.end_date && e.end_date > e.date ? `Del ${day(e.date)} al ${day(e.end_date)}` : eventDay(e.date) === 'Hoy' ? 'Hoy' : day(e.date);
  return [range.charAt(0).toUpperCase() + range.slice(1), e.time].filter(Boolean).join(' · ');
}

// "Añadir al calendario": a small .ics made in the browser.
export function downloadEventIcs(e) {
  const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const ymd = (iso) => iso.replace(/-/g, '');
  const hm = /^(\d{1,2}):(\d{2})/.exec(e.time || '');
  const start = hm ? `DTSTART;TZID=Europe/Madrid:${ymd(e.date)}T${hm[1].padStart(2, '0')}${hm[2]}00` : `DTSTART;VALUE=DATE:${ymd(e.date)}`;
  const end = hm ? null : `DTEND;VALUE=DATE:${ymd(addDays(lastDay(e), 1))}`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NetWish//Eventos//ES', 'BEGIN:VEVENT',
    `UID:${e.id}@netwish.es`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`,
    start, end, `SUMMARY:${esc(e.title)}`, e.place && `LOCATION:${esc(`${e.place}, Palencia`)}`, e.text && `DESCRIPTION:${esc(e.text)}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].filter(Boolean).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  a.download = 'evento-netwish.ics';
  a.click();
  URL.revokeObjectURL(a.href);
}
