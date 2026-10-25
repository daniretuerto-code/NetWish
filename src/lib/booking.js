import { minutesToTime, timeToMinutes, todayISO } from './format.js';

export const SLOT_STEP = 15;
export const DEFAULT_SERVICE_MIN = 30;
export const WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

// Hair length changes how long colour or a blow-dry takes. Each service says how
// many extra minutes long hair needs; medium hair takes half of that.
export const HAIR_LENGTHS = [
  { key: 'corto', label: 'Corto', factor: 0 },
  { key: 'medio', label: 'Media melena', factor: 0.5 },
  { key: 'largo', label: 'Largo', factor: 1 },
];

export const serviceMinutes = (service, hair = 'corto') => {
  const base = Number(service.duration_min) || DEFAULT_SERVICE_MIN;
  const factor = HAIR_LENGTHS.find((h) => h.key === hair)?.factor || 0;
  const extra = Math.round(((Number(service.extra_long_min) || 0) * factor) / 5) * 5;
  return base + extra;
};

export const dayOfWeek = (iso) => new Date(`${iso}T12:00:00`).getDay();

export const isClosed = (settings, iso) => (settings?.closed_days || []).includes(dayOfWeek(iso));

export function nextDays(count = 14) {
  const out = [];
  const start = new Date(`${todayISO()}T12:00:00`);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    out.push({ iso, day: d.getDate(), weekday: i === 0 ? 'Hoy' : WEEKDAYS[d.getDay()] });
  }
  return out;
}

// Bookings are stored as "Reserva cita: Corte + Tinte (1 h 30 min) · con Laura"
// with a time like "10:00 - 11:30".
export function parseBooking(b) {
  const range = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(b.time || '');
  if (!range) return null;
  const staff = /· con ([^·]+?)\s*(?:·|$)/.exec(b.items || '');
  return { start: timeToMinutes(range[1]), end: timeToMinutes(range[2]), staff: staff ? staff[1].trim() : null };
}

// Who is free for [start, start + minutes). With no team set up the salon is one chair.
export function freeStaff(bookings, staff, start, minutes) {
  const end = start + minutes;
  const overlapping = bookings.map(parseBooking).filter((b) => b && b.start < end && start < b.end);
  if (!staff.length) return overlapping.length ? [] : [''];
  const names = staff.map((s) => s.name);
  const taken = new Set(overlapping.map((b) => b.staff));
  const unassigned = overlapping.filter((b) => !names.includes(b.staff)).length;
  const free = names.filter((n) => !taken.has(n));
  return free.slice(0, Math.max(0, free.length - unassigned));
}

// Start times where the whole appointment fits inside one opening shift.
export function serviceSlots(settings, date, minutes, bookings, staffName) {
  if (!minutes || isClosed(settings, date)) return [];
  const now = new Date();
  const earliest = date === todayISO() ? now.getHours() * 60 + now.getMinutes() + 30 : 0;
  const shifts = [[settings.lunch_start, settings.lunch_end], [settings.dinner_start, settings.dinner_end]]
    .filter(([a, b]) => a && b)
    .map(([a, b]) => [timeToMinutes(a), timeToMinutes(b)]);
  const out = [];
  for (const [open, close] of shifts) {
    for (let s = open; s + minutes <= close; s += SLOT_STEP) {
      if (s < earliest) continue;
      const free = freeStaff(bookings, settings.staff || [], s, minutes);
      const ok = staffName ? free.includes(staffName) : free.length > 0;
      out.push({ time: minutesToTime(s), free: ok, staff: staffName || free[0] || '' });
    }
  }
  return out;
}
