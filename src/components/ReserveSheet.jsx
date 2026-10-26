import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet, useToast } from './ui.jsx';
import Icon from './Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createOrder, orderStatus, reservationsOn, STATUS } from '../lib/data.js';
import { blockFor, slotShift, tableFits, tableMin } from '../lib/agenda.js';
import { minutesToTime, timeToMinutes, todayISO } from '../lib/format.js';
import { isClosed } from '../lib/booking.js';

export const DEFAULT_TABLES = [
  { table_number: 1, capacity: 2, zone: 'Sala Principal' },
  { table_number: 2, capacity: 4, zone: 'Sala Principal' },
  { table_number: 3, capacity: 6, zone: 'Sala Principal' },
];

export function slots(start, end, step = 30) {
  const out = [];
  for (let m = timeToMinutes(start); m <= timeToMinutes(end) - 60; m += step) out.push(minutesToTime(m));
  return out;
}

// Existing bookings are stored as orders like "Reserva 4 pax — Mesa 3 (Terraza)" with time "21:00 - 22:30".
export function busyTables(bookings, start, duration) {
  const s = timeToMinutes(start);
  const e = s + duration;
  const busy = new Set();
  for (const b of bookings) {
    const table = /Mesa (\d+)/.exec(b.items || '');
    const range = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(b.time || '');
    if (!table || !range) continue;
    const bs = timeToMinutes(range[1]);
    const be = timeToMinutes(range[2]);
    if (bs < e && s < be) busy.add(Number(table[1]));
  }
  return busy;
}

