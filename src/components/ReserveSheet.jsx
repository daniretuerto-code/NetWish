import { useEffect, useMemo, useState } from 'react';
import { Sheet, useToast } from './ui.jsx';
import Icon from './Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createGuestBooking, createOrder, joinWaitlist, orderStatus, reservationsOn, STATUS } from '../lib/data.js';
import { blockFor, slotShift, tableFits, tableLabel, tableMin, tablesIn } from '../lib/agenda.js';
import { joinPairs, zoneOf, zoneOpenAt, zonesOf } from '../lib/floor.js';
import { minutesToTime, timeToMinutes, todayISO } from '../lib/format.js';
import { isClosed } from '../lib/booking.js';

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
const shortDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

export default function ReserveSheet({ open, onClose, biz, settings }) {
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

  const [date, setDate] = useState(todayISO());
  const [guests, setGuests] = useState(2);
  const [zone, setZone] = useState(zones[0]);
  const [time, setTime] = useState('');
  const [guest, setGuest] = useState({ name: '', email: '', phone: '' });
  const [occasions, setOccasions] = useState([]);
  const [extra, setExtra] = useState('');
  const [bookings, setBookings] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  // A group bigger than the restaurant's limit for instant bookings, or than any table, goes in as a request.
  const isGroup = guests > biggest || (groupFrom > 0 && guests >= groupFrom);

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setBookings(null);
    reservationsOn(biz.name, date).then(setBookings).catch(() => setBookings([]));
  }, [open, biz.name, date]);

  const slotsFor = (day) => {
    const now = new Date();
    const block = blockFor(settings, day);
    if (isClosed(settings, day) || day > lastDay || block.todo) return [];
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startOf = (t) => new Date(`${day}T${t}:00`).getTime();
    return [...slots(settings.lunch_start, settings.lunch_end), ...slots(settings.dinner_start, settings.dinner_end)]
      .filter((t) => (day !== todayISO() || timeToMinutes(t) > nowMin) && startOf(t) - now.getTime() >= notice * 60000 && !block[slotShift(settings, t)]);
  };

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
  const freeCount = bookings ? daySlots.filter((t) => isFree(bookings, t)).length : null;

  // Nothing free that day: look at the next week for the closest free times.
  useEffect(() => {
    setSuggestions(null);
    if (!open || freeCount !== 0) return;
    let alive = true;
    const days = Array.from({ length: 7 }, (_, i) => addDays(date, i + 1)).filter((d) => d <= lastDay && slotsFor(d).length);
    Promise.all(days.map((d) => reservationsOn(biz.name, d).then((list) => ({ d, list })).catch(() => ({ d, list: [] }))))
      .then((res) => {
        if (!alive) return;
        setSuggestions(res.map(({ d, list }) => ({ d, times: slotsFor(d).filter((t) => isFree(list, t)).slice(0, 3) })).filter((x) => x.times.length).slice(0, 3));
      });
    return () => { alive = false; };
  }, [open, freeCount, date, guests, zone]);

  const note = [...occasions, extra.trim()].filter(Boolean).join(', ').slice(0, 200);

  const submit = async () => {
    const table = isGroup ? null : tableFor(bookings || [], time);
    if (!isGroup && !table) return;
    setSaving(true);
    try {
      const end = minutesToTime(timeToMinutes(time) + duration);
      const itemsText = `Reserva ${guests} pax — ${table ? tableLabel(table.map((t) => t.table_number), zoneOf(table[0])) : 'Grupo'}${note ? ` · Nota: ${note}` : ''}`;
      const base = { business: biz.name, itemsText, date, time: `${time} - ${end}` };
      let status;
      if (user) {
        const order = await createOrder({ ...base, user, items: [], total: 0, status: STATUS.PENDING, phone: guest.phone.trim().slice(0, 20) });
        status = await orderStatus(order.id);
      } else {
        status = (await createGuestBooking({ ...base, name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone.trim() })).status;
      }
      // The restaurant may confirm on the spot when the table is free.
      setDone(status === STATUS.CONFIRMED ? 'confirmed' : 'pending');
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
      setDone('waitlist');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const email = user?.email || guest.email;
  const titles = { confirmed: 'Reserva confirmada', pending: 'Solicitud enviada', waitlist: 'Estás en la lista de espera' };

  return (
    <Sheet open={open} onClose={onClose} title={titles[done] || 'Reservar mesa'}>
      {done ? (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
          <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={30} stroke={3} /></span>
          {done === 'confirmed' && (
            <>
              <p style={{ fontSize: 17, fontWeight: 700 }}>¡Tienes mesa en {biz.name}!</p>
              <p className="muted">Te hemos mandado la confirmación a {email}. El día antes te recordaremos la reserva.</p>
            </>
          )}
          {done === 'pending' && (
            <>
              <p style={{ fontSize: 17, fontWeight: 700 }}>{biz.name} revisará tu {isGroup ? 'solicitud de grupo' : 'reserva'}</p>
              <p className="muted">Te avisaremos en {email} cuando la confirme.</p>
            </>
          )}
          {done === 'waitlist' && <p className="muted">Si se libera una mesa, {biz.name} te avisará.</p>}
          <button className="btn primary block" onClick={onClose}>Hecho</button>
        </div>
      ) : (
        <div className="stack">
          <div className="widget stack">
            <div className="field">
              <label htmlFor="resv-date">Día</label>
              <input id="resv-date" className="input" type="date" min={todayISO()} max={lastDay} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); setWaiting(false); }} />
            </div>
            <div className="row between">
              <span className="label" style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 13 }}>Personas</span>
              <span className="row" style={{ gap: 8 }}>
                <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => { setGuests((g) => Math.max(1, g - 1)); setTime(''); }} aria-label="Menos personas"><Icon name="minus" /></button>
                <span className="title-lg price" style={{ minWidth: 28, textAlign: 'center' }}>{guests}</span>
                <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => { setGuests((g) => Math.min(maxGuests, g + 1)); setTime(''); }} aria-label="Más personas"><Icon name="plus" /></button>
              </span>
            </div>
            {zones.length > 1 && !isGroup && (
              <div className="chips">
                {zones.map((z) => {
                  const info = zoneInfo(z);
                  return (
                    <button key={z} className={`chip ${zone === z ? 'on' : ''}`} style={{ background: zone === z ? undefined : 'var(--bg)' }} onClick={() => { setZone(z); setTime(''); }}>
                      {info?.outdoor ? '☀︎ ' : ''}{z}{info?.from && info?.to ? ` · ${info.from}-${info.to}` : ''}
                    </button>
                  );
                })}
              </div>
            )}
            {isGroup && <p className="small" style={{ margin: 0, fontWeight: 600 }}>Para grupos de {guests} el restaurante prepara las mesas y te confirma la reserva.</p>}
            {guests >= maxGuests && (
              <p className="small muted" style={{ margin: 0 }}>¿Sois más de {maxGuests}? Llama a {biz.name}{biz.telefono ? ` al ${biz.telefono}` : ''}.</p>
            )}
          </div>

          <div className="widget">
            <span className="eyebrow">Hora</span>
            {!bookings ? <div className="spinner" style={{ margin: '12px auto' }} /> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                {daySlots.map((t) => {
                  const free = isFree(bookings, t);
                  return (
                    <button key={t} disabled={!free} onClick={() => setTime(t)} className="pill" style={{ minWidth: 0, height: 40, background: time === t ? 'var(--ink)' : 'var(--bg)', color: time === t ? '#fff' : free ? 'var(--ink)' : '#B5B1A8', textDecoration: free ? 'none' : 'line-through' }}>
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
            {bookings && freeCount === 0 && (
              <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                <p className="small muted" style={{ margin: 0 }}>
                  {isClosed(settings, date) ? 'Este día el restaurante cierra.' : daySlots.length === 0 && !blockFor(settings, date).todo ? 'No quedan horas para este día.' : `Este día está completo para ${guests}.`}
                </p>
                {suggestions?.length > 0 && (
                  <>
                    <span className="eyebrow">Hay sitio</span>
                    <div className="chips" style={{ flexWrap: 'wrap' }}>
                      {suggestions.flatMap(({ d, times }) => times.map((t) => (
                        <button key={`${d}${t}`} className="chip" style={{ background: 'var(--accent)' }} onClick={() => { setDate(d); setTime(t); }}>{shortDay(d)} · {t}</button>
                      )))}
                    </div>
                  </>
                )}
                {!isClosed(settings, date) && !waiting && <button className="btn soft sm" style={{ alignSelf: 'flex-start' }} onClick={() => setWaiting(true)}>Apuntarme a la lista de espera</button>}
              </div>
            )}
          </div>

          {waiting && freeCount === 0 ? (
            <form className="widget stack" onSubmit={joinList}>
              <span className="eyebrow">Lista de espera · {shortDay(date)} · {guests} pers.</span>
              {!user && <div className="field"><label htmlFor="wl-name">Nombre</label><input id="wl-name" className="input" required value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} /></div>}
              <div className="field"><label htmlFor="wl-phone">Teléfono</label><input id="wl-phone" className="input" type="tel" required value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} /></div>
              <button className="btn primary block">Avisadme si se libera una mesa</button>
            </form>
          ) : (
            <>
              <div className="widget stack">
                <span className="eyebrow">¿Algo que debamos saber?</span>
                <div className="chips" style={{ flexWrap: 'wrap' }}>
                  {OCCASIONS.map((o) => {
                    const on = occasions.includes(o);
                    return <button key={o} className={`chip ${on ? 'on' : ''}`} style={{ background: on ? undefined : 'var(--bg)', height: 36 }} onClick={() => setOccasions(on ? occasions.filter((x) => x !== o) : [...occasions, o])}>{o}</button>;
                  })}
                </div>
                <input className="input" aria-label="Alergias u otras peticiones" maxLength={120} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Alergias u otras peticiones (opcional)" />
              </div>

              <div className="widget stack">
                {!user && (
                  <>
                    <span className="small muted">Sin registrarte: solo tu nombre y tu correo para mandarte la confirmación.</span>
                    <div className="field"><label htmlFor="g-name">Nombre</label><input id="g-name" className="input" autoComplete="name" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} /></div>
                    <div className="field"><label htmlFor="g-mail">Correo</label><input id="g-mail" className="input" type="email" autoComplete="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} /></div>
                  </>
                )}
                <div className="field">
                  <label htmlFor="resv-phone">Teléfono {user ? '(opcional)' : ''}</label>
                  <input id="resv-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} placeholder="Por si el restaurante necesita llamarte" />
                </div>
              </div>
              {rules.cancelacion && <p className="small muted" style={{ margin: 0 }}>{rules.cancelacion}</p>}
              <button className="btn primary block" disabled={!time || saving || (!user && (guest.name.trim().length < 2 || !guest.email.includes('@')))} onClick={submit}>
                {saving ? 'Enviando…' : !time ? 'Elige una hora' : isGroup ? `Pedir mesa para ${guests} a las ${time}` : `Reservar a las ${time}`}
              </button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
