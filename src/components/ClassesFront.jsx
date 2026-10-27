import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Empty, Sheet, useToast } from './ui.jsx';
import GuestFields, { useGuest } from './GuestFields.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { requestBooking, reservationsOn, STATUS } from '../lib/data.js';
import { isClosed, nextDays } from '../lib/booking.js';
import { classEnd, classesOn, classItems, takenIn } from '../lib/classes.js';
import { duration, money, todayISO } from '../lib/format.js';
import { saveGuest } from '../lib/guest.js';
import { typeFacts } from '../lib/typeQuestions.js';

function BookClass({ biz, cls, date, left, onClose, onBooked }) {
  const { user } = useAuth();
  const toast = useToast();
  const [guest, setGuest] = useGuest();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const full = left <= 0;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await requestBooking({
        business: biz.name, user, guest,
        itemsText: classItems(cls, note),
        date, time: `${cls.time} - ${classEnd(cls)}`, total: 0,
      });
      if (!user) saveGuest({ name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone.trim() });
      setDone(res.status === STATUS.CONFIRMED ? 'confirmed' : 'pending');
      onBooked();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const when = new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <Sheet open onClose={onClose} title={done ? (done === 'confirmed' ? '¡Plaza reservada!' : 'Apuntado') : cls.name}>
      {done ? (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={30} stroke={3} /></span>
          <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{cls.name}, {when} a las {cls.time}</p>
          <p className="muted" style={{ margin: 0 }}>{done === 'confirmed' ? 'Tienes tu plaza. Te mandamos la confirmación por correo y un recordatorio el día antes.' : `Estás en la lista. ${biz.name} te avisará si queda sitio.`}</p>
          {user && <Link to="/reservas" className="btn primary block" onClick={onClose}>Ver mis reservas</Link>}
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <div className="widget stack" style={{ gap: 6 }}>
            <strong style={{ fontSize: 17, textTransform: 'capitalize' }}>{when}</strong>
            <span className="muted">{cls.time} – {classEnd(cls)} · {duration(cls.min)}{cls.teacher ? ` · con ${cls.teacher}` : ''}</span>
            {cls.level && <span className="small muted">{cls.level}</span>}
            <span className="small" style={{ fontWeight: 700, color: full ? 'var(--danger)' : left <= 3 ? 'var(--warn)' : 'var(--ok)' }}>
              {full ? 'Clase completa: te apuntamos a la lista de espera' : left === 1 ? 'Queda 1 plaza' : `Quedan ${left} plazas`}
            </span>
          </div>
          <GuestFields guest={guest} setGuest={setGuest} prefix="cl" />
          <div className="field"><label htmlFor="cl-note">¿Algo que deba saber {cls.teacher || biz.name}? (opcional)</label><input id="cl-note" className="input" maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: es mi primera clase, tengo una lesión de rodilla…" /></div>
          <button className="btn primary block" disabled={busy}>{busy ? 'Reservando…' : full ? 'Apuntarme a la lista de espera' : 'Reservar mi plaza'}</button>
        </form>
      )}
    </Sheet>
  );
}

export default function ClassesFront({ biz, products, settings }) {
  const profile = settings?.profile || {};
  const classes = profile.clases || [];
  const days = useMemo(() => nextDays(14), []);
  const [date, setDate] = useState(() => days.find((d) => classesOn(classes, d.iso).length && !isClosed(settings, d.iso))?.iso || todayISO());
  const [busy, setBusy] = useState([]);
  const [open, setOpen] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    reservationsOn(biz.name, date).then(setBusy).catch(() => setBusy([]));
  }, [biz.name, date, tick]);

  if (!classes.length) {
    return <div className="widget"><Empty icon="dumbbell" title="Aún no hay horario de clases">{biz.name} todavía no ha publicado sus clases. Puedes llamar o escribirle.</Empty></div>;
  }

  const now = new Date().toTimeString().slice(0, 5);
  const list = classesOn(classes, date).filter((c) => date !== todayISO() || c.time > now);
  const facts = [
    ...typeFacts(biz, profile),
    profile.cancelar_horas && `Cancela hasta ${profile.cancelar_horas} h antes`,
  ].filter(Boolean);

  return (
    <>
      {facts.length > 0 && <div className="widget" style={{ padding: 14 }}><div className="facts">{facts.map((f) => <span key={f} className="fact">{f}</span>)}</div></div>}

      <section className="widget stack" style={{ gap: 12 }} id="clases">
        <h2 className="title-lg">Horario de clases</h2>
        <div className="day-strip">
          {days.map((d) => {
            const none = isClosed(settings, d.iso) || !classesOn(classes, d.iso).length;
            return (
              <button key={d.iso} className="day-pill" disabled={none} aria-pressed={date === d.iso} onClick={() => setDate(d.iso)}>
                <span className="wd">{d.weekday}</span><span className="dn">{d.day}</span>
              </button>
            );
          })}
        </div>
        {list.length === 0 ? <p className="small muted">No quedan clases este día. Prueba otro.</p> : list.map((c) => {
          const left = Math.max(0, Number(c.plazas || 0) - takenIn(busy, c));
          const pct = c.plazas ? Math.min(1, takenIn(busy, c) / c.plazas) : 0;
          return (
            <button key={`${c.id}-${c.time}`} className="class-slot" onClick={() => setOpen({ cls: c, left })} style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', color: 'inherit', borderBottom: '1px solid var(--bg)' }}>
              <span className="when">{c.time}<small>{duration(c.min)}</small></span>
              <span className="grow stack" style={{ gap: 4, minWidth: 0 }}>
                <strong style={{ fontSize: 16 }}>{c.name}</strong>
                <span className="small muted">{[c.teacher && `con ${c.teacher}`, c.level].filter(Boolean).join(' · ')}</span>
                <span className="spots" aria-hidden="true"><span style={{ width: `${pct * 100}%`, background: left ? 'var(--ink)' : 'var(--danger)' }} /></span>
              </span>
              <span className="stack" style={{ gap: 2, alignItems: 'flex-end', flex: 'none' }}>
                <span className="pill" style={{ background: left ? 'var(--accent)' : 'var(--bg)' }}>{left ? 'Reservar' : 'Completa'}</span>
                <span className="small muted">{left ? `${left} ${left === 1 ? 'plaza' : 'plazas'}` : 'Lista de espera'}</span>
              </span>
            </button>
          );
        })}
      </section>

      {products.length > 0 && (
        <section className="widget" style={{ paddingBottom: 4 }}>
          <h2 className="title-lg" style={{ marginBottom: 4 }}>Tarifas</h2>
          {products.map((p) => (
            <div key={p.id} className="list-row">
              <span className="grow stack" style={{ gap: 1 }}>
                <span className="t">{p.name}</span>
                {p.description && <span className="s">{p.description}</span>}
              </span>
              <span className="price" style={{ fontWeight: 800 }}>{money(p.price)}</span>
            </div>
          ))}
        </section>
      )}

      {open && <BookClass biz={biz} cls={open.cls} left={open.left} date={date} onClose={() => setOpen(null)} onBooked={() => setTick((n) => n + 1)} />}
    </>
  );
}

