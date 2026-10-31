// Holidays in Palencia city: national, Castilla y León and local (San Antolín).
// Moved holidays change each year: check the official BOCYL calendar.
function easter(y) {
  const a = y % 19; const b = Math.floor(y / 100); const c = y % 100;
  const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
const iso = (d) => d.toISOString().slice(0, 10);
const plus = (d, n) => new Date(d.getTime() + n * 864e5);

export function palenciaHolidays(year) {
  const e = easter(year);
  const fixed = [
    ['01-01', 'Año Nuevo'], ['01-06', 'Reyes'], ['04-23', 'Villalar (Castilla y León)'], ['05-01', 'Día del Trabajo'],
    ['08-15', 'Asunción'], ['09-02', 'San Antolín (Palencia)'], ['10-12', 'Fiesta Nacional'], ['11-01', 'Todos los Santos'],
    ['12-06', 'Constitución'], ['12-08', 'Inmaculada'], ['12-25', 'Navidad'],
  ].map(([md, name]) => ({ date: `${year}-${md}`, name }));
  return [...fixed, { date: iso(plus(e, -3)), name: 'Jueves Santo' }, { date: iso(plus(e, -2)), name: 'Viernes Santo' }]
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function upcomingHolidays(fromISO, months = 12) {
  const y = Number(fromISO.slice(0, 4));
  const until = iso(new Date(Date.parse(`${fromISO}T00:00:00Z`) + months * 30.5 * 864e5));
  return [...palenciaHolidays(y), ...palenciaHolidays(y + 1)].filter((h) => h.date >= fromISO && h.date <= until);
}
