import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Sheet, useToast } from './ui.jsx';
import GuestFields, { useGuest } from './GuestFields.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { requestBooking, STATUS } from '../lib/data.js';
import { nextDays } from '../lib/booking.js';
import { minutesToTime, money, timeToMinutes, todayISO } from '../lib/format.js';
import { saveGuest } from '../lib/guest.js';
import { PAYMENTS } from '../lib/shop.js';
import { typeFacts } from '../lib/typeQuestions.js';

const EXTRAS = [
  { key: 'maletas', label: 'Con maletas' },
  { key: 'mascota', label: 'Con mascota' },
  { key: 'silla', label: 'Silla de bebé' },
  { key: 'ruedas', label: 'Silla de ruedas' },
];

function TripSheet({ biz, settings, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const profile = settings?.profile || {};
  const ahead = Number(profile.aviso_min) || 30;
  const days = useMemo(() => nextDays(30), []);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(() => minutesToTime(Math.ceil((new Date().getHours() * 60 + new Date().getMinutes() + ahead + 10) / 15) * 15));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pax, setPax] = useState(1);
  const [extras, setExtras] = useState([]);
  const [note, setNote] = useState('');
  const [guest, setGuest] = useGuest();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const seats = Number(profile.plazas) || 4;

  const submit = async (e) => {
    e.preventDefault();
    const now = new Date();
    if (date === todayISO() && timeToMinutes(time) < now.getHours() * 60 + now.getMinutes() + ahead) {
      toast(`Para hoy, reserva con al menos ${ahead} minutos. Si es ya, llama.`, 'error');
      return;
    }
    setBusy(true);
    try {
      const items = [`Reserva taxi: ${from.trim()} → ${to.trim()}`, `${pax} pers.`, ...extras.map((x) => EXTRAS.find((o) => o.key === x).label), note.trim() && `Nota: ${note.trim().slice(0, 200)}`].filter(Boolean).join(' · ');
      const res = await requestBooking({ business: biz.name, user, guest, itemsText: items, date, time: `${time} - ${minutesToTime(timeToMinutes(time) + 30)}` });
      saveGuest(user ? { phone: guest.phone.trim() } : { name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone.trim() });
      setDone(res.status === STATUS.CONFIRMED ? 'confirmed' : 'pending');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={done ? 'Viaje solicitado' : 'Reservar un viaje'}>
      {done ? (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={30} stroke={3} /></span>
          <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{biz.name} te lo confirma enseguida</p>
          <p className="muted" style={{ margin: 0 }}>Te avisamos por correo y te llamará al {guest.phone} si necesita algo.</p>
          {user && <Link to="/reservas" className="btn primary block" onClick={onClose}>Ver mis reservas</Link>}
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <div className="widget stack" style={{ gap: 10 }}>
            <div className="field"><label htmlFor="tx-from">¿Dónde te recogemos?</label><input id="tx-from" className="input" required minLength={3} maxLength={90} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Calle y número, o un sitio" /></div>
            <div className="field"><label htmlFor="tx-to">¿A dónde vas?</label><input id="tx-to" className="input" required minLength={2} maxLength={90} value={to} onChange={(e) => setTo(e.target.value)} placeholder="Estación de tren, hospital, otra ciudad…" /></div>
          </div>
          <div className="widget stack" style={{ gap: 10 }}>
            <span className="eyebrow">¿Cuándo?</span>
            <div className="day-strip">
              {days.map((d) => (
                <button type="button" key={d.iso} className="day-pill" aria-pressed={date === d.iso} onClick={() => setDate(d.iso)}>
                  <span className="wd">{d.weekday}</span><span className="dn">{d.day}</span>
                </button>
              ))}
            </div>
            <div className="field"><label htmlFor="tx-time">Hora de recogida</label><input id="tx-time" className="input" type="time" step={300} required value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <div className="widget stack" style={{ gap: 10 }}>
            <span className="eyebrow">¿Cuántos vais?</span>
            <div className="guest-pick" style={{ gridTemplateColumns: `repeat(${Math.min(seats, 8)}, minmax(0, 1fr))` }}>
              {Array.from({ length: Math.min(seats, 8) }, (_, i) => i + 1).map((n) => <button type="button" key={n} aria-pressed={pax === n} onClick={() => setPax(n)}>{n}</button>)}
            </div>
            <div className="chips">
              {EXTRAS.filter((x) => x.key !== 'ruedas' || profile.adaptado).map((x) => {
                const on = extras.includes(x.key);
                return <button type="button" key={x.key} className={`chip ${on ? 'on' : ''}`} style={{ background: on ? undefined : 'var(--bg)' }} aria-pressed={on} onClick={() => setExtras(on ? extras.filter((k) => k !== x.key) : [...extras, x.key])}>{x.label}</button>;
              })}
            </div>
            <input className="input" aria-label="Nota" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (ej.: vuelo a las 10:20, timbre 3.º B)" />
          </div>
          <GuestFields guest={guest} setGuest={setGuest} phoneRequired prefix="tx" />
          <button className="btn primary block" disabled={busy}>{busy ? 'Enviando…' : 'Pedir el taxi'}</button>
        </form>
      )}
    </Sheet>
  );
}

export default function TaxiFront({ biz, products, settings }) {
  const [open, setOpen] = useState(false);
  const profile = settings?.profile || {};
  const pay = (profile.pagos || []).map((m) => PAYMENTS[m]?.short).filter(Boolean);
  const facts = [
    profile.plazas && `${profile.plazas} plazas`,
    ...typeFacts(biz, profile),
    pay.length && `Pago: ${pay.join(', ').toLowerCase()}`,
  ].filter(Boolean);
  return (
    <>
      <div className="bento">
        {biz.telefono && (
          <a className="widget dark link stack" href={`tel:${biz.telefono}`} style={{ justifyContent: 'space-between', minHeight: 150, textDecoration: 'none' }}>
            <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="phone" /></span>
            <span className="stack" style={{ gap: 0 }}>
              <span className="eyebrow">Ahora mismo</span>
              <span className="title-lg">Llamar</span>
            </span>
          </a>
        )}
        <button className="widget link stack" onClick={() => setOpen(true)} style={{ justifyContent: 'space-between', minHeight: 150, border: 0, textAlign: 'left', background: 'var(--accent)' }}>
          <span className="mono" style={{ background: 'var(--ink)', color: 'var(--accent)' }}><Icon name="calendar" /></span>
          <span className="stack" style={{ gap: 0 }}>
            <span className="eyebrow" style={{ color: 'inherit', opacity: 0.7 }}>Para otro momento</span>
            <span className="title-lg">Reservar viaje</span>
          </span>
        </button>
      </div>
      {facts.length > 0 && <div className="widget" style={{ padding: 14 }}><div className="facts">{facts.map((f) => <span key={f} className="fact">{f}</span>)}</div></div>}
      {products.length > 0 && (
        <section className="widget" style={{ paddingBottom: 4 }}>
          <h2 className="title-lg" style={{ marginBottom: 4 }}>Precios orientativos</h2>
          {products.map((p) => (
            <div key={p.id} className="list-row">
              <span className="grow stack" style={{ gap: 1 }}>
                <span className="t">{p.name}</span>
                {p.description && <span className="s">{p.description}</span>}
              </span>
              <span className="price" style={{ fontWeight: 800 }}>{p.price_from ? 'desde ' : ''}{money(p.price)}</span>
            </div>
          ))}
        </section>
      )}
      <button className="cta-bar wide-hide" onClick={() => setOpen(true)}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Reserva tu taxi</span>
        <span className="go">Reservar</span>
      </button>
      {open && <TripSheet biz={biz} settings={settings} onClose={() => setOpen(false)} />}
    </>
  );
}
