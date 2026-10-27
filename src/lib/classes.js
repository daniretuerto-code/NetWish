// Classes: a weekly timetable in restaurant_settings.profile.clases
// [{ id, name, days: [1, 3], time: '19:00', min: 60, plazas: 12, teacher, level }].
// A place is a booking "Reserva clase: Vinyasa · con Marta · 1 plaza" at "19:00 - 20:00".
import { minutesToTime, normalize, timeToMinutes } from './format.js';
import { dayOfWeek } from './booking.js';

export const classEnd = (c) => minutesToTime(timeToMinutes(c.time) + (Number(c.min) || 60));

export const classesOn = (classes, iso) => {
  const dow = dayOfWeek(iso);
  return (classes || []).filter((c) => (c.days || []).map(Number).includes(dow)).sort((a, b) => a.time.localeCompare(b.time));
};

export const classItems = (c, note) => [`Reserva clase: ${c.name}`, c.teacher && `con ${c.teacher}`, '1 plaza', note?.trim() && `Nota: ${note.trim().slice(0, 160)}`].filter(Boolean).join(' · ');

const classOf = (items) => normalize(String(items || '').replace(/^Reserva clase:\s*/i, '').split(' · ')[0]);
export const isClassBooking = (o) => /^Reserva clase:/i.test(o?.items || '');

// Places taken in one class on that day, from bookings or the public list of busy slots.
export const takenIn = (busy, c, cancelled = []) => busy.filter((b) => isClassBooking(b) && classOf(b.items) === normalize(c.name)
  && String(b.time || '').split(' - ')[0] === c.time && !cancelled.includes(b.status)).length;

export const DAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
