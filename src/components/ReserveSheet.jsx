import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, useToast } from './ui.jsx';
import Icon from './Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { bookingState, changeBooking, createGuestBooking, createOrder, joinWaitlist, reservationsOn, STATUS } from '../lib/data.js';
import { blockFor, slotShift, tableFits, tableLabel, tableMin, tablesIn } from '../lib/agenda.js';
import { joinPairs, zoneOf, zoneOpenAt, zonesOf } from '../lib/floor.js';
import { minutesToTime, timeToMinutes, todayISO } from '../lib/format.js';
import { isClosed } from '../lib/booking.js';
import { calendarLinks } from '../lib/calendar.js';
import { mapsUrl } from '../lib/hours.js';

export const DEFAULT_TABLES = [
  { table_number: 1, capacity: 2, zone: 'Sala Principal' },
  { table_number: 2, capacity: 4, zone: 'Sala Principal' },
  { table_number: 3, capacity: 6, zone: 'Sala Principal' },
];

const OCCASIONS = ['Cumpleaños', 'Aniversario', 'Trona para bebé', 'Silla de ruedas', 'Venimos con perro'];

export function slots(start, end, step = 30) {
  const out = [];
  if (!start || !end) return out;
  for (let m = timeToMinutes(start); m <= timeToMinutes(end) - 60; m += step) out.push(minutesToTime(m));
  return out;
}

// Existing bookings are stored as orders like "Reserva 4 pax — Mesa 3 (Terraza)" with time "21:00 - 22:30".
export function busyTables(bookings, start, duration) {
  const s = timeToMinutes(start);
  const e = s + duration;
  const busy = new Set();
  for (const b of bookings) {
    const tables = tablesIn(b.items);
    const range = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(b.time || '');
    if (!tables.length || !range) continue;
    const bs = timeToMinutes(range[1]);
    const be = timeToMinutes(range[2]);
    if (bs < e && s < be) tables.forEach((n) => busy.add(n));
  }
  return busy;
}

// People arriving within half an hour of `slot`, for the kitchen's capacity per time slot.
function arrivalsNear(bookings, slot) {
  const s = timeToMinutes(slot);
  return bookings.reduce((n, b) => {
    const start = /(\d{1,2}:\d{2})/.exec(b.time || '')?.[1];
    return start && Math.abs(timeToMinutes(start) - s) < 30 ? n + (Number(/(\d+)\s*pax/i.exec(b.items || '')?.[1]) || 0) : n;
  }, 0);
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
// While changing a booking its own table must not count as taken: drop it from that day's list once.
const withoutOwn = (list, own) => {
  const i = list.findIndex((b) => b.items === own.items && b.time === own.time);
  return i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 1)];
};

const shortDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

const longDay = (iso) => {
  if (iso === todayISO()) return 'Hoy';
  if (iso === addDays(todayISO(), 1)) return 'Mañana';
  const s = new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Name, e-mail and phone typed last time, so the next booking is two taps.
const GUEST_KEY = 'netwish.guest';
const BOOKINGS_KEY = 'netwish.bookings';
function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode: nothing to remember.
  }
}

// Bookings made without an account live in this browser, so "Reservas" can show them.
export const guestBookings = () => (readJSON(BOOKINGS_KEY, []) || []).filter((b) => b && b.token);
function rememberBooking(b) {
  writeJSON(BOOKINGS_KEY, [b, ...guestBookings().filter((x) => x.token !== b.token)].slice(0, 20));
}

