import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet, useToast } from './ui.jsx';
import Icon from './Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createOrder, reservationsOn, STATUS } from '../lib/data.js';
import { minutesToTime, timeToMinutes, todayISO } from '../lib/format.js';

const DEFAULT_TABLES = [
  { table_number: 1, capacity: 2, zone: 'Sala Principal' },
  { table_number: 2, capacity: 4, zone: 'Sala Principal' },
  { table_number: 3, capacity: 6, zone: 'Sala Principal' },
];

function slots(start, end, step = 30) {
  const out = [];
  for (let m = timeToMinutes(start); m <= timeToMinutes(end) - 60; m += step) out.push(minutesToTime(m));
  return out;
}

// Existing bookings are stored as orders like "Reserva 4 pax — Mesa 3 (Terraza)" with time "21:00 - 22:30".
function busyTables(bookings, start, duration) {
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
  const tables = settings?.tables?.length ? settings.tables : DEFAULT_TABLES;
  const zones = [...new Set(tables.map((t) => t.zone || 'Sala Principal'))];
  const duration = settings?.turn_duration_min || 90;

  const [date, setDate] = useState(todayISO());
  const [guests, setGuests] = useState(2);
  const [zone, setZone] = useState(zones[0]);
  const [time, setTime] = useState('');
  const [bookings, setBookings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    reservationsOn(biz.name, date).then(setBookings).catch(() => setBookings([]));
  }, [open, biz.name, date]);

  const allSlots = useMemo(() => {
    const now = new Date();
    const isToday = date === todayISO();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return [...slots(settings.lunch_start, settings.lunch_end), ...slots(settings.dinner_start, settings.dinner_end)]
      .filter((t) => !isToday || timeToMinutes(t) > nowMin + 30);
  }, [settings, date]);

  const tableFor = (slot) => {
    const busy = busyTables(bookings, slot, duration);
    return tables
      .filter((t) => (t.zone || 'Sala Principal') === zone && Number(t.capacity) >= guests && !busy.has(Number(t.table_number)))
      .sort((a, b) => a.capacity - b.capacity)[0];
  };

  const submit = async () => {
    const table = tableFor(time);
    if (!table) return;
    setSaving(true);
    try {
      const end = minutesToTime(timeToMinutes(time) + duration);
      await createOrder({
        business: biz.name,
        user,
        items: [],
        itemsText: `Reserva ${guests} pax — Mesa ${table.table_number} (${zone})`,
        total: 0,
        date,
        time: `${time} - ${end}`,
        status: STATUS.PENDING,
      });
      setDone(true);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={done ? 'Solicitud enviada' : 'Reservar mesa'}>
      {!user ? (
        <div className="stack">
          <p className="muted">Inicia sesión para reservar, así el restaurante puede confirmarte la mesa por correo.</p>
          <Link to="/cuenta" className="btn primary block">Iniciar sesión</Link>
        </div>
      ) : done ? (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
          <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={30} stroke={3} /></span>
          <p style={{ fontSize: 17, fontWeight: 700 }}>{biz.name} revisará tu reserva</p>
          <p className="muted">Te avisaremos por correo cuando la confirme.</p>
          <button className="btn primary block" onClick={onClose}>Hecho</button>
        </div>
      ) : (
        <div className="stack">
          <div className="widget stack">
            <div className="field">
              <label htmlFor="resv-date">Día</label>
              <input id="resv-date" className="input" type="date" min={todayISO()} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} />
            </div>
            <div className="row between">
              <span className="label" style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 13 }}>Personas</span>
              <span className="row" style={{ gap: 8 }}>
                <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => setGuests((g) => Math.max(1, g - 1))} aria-label="Menos personas"><Icon name="minus" /></button>
                <span className="title-lg price" style={{ minWidth: 28, textAlign: 'center' }}>{guests}</span>
                <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => setGuests((g) => Math.min(20, g + 1))} aria-label="Más personas"><Icon name="plus" /></button>
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
            {allSlots.length === 0 && <p className="small muted" style={{ marginTop: 8 }}>No quedan horas libres para este día.</p>}
          </div>

          <button className="btn primary block" disabled={!time || saving} onClick={submit}>
            {saving ? 'Enviando…' : time ? `Solicitar mesa a las ${time}` : 'Elige una hora'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
