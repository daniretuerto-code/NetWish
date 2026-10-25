import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Empty, Sheet, useToast } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createOrder, reservationsOn, STATUS } from '../lib/data.js';
import { HAIR_LENGTHS, isClosed, nextDays, serviceMinutes, serviceSlots } from '../lib/booking.js';
import { duration, minutesToTime, money, timeToMinutes, todayISO } from '../lib/format.js';

const priceLabel = (s) => (Number(s.price) > 0 ? `${s.price_from ? 'desde ' : ''}${money(s.price)}` : 'Consultar');

function BookSheet({ open, onClose, biz, settings, services }) {
  const { user } = useAuth();
  const toast = useToast();
  const staff = settings.staff || [];
  const needsLength = services.some((s) => Number(s.extra_long_min) > 0);
  const days = useMemo(() => nextDays(21), []);

  const [hair, setHair] = useState('corto');
  const [who, setWho] = useState('');
  const [date, setDate] = useState(() => days.find((d) => !isClosed(settings, d.iso))?.iso || todayISO());
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [bookings, setBookings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    reservationsOn(biz.name, date).then(setBookings).catch(() => setBookings([]));
  }, [open, biz.name, date]);

  const minutes = services.reduce((sum, s) => sum + serviceMinutes(s, needsLength ? hair : 'corto'), 0);
  const total = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const fromPrice = services.some((s) => s.price_from);
  const slots = serviceSlots(settings, date, minutes, bookings, who);
  const chosen = slots.find((s) => s.time === time && s.free);

  const submit = async () => {
    if (!chosen) return;
    setSaving(true);
    try {
      const parts = [`Reserva cita: ${services.map((s) => s.name).join(' + ')} (${duration(minutes)})`];
      if (chosen.staff) parts.push(`con ${chosen.staff}`);
      if (needsLength) parts.push(`Pelo ${HAIR_LENGTHS.find((h) => h.key === hair).label.toLowerCase()}`);
      // The note goes last: the public list of busy slots cuts everything after it.
      if (note.trim()) parts.push(`Nota: ${note.trim().slice(0, 240)}`);
      await createOrder({
        business: biz.name,
        user,
        items: [],
        itemsText: parts.join(' · '),
        total,
        date,
        time: `${time} - ${minutesToTime(timeToMinutes(time) + minutes)}`,
        status: STATUS.PENDING,
      });
      setDone(true);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const chip = (on) => ({ background: on ? undefined : 'var(--bg)' });

  return (
    <Sheet open={open} onClose={onClose} title={done ? 'Cita solicitada' : 'Elige tu hora'}>
      {!user ? (
        <div className="stack">
          <p className="muted">Inicia sesión para reservar, así {biz.name} puede confirmarte la cita por correo.</p>
          <Link to="/cuenta" className="btn primary block">Iniciar sesión</Link>
        </div>
      ) : done ? (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
          <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={30} stroke={3} /></span>
          <p style={{ fontSize: 17, fontWeight: 700 }}>{biz.name} revisará tu cita</p>
          <p className="muted">Te avisaremos por correo cuando la confirme.</p>
          <Link to="/reservas" className="btn primary block">Ver mis reservas</Link>
        </div>
      ) : (
        <div className="stack">
          <div className="widget stack" style={{ gap: 6 }}>
            {services.map((s) => (
              <div key={s.id} className="row between" style={{ gap: 10 }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span className="small muted">{duration(serviceMinutes(s, needsLength ? hair : 'corto'))}</span>
              </div>
            ))}
            <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 4 }}>
              <strong>{duration(minutes)}</strong>
              <strong className="price">{total > 0 ? `${fromPrice ? 'desde ' : ''}${money(total)}` : ''}</strong>
            </div>
          </div>

          {needsLength && (
            <div className="widget stack" style={{ gap: 10 }}>
              <span className="eyebrow">Largo del pelo</span>
              <div className="chips">
                {HAIR_LENGTHS.map((h) => (
                  <button key={h.key} className={`chip ${hair === h.key ? 'on' : ''}`} style={chip(hair === h.key)} onClick={() => { setHair(h.key); setTime(''); }}>{h.label}</button>
                ))}
              </div>
            </div>
          )}

          {staff.length > 1 && (
            <div className="widget stack" style={{ gap: 10 }}>
              <span className="eyebrow">Profesional</span>
              <div className="chips">
                <button className={`chip ${!who ? 'on' : ''}`} style={chip(!who)} onClick={() => { setWho(''); setTime(''); }}>Sin preferencia</button>
                {staff.map((p) => (
                  <button key={p.name} className={`chip ${who === p.name ? 'on' : ''}`} style={chip(who === p.name)} onClick={() => { setWho(p.name); setTime(''); }}>{p.name}</button>
                ))}
              </div>
            </div>
          )}

          <div className="widget stack" style={{ gap: 10 }}>
            <span className="eyebrow">Día</span>
            <div className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
              {days.map((d) => {
                const closed = isClosed(settings, d.iso);
                const on = date === d.iso;
                return (
                  <button key={d.iso} disabled={closed} onClick={() => { setDate(d.iso); setTime(''); }} className="stack" aria-label={`${d.weekday} ${d.day}${closed ? ', cerrado' : ''}`}
                    style={{ flex: '0 0 auto', alignItems: 'center', gap: 2, width: 52, padding: '8px 0', borderRadius: 16, border: 0, background: on ? 'var(--ink)' : 'var(--bg)', color: on ? '#fff' : closed ? '#B5B1A8' : 'var(--ink)' }}>
                    <span className="small" style={{ opacity: 0.7 }}>{d.weekday}</span>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{d.day}</span>
                  </button>
                );
              })}
            </div>

            <span className="eyebrow" style={{ marginTop: 6 }}>Hora</span>
            {slots.some((s) => s.free) ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                {slots.filter((s) => s.free).map((s) => (
                  <button key={s.time} onClick={() => setTime(s.time)} className="pill" style={{ minWidth: 0, height: 40, background: time === s.time ? 'var(--ink)' : 'var(--bg)', color: time === s.time ? '#fff' : 'var(--ink)' }}>
                    {s.time}
                  </button>
                ))}
              </div>
            ) : (
              <p className="small muted">{isClosed(settings, date) ? 'Este día está cerrado.' : 'No quedan huecos para este día. Prueba otro.'}</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="bk-note">Algo que deba saber {biz.name} (opcional)</label>
            <textarea id="bk-note" className="input" rows={2} maxLength={240} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: quiero tapar canas, es mi primera vez…" />
          </div>

          <button className="btn primary block" disabled={!chosen || saving} onClick={submit}>
            {saving ? 'Enviando…' : chosen ? `Reservar a las ${time}${chosen.staff && staff.length > 1 ? ` con ${chosen.staff}` : ''}` : 'Elige una hora'}
          </button>
        </div>
      )}
    </Sheet>
  );
}

export default function ServiceBooking({ biz, services, settings }) {
  const [picked, setPicked] = useState([]);
  const [open, setOpen] = useState(false);

  const sections = useMemo(() => {
    const map = new Map();
    for (const s of services) {
      const key = s.section || 'Servicios';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return [...map.entries()];
  }, [services]);

  if (!services.length) {
    return <div className="widget"><Empty icon="scissors" title="Aún no hay servicios">Este negocio todavía no ha publicado sus servicios. Puedes llamar o escribirle.</Empty></div>;
  }

  const chosen = services.filter((s) => picked.includes(s.id));
  const minutes = chosen.reduce((sum, s) => sum + serviceMinutes(s), 0);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <>
      <p className="small muted" style={{ margin: '0 4px' }}>Elige uno o varios servicios y te mostramos las horas en las que cabe todo.</p>
      <div className="menu-grid" id="servicios">
        {sections.map(([section, items]) => (
          <section key={section} className="widget" style={{ paddingBottom: 4 }}>
            <h2 className="title-lg" style={{ marginBottom: 4 }}>{section}</h2>
            {items.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button key={s.id} className="list-row" onClick={() => toggle(s.id)} aria-pressed={on} style={{ textAlign: 'left' }}>
                  <span className="grow stack" style={{ gap: 1 }}>
                    <span className="t">{s.name}</span>
                    {s.description && <span className="s">{s.description}</span>}
                    <span className="s" style={{ color: 'var(--ink-2)' }}>
                      {duration(Number(s.duration_min) || 30)}{Number(s.extra_long_min) > 0 ? ' (más con pelo largo)' : ''} · <span className="price">{priceLabel(s)}</span>
                    </span>
                  </span>
                  <span className="pill" style={{ background: on ? 'var(--accent)' : 'var(--bg)', minWidth: 44, padding: on ? 0 : undefined }}>
                    {on ? <Icon name="check" size={16} stroke={3} /> : 'Elegir'}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      {chosen.length > 0 && (
        <button className="cta-bar" onClick={() => setOpen(true)}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>
            {chosen.length} {chosen.length === 1 ? 'servicio' : 'servicios'} <span style={{ fontWeight: 400, opacity: 0.6 }}>· {duration(minutes)}</span>
          </span>
          <span className="go">Elegir hora</span>
        </button>
      )}

      {open && <BookSheet open onClose={() => setOpen(false)} biz={biz} settings={settings} services={chosen} />}
    </>
  );
}
