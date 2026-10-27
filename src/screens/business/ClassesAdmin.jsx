import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, PageHeader, Sheet, Skeleton, useToast } from '../../components/ui.jsx';
import SectionTabs from '../../components/SectionTabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessOrders, saveRestaurantSettings, STATUS, subscribe } from '../../lib/data.js';
import { nextDays } from '../../lib/booking.js';
import { classEnd, classesOn, DAY_SHORT, isClassBooking, takenIn } from '../../lib/classes.js';
import { duration, todayISO } from '../../lib/format.js';

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const GONE = [STATUS.CANCELLED, STATUS.REJECTED];

function ClassSheet({ cls, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({ name: '', days: [], time: '19:00', min: 60, plazas: 12, teacher: '', level: '', ...cls }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleDay = (d) => setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }));
  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.days.length) return;
    onSave({
      id: form.id || `${form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}-${Date.now().toString(36)}`,
      name: form.name.trim().slice(0, 60),
      days: [...form.days].map(Number).sort(),
      time: form.time,
      min: Number(form.min) || 60,
      plazas: Math.max(1, Number(form.plazas) || 1),
      teacher: form.teacher.trim().slice(0, 40),
      level: form.level.trim().slice(0, 60),
    });
  };
  return (
    <Sheet open onClose={onClose} title={cls.id ? 'Editar clase' : 'Nueva clase'}>
      <form className="stack" onSubmit={submit}>
        <div className="field"><label htmlFor="cl-name">Nombre</label><input id="cl-name" className="input" required maxLength={60} value={form.name} onChange={set('name')} placeholder="Pilates, Spinning, Inglés B1…" /></div>
        <div className="field">
          <span className="label">Días</span>
          <div className="guest-pick" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {ORDER.map((d) => <button type="button" key={d} aria-pressed={form.days.includes(d)} aria-label={DAY_LONG[d]} onClick={() => toggleDay(d)}>{DAY_SHORT[d]}</button>)}
          </div>
        </div>
        <div className="bento">
          <div className="field"><label htmlFor="cl-time">Hora</label><input id="cl-time" className="input" type="time" required value={form.time} onChange={set('time')} /></div>
          <div className="field">
            <label htmlFor="cl-min">Duración</label>
            <select id="cl-min" className="input" value={form.min} onChange={set('min')}>
              {[30, 45, 50, 55, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{duration(m)}</option>)}
            </select>
          </div>
        </div>
        <div className="bento">
          <div className="field"><label htmlFor="cl-plazas">Plazas</label><input id="cl-plazas" className="input" inputMode="numeric" value={form.plazas} onChange={set('plazas')} /></div>
          <div className="field"><label htmlFor="cl-teacher">Profe</label><input id="cl-teacher" className="input" maxLength={40} value={form.teacher} onChange={set('teacher')} /></div>
        </div>
        <div className="field"><label htmlFor="cl-level">Nivel o para quién</label><input id="cl-level" className="input" maxLength={60} value={form.level} onChange={set('level')} placeholder="Todos los niveles, Principiantes…" /></div>
        <button className="btn primary block" disabled={!form.name.trim() || !form.days.length}>Guardar</button>
        {cls.id && <button type="button" className="btn ghost block" onClick={() => onDelete(cls.id)}>Quitar del horario</button>}
      </form>
    </Sheet>
  );
}