export default function ReserveSheet({ open, onClose, biz, settings }) {
  const { user } = useAuth();
  const toast = useToast();
  // Tables the restaurant keeps for walk-ins never show up online.
  const tables = (settings?.tables?.length ? settings.tables : DEFAULT_TABLES).filter((t) => t.online !== false);
  const smallest = Math.min(...tables.map((t) => Number(t.capacity) || 2));
  // A party smaller than any table still gets one of the smallest.
  const fits = (t, g) => tableFits(t, g) || (g < tableMin(t) && Number(t.capacity) === smallest);
  const zones = [...new Set(tables.map((t) => t.zone || 'Sala Principal'))];
  const duration = settings?.turn_duration_min || 90;
  const rules = settings?.profile || {};
  const maxGuests = Number(rules.max_personas) || 20;
  const notice = Number(rules.aviso_min) || 30;
  const lastDay = (() => {
    const d = new Date(`${todayISO()}T12:00:00`);
    d.setDate(d.getDate() + (Number(rules.dias_vista) || 60));
    return d.toISOString().slice(0, 10);
  })();

  const [date, setDate] = useState(todayISO());
  const [guests, setGuests] = useState(2);
  const [zone, setZone] = useState(zones[0]);
  const [time, setTime] = useState('');
  const [phone, setPhone] = useState('');
  const [bookings, setBookings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDone(null);
    reservationsOn(biz.name, date).then(setBookings).catch(() => setBookings([]));
  }, [open, biz.name, date]);

  const allSlots = useMemo(() => {
    const now = new Date();
    const isToday = date === todayISO();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const block = blockFor(settings, date);
    if (isClosed(settings, date) || date > lastDay || block.todo) return [];
    const startOf = (t) => new Date(`${date}T${t}:00`).getTime();
    return [...slots(settings.lunch_start, settings.lunch_end), ...slots(settings.dinner_start, settings.dinner_end)]
      .filter((t) => (!isToday || timeToMinutes(t) > nowMin) && startOf(t) - now.getTime() >= notice * 60000 && !block[slotShift(settings, t)]);
  }, [settings, date, notice, lastDay]);

  const tableFor = (slot) => {
    const busy = busyTables(bookings, slot, duration);
    return tables
      .filter((t) => (t.zone || 'Sala Principal') === zone && fits(t, guests) && !busy.has(Number(t.table_number)))
      .sort((a, b) => a.capacity - b.capacity)[0];
  };

  const submit = async () => {
    const table = tableFor(time);
    if (!table) return;
    setSaving(true);
    try {
      const end = minutesToTime(timeToMinutes(time) + duration);
      const order = await createOrder({
        business: biz.name,
        user,
        items: [],
        itemsText: `Reserva ${guests} pax — Mesa ${table.table_number} (${zone})`,
        total: 0,
        date,
        time: `${time} - ${end}`,
        status: STATUS.PENDING,
        phone: phone.trim().slice(0, 20),
      });
      // The restaurant may confirm on the spot when the table is free.
      setDone((await orderStatus(order.id)) === STATUS.CONFIRMED ? 'confirmed' : 'pending');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={done === 'confirmed' ? 'Reserva confirmada' : done ? 'Solicitud enviada' : 'Reservar mesa'}>
      {!user ? (
        <div className="stack">
          <p className="muted">Inicia sesión para reservar, así el restaurante puede confirmarte la mesa por correo.</p>
          <Link to="/cuenta" className="btn primary block">Iniciar sesión</Link>
        </div>
      ) : done ? (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
          <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={30} stroke={3} /></span>
          {done === 'confirmed' ? (
            <>
              <p style={{ fontSize: 17, fontWeight: 700 }}>¡Tienes mesa en {biz.name}!</p>
              <p className="muted">Te hemos mandado la confirmación por correo y el día antes te recordaremos la reserva.</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 17, fontWeight: 700 }}>{biz.name} revisará tu reserva</p>
              <p className="muted">Te avisaremos por correo cuando la confirme.</p>
            </>
          )}
          <button className="btn primary block" onClick={onClose}>Hecho</button>
        </div>
      ) : (
        <div className="stack">
          <div className="widget stack">
            <div className="field">
              <label htmlFor="resv-date">Día</label>
              <input id="resv-date" className="input" type="date" min={todayISO()} max={lastDay} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} />
            </div>
            <div className="row between">
              <span className="label" style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 13 }}>Personas</span>
              <span className="row" style={{ gap: 8 }}>
                <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => setGuests((g) => Math.max(1, g - 1))} aria-label="Menos personas"><Icon name="minus" /></button>
                <span className="title-lg price" style={{ minWidth: 28, textAlign: 'center' }}>{guests}</span>
                <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => setGuests((g) => Math.min(maxGuests, g + 1))} aria-label="Más personas"><Icon name="plus" /></button>
              </span>
            </div>
            {zones.length > 1 && (
              <div className="chips">
                {zones.map((z) => (
                  <button key={z} className={`chip ${zone === z ? 'on' : ''}`} style={{ background: zone === z ? undefined : 'var(--bg)' }} onClick={() => { setZone(z); setTime(''); }}>{z}</button>
                ))}
              </div>
            )}
          </div>

          <div className="widget">
            <span className="eyebrow">Hora</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
              {allSlots.map((t) => {
                const free = !!tableFor(t);
                return (
                  <button key={t} disabled={!free} onClick={() => setTime(t)} className="pill" style={{ minWidth: 0, height: 40, background: time === t ? 'var(--ink)' : 'var(--bg)', color: time === t ? '#fff' : free ? 'var(--ink)' : '#B5B1A8', textDecoration: free ? 'none' : 'line-through' }}>
                    {t}
                  </button>
                );
              })}
            </div>
            {allSlots.length === 0 && <p className="small muted" style={{ marginTop: 8 }}>{isClosed(settings, date) ? 'Este día el restaurante cierra.' : blockFor(settings, date).todo ? 'Este día está completo.' : 'No quedan horas libres para este día.'}</p>}
          </div>

          {guests >= maxGuests && (
            <p className="small muted" style={{ margin: 0 }}>¿Sois más de {maxGuests}? Llama a {biz.name}{biz.telefono ? ` al ${biz.telefono}` : ''} para reservar.</p>
          )}
          <div className="field">
            <label htmlFor="resv-phone">Tu teléfono (opcional)</label>
            <input id="resv-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Por si el restaurante necesita llamarte" />
          </div>
          {rules.cancelacion && <p className="small muted" style={{ margin: 0 }}>{rules.cancelacion}</p>}
          <button className="btn primary block" disabled={!time || saving} onClick={submit}>
            {saving ? 'Enviando…' : time ? `Solicitar mesa a las ${time}` : 'Elige una hora'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
