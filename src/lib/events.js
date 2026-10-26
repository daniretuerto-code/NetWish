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