// Gyms, studios and academies: the weekly timetable and who is coming to each class.
export default function ClassesAdmin() {
  const { business } = useAuth();
  const toast = useToast();
  const { settings, reloadSettings } = useOutletContext();
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('dia');
  const days = useMemo(() => nextDays(14), []);
  const [date, setDate] = useState(todayISO());
  const [openClass, setOpenClass] = useState(null);
  const { data: orders, reload } = useAsync(() => businessOrders(business.name), [business.name]);
  useEffect(() => subscribe('orders', () => reload()), [reload]);

  if (!settings) return <Skeleton />;
  const profile = settings.profile || {};
  const classes = profile.clases || [];
  const bookings = (orders || []).filter((o) => isClassBooking(o) && o.date === date);

  const save = async (next, msg) => {
    try {
      await saveRestaurantSettings(business.name, { profile: { ...profile, clases: next } });
      reloadSettings?.();
      toast(msg);
      setEditing(null);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const upsert = (c) => save(classes.some((x) => x.id === c.id) ? classes.map((x) => (x.id === c.id ? c : x)) : [...classes, c], 'Horario guardado');
  const remove = (id) => save(classes.filter((x) => x.id !== id), 'Clase quitada del horario');

  const list = classesOn(classes, date);
  const attendees = (c) => bookings.filter((o) => takenIn([o], c) && !GONE.includes(o.status));

  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title="Clases" right={<button className="btn primary sm" onClick={() => setEditing({})}><Icon name="plus" size={16} /> Clase</button>} />
      <SectionTabs />
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={tab === 'dia'} onClick={() => setTab('dia')}>Por día</button>
        <button role="tab" aria-selected={tab === 'semana'} onClick={() => setTab('semana')}>Horario semanal</button>
      </div>

      {classes.length === 0 ? (
        <div className="widget"><Empty icon="dumbbell" title="Monta tu horario">Añade cada clase con sus días, hora y plazas. Tus clientes reservan plaza y ves quién viene.<button className="btn primary" style={{ marginTop: 8 }} onClick={() => setEditing({})}>Añadir clase</button></Empty></div>
      ) : tab === 'semana' ? (
        <div className="cards-grid">
          {ORDER.map((d) => {
            const items = classes.filter((c) => (c.days || []).map(Number).includes(d)).sort((a, b) => a.time.localeCompare(b.time));
            if (!items.length) return null;
            return (
              <section key={d} className="widget" style={{ paddingBottom: 4 }}>
                <h2 className="title-md">{DAY_LONG[d]}</h2>
                {items.map((c) => (
                  <button key={c.id} className="list-row" style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', color: 'inherit' }} onClick={() => setEditing(c)}>
                    <span className="small" style={{ fontWeight: 800, width: 48 }}>{c.time}</span>
                    <span className="grow stack" style={{ gap: 1 }}>
                      <span className="t">{c.name}</span>
                      <span className="s">{[duration(c.min), c.teacher, `${c.plazas} plazas`].filter(Boolean).join(' · ')}</span>
                    </span>
                    <Icon name="edit" size={16} />
                  </button>
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <div className="day-strip">
            {days.map((d) => (
              <button key={d.iso} className="day-pill" aria-pressed={date === d.iso} onClick={() => setDate(d.iso)}>
                <span className="wd">{d.weekday}</span><span className="dn">{d.day}</span>
              </button>
            ))}
          </div>
          <section className="widget" style={{ paddingBottom: 4 }}>
            {list.length === 0 ? <p className="small muted">Este día no hay clases.</p> : list.map((c) => {
              const people = attendees(c);
              const inside = people.filter((o) => o.status !== STATUS.PENDING).length;
              const full = inside >= c.plazas;
              const isOpen = openClass === c.id;
              return (
                <div key={c.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                  <button className="class-slot" style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', color: 'inherit' }} onClick={() => setOpenClass(isOpen ? null : c.id)} aria-expanded={isOpen}>
                    <span className="when">{c.time}<small>{classEnd(c)}</small></span>
                    <span className="grow stack" style={{ gap: 4, minWidth: 0 }}>
                      <strong style={{ fontSize: 16 }}>{c.name}</strong>
                      <span className="small muted">{c.teacher ? `con ${c.teacher}` : ''}</span>
                      <span className="spots" aria-hidden="true"><span style={{ width: `${Math.min(1, inside / c.plazas) * 100}%`, background: full ? 'var(--danger)' : 'var(--ink)' }} /></span>
                    </span>
                    <span className="pill" style={{ background: full ? 'var(--danger-soft)' : 'var(--accent)' }}>{inside}/{c.plazas}</span>
                  </button>
                  {isOpen && (
                    <div className="stack" style={{ gap: 4, padding: '0 0 12px 64px' }}>
                      {people.length === 0 ? <span className="small muted">Nadie apuntado todavía.</span> : people.map((o) => (
                        <span key={o.id} className="small"><strong>{o.customer}</strong>{o.phone ? ` · ${o.phone}` : ''}{/Nota:/.test(o.items) ? <span className="muted"> · {o.items.split('Nota:')[1].trim()}</span> : null}{o.status === STATUS.PENDING ? <span className="muted"> · lista de espera</span> : null}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}

      {editing && <ClassSheet cls={editing} onClose={() => setEditing(null)} onSave={upsert} onDelete={remove} />}
    </div>
  );
}