// `initial` preselects day and party size (the waiting-list e-mail link); `change` turns the sheet
// into "move my booking" for the booking behind that token.
export default function ReserveSheet({ open, onClose, biz, settings, initial, change, onChanged }) {
  const { user, displayName } = useAuth();
  const toast = useToast();
  // Tables the restaurant keeps for walk-ins, or in a closed terrace, never show up online.
  const allTables = settings?.tables?.length ? settings.tables : DEFAULT_TABLES;
  const floorZones = zonesOf({ ...settings, tables: allTables });
  const zoneInfo = (name) => floorZones.find((z) => z.name === name);
  const tables = allTables.filter((t) => t.online !== false && zoneInfo(zoneOf(t))?.open !== false);
  const smallest = Math.min(...tables.map((t) => Number(t.capacity) || 2));
  // Two tables the owner marked as joinable seat a bigger group.
  const pairs = joinPairs(tables);
  const biggest = Math.max(0, ...tables.map((t) => Number(t.capacity) || 2), ...pairs.map(([a, b]) => Number(a.capacity) + Number(b.capacity)));
  // A party smaller than any table still gets one of the smallest.
  const fits = (t, g) => tableFits(t, g) || (g < tableMin(t) && Number(t.capacity) === smallest);
  const zones = [...new Set(tables.map(zoneOf))];
  const duration = settings?.turn_duration_min || 90;
  const rules = settings?.profile || {};
  const maxGuests = Number(rules.max_personas) || 20;
  const notice = Number(rules.aviso_min) || 30;
  const capacity = Number(rules.aforo_franja) || 0;
  const groupFrom = Number(rules.grupo_desde) || 0;
  const lastDay = addDays(todayISO(), Number(rules.dias_vista) || 60);

  const slotsFor = (day) => {
    const now = new Date();
    const block = blockFor(settings, day);
    if (isClosed(settings, day) || day > lastDay || block.todo) return [];
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startOf = (t) => new Date(`${day}T${t}:00`).getTime();
    return [...slots(settings.lunch_start, settings.lunch_end), ...slots(settings.dinner_start, settings.dinner_end)]
      .filter((t) => (day !== todayISO() || timeToMinutes(t) > nowMin) && startOf(t) - now.getTime() >= notice * 60000 && !block[slotShift(settings, t)]);
  };

  // Every bookable day from today to the last one the restaurant opens online.
  const days = useMemo(() => {
    const out = [];
    for (let d = todayISO(); d <= lastDay && out.length < 92; d = addDays(d, 1)) out.push(d);
    return out;
  }, [lastDay]);
  const validDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && d >= todayISO() && d <= lastDay;
  // Without a day asked for, start on the first one that still has times: never on a closed day.
  const firstOpenDay = () => days.find((d) => slotsFor(d).length) || todayISO();
  const startDay = [change?.date, initial?.date].find(validDay) || firstOpenDay();
  const startGuests = Number(/(\d+)\s*pax/i.exec(change?.items || '')?.[1]) || Number(initial?.guests) || 2;
  const startZone = /Mesas? [\d+]+ \(([^)]+)\)/.exec(change?.items || '')?.[1];
  const [date, setDate] = useState(startDay);
  const [guests, setGuests] = useState(Math.min(Math.max(1, startGuests), maxGuests));
  const [zone, setZone] = useState(zones.includes(startZone) ? startZone : zones[0]);
  const [time, setTime] = useState('');
  const [step, setStep] = useState(1);
  const [guest, setGuest] = useState(() => ({ name: '', email: '', phone: '', ...readJSON(GUEST_KEY, {}) }));
  const [occasions, setOccasions] = useState([]);
  const [extra, setExtra] = useState('');
  const [bookings, setBookings] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const stripRef = useRef(null);
  // An event on the restaurant's page reopens the sheet on its day; a guest count from the page comes along too.
  useEffect(() => {
    if (!open || change) return;
    if (validDay(initial?.date)) setDate(initial.date);
    if (Number(initial?.guests) > 0) setGuests(Math.min(Number(initial.guests), maxGuests));
  }, [open, initial?.date, initial?.guests]);
  useEffect(() => {
    if (open) setStep(1);
  }, [open]);
  // Keep the chosen day in view in the strip.
  useEffect(() => {
    if (!open) return;
    const el = stripRef.current?.querySelector('[aria-pressed="true"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [open, date]);

  // A group bigger than the restaurant's limit for instant bookings, or than any table, goes in as a request.
  const isGroup = guests > biggest || (groupFrom > 0 && guests >= groupFrom);

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setBookings(null);
    reservationsOn(biz.name, date)
      .then((list) => setBookings(change && date === change.date ? withoutOwn(list, change) : list))
      .catch(() => setBookings([]));
  }, [open, biz.name, date]);

  // The smallest free table that fits, or else two joinable tables together. Returns a list of tables.
  const tableFor = (list, slot) => {
    const busy = busyTables(list, slot, duration);
    const usable = (t) => (zones.length < 2 || zoneOf(t) === zone) && zoneOpenAt(zoneInfo(zoneOf(t)), slot) && !busy.has(Number(t.table_number));
    const single = tables.filter((t) => usable(t) && fits(t, guests)).sort((a, b) => a.capacity - b.capacity)[0];
    if (single) return [single];
    const pair = pairs
      .filter(([a, b]) => usable(a) && usable(b) && Number(a.capacity) + Number(b.capacity) >= guests && guests > Math.max(Number(a.capacity), Number(b.capacity)))
      .sort(([a, b], [c, d]) => (Number(a.capacity) + Number(b.capacity)) - (Number(c.capacity) + Number(d.capacity)))[0];
    return pair || null;
  };
  const isFree = (list, slot) => (!capacity || arrivalsNear(list, slot) + guests <= capacity)
    && (isGroup ? tables.some((t) => zoneOpenAt(zoneInfo(zoneOf(t)), slot)) : !!tableFor(list, slot));

  const daySlots = useMemo(() => slotsFor(date), [settings, date, notice, lastDay]);
  const freeSlots = bookings ? daySlots.filter((t) => isFree(bookings, t)) : [];
  const freeCount = bookings ? freeSlots.length : null;
  const byShift = (list, shift) => list.filter((t) => slotShift(settings, t) === shift);

  // Nothing free that day: look at the next week for the closest free times, lunch and dinner alike.
  useEffect(() => {
    setSuggestions(null);
    if (!open || freeCount !== 0) return;
    let alive = true;
    const next = Array.from({ length: 7 }, (_, i) => addDays(date, i + 1)).filter((d) => d <= lastDay && slotsFor(d).length);
    Promise.all(next.map((d) => reservationsOn(biz.name, d).then((list) => ({ d, list })).catch(() => ({ d, list: [] }))))
      .then((res) => {
        if (!alive) return;
        setSuggestions(res.map(({ d, list }) => {
          const free = slotsFor(d).filter((t) => isFree(list, t));
          return { d, times: [...byShift(free, 'comida').slice(0, 2), ...byShift(free, 'cena').slice(0, 2)] };
        }).filter((x) => x.times.length).slice(0, 3));
      });
    return () => { alive = false; };
  }, [open, freeCount, date, guests, zone]);

  const note = [...occasions, extra.trim()].filter(Boolean).join(', ').slice(0, 200);
  const where = zones.length > 1 && !isGroup ? zone : '';
  const summary = [longDay(date), time, `${guests} ${guests === 1 ? 'persona' : 'personas'}`, where].filter(Boolean).join(' · ');

  const submit = async () => {
    const table = isGroup ? null : tableFor(bookings || [], time);
    if (!isGroup && !table) {
      toast('Esa hora se acaba de ocupar. Elige otra.', 'error');
      setStep(1);
      setTime('');
      return;
    }
    setSaving(true);
    try {
      const end = minutesToTime(timeToMinutes(time) + duration);
      const what = `Reserva ${guests} pax — ${table ? tableLabel(table.map((t) => t.table_number), zoneOf(table[0])) : 'Grupo'}`;
      if (change) {
        // The note stays as it was; the database keeps it.
        const { status } = await changeBooking(change.token, { itemsText: what, date, time: `${time} - ${end}` });
        setDone({ kind: status === STATUS.CONFIRMED ? 'changed' : 'change-pending' });
        onChanged?.();
        return;
      }
      const itemsText = `${what}${note ? ` · Nota: ${note}` : ''}`;
      const base = { business: biz.name, itemsText, date, time: `${time} - ${end}` };
      let state;
      if (user) {
        const order = await createOrder({ ...base, user, items: [], total: 0, status: STATUS.PENDING, phone: guest.phone.trim().slice(0, 20) });
        state = await bookingState(order.id);
      } else {
        state = await createGuestBooking({ ...base, name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone.trim() });
        if (state?.token) rememberBooking({ token: state.token, business_name: biz.name, date, time: base.time, items: what, status: state.status });
      }
      writeJSON(GUEST_KEY, user ? { ...readJSON(GUEST_KEY, {}), phone: guest.phone.trim() } : { name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone.trim() });
      // The restaurant may confirm on the spot when the table is free.
      setDone({
        kind: state.status === STATUS.CONFIRMED ? 'confirmed' : 'pending',
        token: state.token,
        calendar: calendarLinks({ token: state.token, business_name: biz.name, date, time: base.time, items: what, address: biz.address }),
      });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const joinList = async (e) => {
    e.preventDefault();
    const shifts = [...new Set(daySlots.map((t) => slotShift(settings, t)))];
    try {
      await joinWaitlist({
        business_name: biz.name, date, shift: shifts.includes('cena') ? 'cena' : shifts[0] || 'cena', guests,
        name: (user ? displayName : guest.name).trim().slice(0, 60) || 'Cliente',
        phone: guest.phone.trim() || null, email: (user?.email || guest.email.trim()) || null,
      });
      setDone({ kind: 'waitlist' });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const share = async () => {
    const text = `He reservado en ${biz.name}: ${longDay(date).toLowerCase()} a las ${time}, ${guests} personas.`;
    const url = `${window.location.origin}/negocio/${encodeURIComponent(biz.name)}`;
    try {
      if (navigator.share) await navigator.share({ title: biz.name, text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast('Copiado. Pégalo en WhatsApp.');
      }
    } catch {
      // The person closed the share sheet.
    }
  };

  const email = user?.email || guest.email;
  const titles = { confirmed: 'Reserva confirmada', pending: 'Solicitud enviada', waitlist: 'Estás en la lista de espera', changed: 'Reserva cambiada', 'change-pending': 'Cambio enviado' };
  const kind = done?.kind;
  const closedDay = isClosed(settings, date);
  const pickTime = (t) => setTime(t);
  const chosenOk = time && freeSlots.includes(time);

  const timeGrid = (list) => (
    <div className="time-grid">
      {list.map((t) => (
        <button key={t} onClick={() => pickTime(t)} className="time-pill" aria-pressed={time === t}>{t}</button>
      ))}
    </div>
  );

  const shiftBlock = (shift, label) => {
    const all = byShift(daySlots, shift);
    if (!all.length) return null;
    const free = byShift(freeSlots, shift);
    return (
      <div className="stack" style={{ gap: 8 }}>
        <span className="row between"><span className="eyebrow">{label}</span>{!free.length && <span className="small muted" style={{ fontWeight: 600 }}>Completo</span>}</span>
        {free.length > 0 && timeGrid(free)}
      </div>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={titles[kind] || (change ? 'Cambiar reserva' : step === 2 ? 'Tus datos' : 'Reservar mesa')}>
      {done ? (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
          <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={30} stroke={3} /></span>
          {kind === 'confirmed' && (
            <>
              <p style={{ fontSize: 17, fontWeight: 700 }}>¡Tienes mesa en {biz.name}!</p>
              <p className="booking-summary">{summary}</p>
              <p className="muted">Te hemos mandado la confirmación a {email}. El día antes te recordaremos la reserva.</p>
              {done.calendar && <CalendarButtons links={done.calendar} />}
            </>
          )}
          {kind === 'pending' && (
            <>
              <p style={{ fontSize: 17, fontWeight: 700 }}>{biz.name} revisará tu {isGroup ? 'solicitud de grupo' : 'reserva'}</p>
              <p className="booking-summary">{summary}</p>
              <p className="muted">Te avisaremos en {email} cuando la confirme.</p>
            </>
          )}
          {kind === 'changed' && (
            <>
              <p style={{ fontSize: 17, fontWeight: 700 }}>Listo: {shortDay(date)} a las {time}</p>
              <p className="muted">{biz.name} ya tiene el cambio. Te lo hemos mandado también por correo.</p>
            </>
          )}
          {kind === 'change-pending' && (
            <>
              <p style={{ fontSize: 17, fontWeight: 700 }}>{biz.name} revisará el cambio</p>
              <p className="muted">Te avisaremos por correo cuando lo confirme.</p>
            </>
          )}
          {kind === 'waitlist' && <p className="muted">Si se libera una mesa{(user?.email || guest.email) ? ' te avisaremos por correo al momento' : `, ${biz.name} te avisará`}. Se la queda quien reserve antes.</p>}
          {(kind === 'confirmed' || kind === 'pending') && (
            <div className="row" style={{ gap: 8, width: '100%' }}>
              <a className="btn soft sm" style={{ flex: 1 }} href={mapsUrl(biz)} target="_blank" rel="noreferrer"><Icon name="pin" size={15} /> Cómo llegar</a>
              <button className="btn soft sm" style={{ flex: 1 }} onClick={share}><Icon name="share" size={15} /> Avisar a los tuyos</button>
            </div>
          )}
          {done.token && <a className="small" style={{ fontWeight: 700 }} href={`/reserva/${done.token}`}>Ver, cambiar o cancelar la reserva</a>}
          <button className="btn primary block" onClick={onClose}>Hecho</button>
        </div>
      ) : step === 2 && !change ? (
        <div className="stack">
          <button className="widget row between summary-card" onClick={() => setStep(1)}>
            <span className="stack" style={{ gap: 2, textAlign: 'left', minWidth: 0 }}>
              <span className="eyebrow">{biz.name}</span>
              <strong style={{ fontSize: 17 }}>{summary}</strong>
            </span>
            <span className="small" style={{ fontWeight: 800, flex: 'none' }}>Cambiar</span>
          </button>

          <div className="widget stack">
            {user ? (
              <span className="small muted">Reservas como <strong style={{ color: 'var(--ink)' }}>{displayName || user.email}</strong>. Te mandamos la confirmación a {user.email}.</span>
            ) : (
              <>
                <span className="small muted">Sin registrarte: solo tu nombre y tu correo para mandarte la confirmación.</span>
                <div className="field"><label htmlFor="g-name">Nombre</label><input id="g-name" className="input" autoComplete="name" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} /></div>
                <div className="field"><label htmlFor="g-mail">Correo</label><input id="g-mail" className="input" type="email" inputMode="email" autoComplete="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} /></div>
              </>
            )}
            <div className="field">
              <label htmlFor="resv-phone">Teléfono {user ? '(opcional)' : ''}</label>
              <input id="resv-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} placeholder="Por si el restaurante necesita llamarte" />
            </div>
          </div>

          <div className="widget stack">
            <span className="eyebrow">¿Algo que debamos saber?</span>
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              {OCCASIONS.map((o) => {
                const on = occasions.includes(o);
                return <button key={o} className={`chip ${on ? 'on' : ''}`} style={{ background: on ? undefined : 'var(--bg)' }} aria-pressed={on} onClick={() => setOccasions(on ? occasions.filter((x) => x !== o) : [...occasions, o])}>{o}</button>;
              })}
            </div>
            <input className="input" aria-label="Alergias u otras peticiones" maxLength={120} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Alergias u otras peticiones (opcional)" />
          </div>
          {rules.cancelacion && <p className="small muted" style={{ margin: '0 4px' }}>{rules.cancelacion}</p>}
          <div className="sheet-foot">
            <button className="btn primary block" disabled={saving || (!user && (guest.name.trim().length < 2 || !guest.email.includes('@')))} onClick={submit}>
              {saving ? 'Enviando…' : isGroup ? `Pedir mesa para ${guests} a las ${time}` : 'Confirmar reserva'}
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="widget stack">
            <div className="row between">
              <span className="eyebrow">Personas</span>
              <span className="row" style={{ gap: 8 }}>
                <button className="icon-btn" style={{ background: 'var(--bg)' }} disabled={guests <= 1} onClick={() => { setGuests((g) => Math.max(1, g - 1)); setTime(''); }} aria-label="Menos personas"><Icon name="minus" /></button>
                <span className="title-lg price" style={{ minWidth: 28, textAlign: 'center' }} aria-live="polite">{guests}</span>
                <button className="icon-btn" style={{ background: 'var(--bg)' }} disabled={guests >= maxGuests} onClick={() => { setGuests((g) => Math.min(maxGuests, g + 1)); setTime(''); }} aria-label="Más personas"><Icon name="plus" /></button>
              </span>
            </div>
            {isGroup && <p className="small" style={{ margin: 0, fontWeight: 600 }}>Para grupos de {guests} el restaurante prepara las mesas y te confirma la reserva.</p>}
            {guests >= maxGuests && (
              <p className="small muted" style={{ margin: 0 }}>¿Sois más de {maxGuests}? Llama a {biz.name}{biz.telefono ? ` al ${biz.telefono}` : ''}.</p>
            )}

            <span className="eyebrow" style={{ marginTop: 4 }}>Día</span>
            <div className="day-strip" ref={stripRef}>
              {days.map((d) => {
                const has = slotsFor(d).length > 0;
                const dt = new Date(`${d}T12:00:00`);
                const top = d === todayISO() ? 'Hoy' : d === addDays(todayISO(), 1) ? 'Mañana' : dt.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
                return (
                  <button key={d} className="day-pill" aria-pressed={date === d} disabled={!has} onClick={() => { setDate(d); setTime(''); setWaiting(false); }}
                    aria-label={`${longDay(d)}${has ? '' : ', sin horas'}`}>
                    <span className="wd">{top}</span>
                    <span className="dn">{dt.getDate()}</span>
                    <span className="mo">{has ? dt.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') : isClosed(settings, d) ? 'cerrado' : 'lleno'}</span>
                  </button>
                );
              })}
            </div>

            {zones.length > 1 && !isGroup && (
              <>
                <span className="eyebrow" style={{ marginTop: 4 }}>Zona</span>
                <div className="chips">
                  {zones.map((z) => {
                    const info = zoneInfo(z);
                    return (
                      <button key={z} className={`chip ${zone === z ? 'on' : ''}`} aria-pressed={zone === z} style={{ background: zone === z ? undefined : 'var(--bg)' }} onClick={() => { setZone(z); setTime(''); }}>
                        {info?.outdoor ? '☀︎ ' : ''}{z}{info?.from && info?.to ? ` · ${info.from}-${info.to}` : ''}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="widget stack" style={{ gap: 14 }}>
            {!bookings ? <div className="spinner" style={{ margin: '12px auto' }} /> : freeCount > 0 ? (
              <>
                {shiftBlock('comida', 'Comida')}
                {shiftBlock('cena', 'Cena')}
              </>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  {closedDay ? `${longDay(date)} ${biz.name} cierra.` : daySlots.length === 0 && !blockFor(settings, date).todo ? 'Ya no quedan horas para este día.' : `${longDay(date)} está completo para ${guests}.`}
                </p>
                {suggestions === null && <div className="spinner" style={{ margin: '4px auto' }} />}
                {suggestions?.length > 0 && (
                  <>
                    <span className="eyebrow">Hay sitio estos días</span>
                    <div className="chips" style={{ flexWrap: 'wrap' }}>
                      {suggestions.flatMap(({ d, times }) => times.map((t) => (
                        <button key={`${d}${t}`} className="chip" style={{ background: 'var(--accent)', color: 'var(--ink)' }} onClick={() => { setDate(d); setTime(t); }}>{longDay(d)} · {t}</button>
                      )))}
                    </div>
                  </>
                )}
                {!closedDay && !waiting && !change && <button className="btn soft sm" style={{ alignSelf: 'flex-start' }} onClick={() => setWaiting(true)}>Apuntarme a la lista de espera</button>}
              </div>
            )}
          </div>

          {waiting && freeCount === 0 && !change ? (
            <form className="widget stack" onSubmit={joinList}>
              <span className="eyebrow">Lista de espera · {shortDay(date)} · {guests} pers.</span>
              {!user && <div className="field"><label htmlFor="wl-name">Nombre</label><input id="wl-name" className="input" required value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} /></div>}
              {!user && <div className="field"><label htmlFor="wl-mail">Correo, para avisarte al momento</label><input id="wl-mail" className="input" type="email" autoComplete="email" required value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} /></div>}
              <div className="field"><label htmlFor="wl-phone">Teléfono</label><input id="wl-phone" className="input" type="tel" required value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} /></div>
              <button className="btn primary block">Avisadme si se libera una mesa</button>
            </form>
          ) : (
            <div className="sheet-foot">
              {change ? (
                <button className="btn primary block" disabled={!chosenOk || saving || (date === change.date && `${time} - ${minutesToTime(timeToMinutes(time) + duration)}` === change.time && guests === startGuests)} onClick={submit}>
                  {saving ? 'Cambiando…' : !chosenOk ? 'Elige la nueva hora' : `Cambiar a ${shortDay(date)} · ${time}`}
                </button>
              ) : (
                <button className="btn primary block" disabled={!chosenOk} onClick={() => setStep(2)}>
                  {!chosenOk ? 'Elige una hora' : `Continuar · ${longDay(date)} · ${time}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function CalendarButtons({ links }) {
  return (
    <div className="stack" style={{ gap: 6, width: '100%' }}>
      <span className="eyebrow">Añadir al calendario</span>
      <div className="row" style={{ gap: 8 }}>
        <a className="btn soft sm" style={{ flex: 1 }} href={links.google} target="_blank" rel="noreferrer"><Icon name="calendar" size={15} /> Google</a>
        <a className="btn soft sm" style={{ flex: 1 }} href={links.ics}><Icon name="calendar" size={15} /> iPhone / Outlook</a>
      </div>
    </div>
  );
}
