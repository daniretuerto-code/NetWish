import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { Sheet, useToast } from './ui.jsx';
import { busyTables, DEFAULT_TABLES, slots } from './ReserveSheet.jsx';
import { createOwnerBooking, reservationsOn, STATUS } from '../lib/data.js';
import { minutesToTime, timeToMinutes, todayISO } from '../lib/format.js';
import { nextDays } from '../lib/booking.js';

const nowRounded = () => {
  const d = new Date();
  return minutesToTime(Math.floor((d.getHours() * 60 + d.getMinutes()) / 15) * 15);
};

// "+ Reserva": the restaurant writes down a phone call, or seats someone who walked in.
export default function OwnerBookingSheet({ open, onClose, business, settings, initial, onSaved }) {
  const toast = useToast();
  const tables = settings?.tables?.length ? settings.tables : DEFAULT_TABLES;
  const duration = settings?.turn_duration_min || 90;
  const [walkIn, setWalkIn] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', note: '' });
  const [date, setDate] = useState(todayISO());
  const [guests, setGuests] = useState(2);
  const [time, setTime] = useState('');
  const [table, setTable] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWalkIn(!!initial?.walkIn);
    setTable(initial?.table || null);
    setDate(initial?.date || todayISO());
    setTime(initial?.walkIn ? nowRounded() : '');
    setForm({ name: '', phone: '', note: '' });
    setGuests(2);
  }, [open, initial]);

  useEffect(() => {
    if (open) reservationsOn(business.name, date).then(setBookings).catch(() => setBookings([]));
  }, [open, business.name, date]);

  const daySlots = useMemo(() => {
    const all = [...slots(settings.lunch_start, settings.lunch_end), ...slots(settings.dinner_start, settings.dinner_end)];
    return date === todayISO() ? all.filter((t) => timeToMinutes(t) >= timeToMinutes(nowRounded()) - 30) : all;
  }, [settings, date]);

  const busy = time ? busyTables(bookings, time, duration) : new Set();
  const fitting = tables.filter((t) => Number(t.capacity) >= guests && !busy.has(Number(t.table_number))).sort((a, b) => a.capacity - b.capacity);
  const others = tables.filter((t) => !busy.has(Number(t.table_number)) && !fitting.includes(t));
  const chosen = tables.find((t) => Number(t.table_number) === Number(table)) || fitting[0];

  const save = async (e) => {
    e.preventDefault();
    if (!time) return toast('Elige una hora', 'error');
    setSaving(true);
    try {
      const end = minutesToTime(timeToMinutes(time) + duration);
      const tablePart = chosen ? ` — Mesa ${chosen.table_number} (${chosen.zone || 'Sala Principal'})` : '';
      const note = form.note.trim().slice(0, 200);
      await createOwnerBooking({
        business: business.name,
        customer: form.name.trim().slice(0, 60) || (walkIn ? 'Sin reserva' : 'Cliente'),
        phone: form.phone.trim().slice(0, 20),
        itemsText: `Reserva ${guests} pax${tablePart}${note ? ` · Nota: ${note}` : ''}`,
        date: walkIn ? todayISO() : date,
        time: `${time} - ${end}`,
        status: walkIn ? STATUS.SEATED : STATUS.CONFIRMED,
        source: walkIn ? 'local' : 'telefono',
      });
      toast(walkIn ? 'Mesa ocupada' : 'Reserva apuntada');
      onSaved?.();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const tableButton = (t) => {
    const on = chosen && Number(chosen.table_number) === Number(t.table_number);
    return (
      <button type="button" key={t.table_number} className="pill" onClick={() => setTable(t.table_number)}
        style={{ minWidth: 0, height: 44, background: on ? 'var(--ink)' : 'var(--bg)', color: on ? '#fff' : 'var(--ink)' }}>
        {t.table_number}<span style={{ opacity: 0.6, fontWeight: 600 }}> · {t.capacity}p</span>
      </button>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={walkIn ? 'Cliente sin reserva' : 'Nueva reserva'}>
      <form className="stack" onSubmit={save}>
        <div className="segmented" style={{ background: 'var(--bg)' }} role="tablist">
          <button type="button" role="tab" aria-selected={!walkIn} onClick={() => { setWalkIn(false); setTime(''); }}>Por teléfono</button>
          <button type="button" role="tab" aria-selected={walkIn} onClick={() => { setWalkIn(true); setDate(todayISO()); setTime(nowRounded()); }}>Ha venido sin reservar</button>
        </div>

        <div className="widget stack">
          <div className="bento">
            <div className="field"><label htmlFor="ob-name">Nombre</label><input id="ob-name" className="input" required={!walkIn} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" /></div>
            <div className="field"><label htmlFor="ob-phone">Teléfono</label><input id="ob-phone" className="input" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="off" /></div>
          </div>
          <div className="row between">
            <span style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 13 }}>Personas</span>
            <span className="row" style={{ gap: 8 }}>
              <button type="button" className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => setGuests((g) => Math.max(1, g - 1))} aria-label="Menos personas"><Icon name="minus" /></button>
              <span className="title-lg price" style={{ minWidth: 28, textAlign: 'center' }}>{guests}</span>
              <button type="button" className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => setGuests((g) => Math.min(60, g + 1))} aria-label="Más personas"><Icon name="plus" /></button>
            </span>
          </div>
        </div>

        {!walkIn && (
          <div className="widget stack">
            <span className="eyebrow">Día</span>
            <div className="chips">
              {nextDays(21).map((d) => (
                <button type="button" key={d.iso} className={`chip ${date === d.iso ? 'on' : ''}`} style={{ background: date === d.iso ? undefined : 'var(--bg)', minWidth: 56 }} onClick={() => { setDate(d.iso); setTime(''); }}>
                  {d.weekday} {d.weekday === 'Hoy' ? '' : d.day}
                </button>
              ))}
            </div>
            <span className="eyebrow">Hora</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              {daySlots.map((t) => (
                <button type="button" key={t} className="pill" onClick={() => setTime(t)} style={{ minWidth: 0, height: 40, background: time === t ? 'var(--ink)' : 'var(--bg)', color: time === t ? '#fff' : 'var(--ink)' }}>{t}</button>
              ))}
            </div>
            {daySlots.length === 0 && <p className="small muted" style={{ margin: 0 }}>No hay turnos este día. Revisa tu horario en Personalizar.</p>}
          </div>
        )}

        {time && (
          <div className="widget stack">
            <span className="eyebrow">Mesa {chosen ? `· te proponemos la ${chosen.table_number}` : ''}</span>
            {fitting.length === 0 && <p className="small muted" style={{ margin: 0 }}>No queda ninguna mesa libre de {guests} a esa hora. Puedes juntar mesas y elegir una de las libres.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
              {fitting.map(tableButton)}
              {others.map(tableButton)}
            </div>
          </div>
        )}

        <div className="field"><label htmlFor="ob-note">Nota (opcional)</label><input id="ob-note" className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ej.: cumpleaños, trona, alergia al marisco" /></div>
        <button className="btn primary block" disabled={saving || !time}>{saving ? 'Guardando…' : walkIn ? 'Sentar ahora' : time ? `Apuntar a las ${time}` : 'Elige una hora'}</button>
      </form>
    </Sheet>
  );
}
