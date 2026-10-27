import { timeToMinutes } from './format.js';

export const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// Monday first, as a Spanish week reads.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

// The opening shifts of a day: comidas and cenas, or mañanas and tardes for salons.
export function shiftsOf(settings) {
  return [
    settings?.lunch_start && settings?.lunch_end && { from: settings.lunch_start, to: settings.lunch_end },
    settings?.dinner_start && settings?.dinner_end && { from: settings.dinner_start, to: settings.dinner_end },
  ].filter(Boolean);
}

const closedOn = (settings, weekday) => (settings?.closed_days || []).includes(weekday);

// "Abierto · cierra a las 16:00", "Cerrado · abre a las 20:30", "Cerrado · abre el jueves a las 13:00".
export function openState(settings, now = new Date()) {
  const shifts = shiftsOf(settings);
  if (!shifts.length) return null;
  const today = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (!closedOn(settings, today)) {
    for (const s of shifts) {
      const from = timeToMinutes(s.from);
      let to = timeToMinutes(s.to);
      if (to <= from) to += 24 * 60;
      if (mins >= from && mins < to) {
        const soon = to - mins <= 45;
        return { open: true, soon, label: soon ? `Cierra pronto · ${s.to}` : `Abierto · cierra a las ${s.to}` };
      }
    }
    const next = shifts.find((s) => timeToMinutes(s.from) > mins);
    if (next) return { open: false, label: `Cerrado · abre a las ${next.from}` };
  }
  for (let i = 1; i <= 7; i += 1) {
    const day = (today + i) % 7;
    if (closedOn(settings, day)) continue;
    const when = i === 1 ? 'mañana' : `el ${DAY_NAMES[day]}`;
    return { open: false, label: `Cerrado · abre ${when} a las ${shifts[0].from}` };
  }
  return { open: false, label: 'Cerrado' };
}

// One row per day, Monday to Sunday: "13:00 – 16:00 · 20:30 – 23:30" or "Cerrado".
export function weekHours(settings) {
  const shifts = shiftsOf(settings);
  const today = new Date().getDay();
  return WEEK.map((d) => ({
    day: DAY_NAMES[d].charAt(0).toUpperCase() + DAY_NAMES[d].slice(1),
    today: d === today,
    text: closedOn(settings, d) || !shifts.length ? 'Cerrado' : shifts.map((s) => `${s.from} – ${s.to}`).join(' · '),
  }));
}

export const mapsUrl = (biz) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${biz.name}${biz.address ? `, ${biz.address}` : ''}, Palencia`)}`;
