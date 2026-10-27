import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { PageHeader, Skeleton, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { getRestaurantSettings, saveRestaurantSettings } from '../../lib/data.js';
import { kindOf } from '../../lib/categories.js';

const DAYS = [
  { n: 1, label: 'L' }, { n: 2, label: 'M' }, { n: 3, label: 'X' }, { n: 4, label: 'J' },
  { n: 5, label: 'V' }, { n: 6, label: 'S' }, { n: 0, label: 'D' },
];

export default function Hours() {
  const { business } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newName, setNewName] = useState('');
  const { data, loading, setData } = useAsync(() => getRestaurantSettings(business.name, kindOf(business)), [business.name]);

  if (loading && !data) return <Skeleton />;
  const kind = kindOf(business);
  const withTeam = kind === 'beauty';
  const staff = data.staff || [];
  const closed = data.closed_days || [];

  const change = (patch) => { setData({ ...data, ...patch }); setDirty(true); };
  const toggleDay = (n) => change({ closed_days: closed.includes(n) ? closed.filter((d) => d !== n) : [...closed, n] });
  const addStaff = (e) => {
    e.preventDefault();
    const name = newName.trim().replace(/·/g, '').slice(0, 40);
    if (!name) return;
    if (staff.some((s) => s.name.toLowerCase() === name.toLowerCase())) { toast('Ya hay alguien con ese nombre', 'error'); return; }
    change({ staff: [...staff, { name }] });
    setNewName('');
  };

  const save = async () => {
    setBusy(true);
    try {
      const { lunch_start, lunch_end, dinner_start, dinner_end } = data;
      await saveRestaurantSettings(business.name, { lunch_start, lunch_end, dinner_start, dinner_end, closed_days: closed, staff });
      setDirty(false);
      toast('Horario guardado');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const time = (k, label) => (
    <div className="field">
      <label htmlFor={`h-${k}`}>{label}</label>
      <input id={`h-${k}`} className="input" type="time" step={900} value={data[k] || ''} onChange={(e) => change({ [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="page" style={{ maxWidth: 820, paddingBottom: dirty ? 200 : undefined }}>
      <PageHeader eyebrow={business.name} title={withTeam ? 'Horario y equipo' : 'Horario'} />

      <div className="widget stack">
        <h2 className="title-lg">{withTeam ? 'Horario de citas' : kind === 'shop' ? 'Horario de la tienda' : kind === 'taxi' ? 'Horario de servicio' : 'Horario'}</h2>
        <p className="small muted" style={{ margin: 0 }}>{withTeam ? 'Las citas solo se ofrecen si el servicio entero cabe dentro de un turno.' : kind === 'shop' ? 'Tus clientes solo pueden elegir recoger dentro de este horario. Si abres seguido, pon la tarde vacía.' : 'Se muestra en tu página. Deja la tarde vacía si no cierras a mediodía.'}</p>
        <div className="bento">{time('lunch_start', 'Mañana desde')}{time('lunch_end', 'Mañana hasta')}</div>
        <div className="bento">{time('dinner_start', 'Tarde desde')}{time('dinner_end', 'Tarde hasta')}</div>
        <span className="eyebrow" style={{ marginTop: 6 }}>Días que cierras</span>
        <div className="chips">
          {DAYS.map((d) => {
            const on = closed.includes(d.n);
            return (
              <button key={d.n} className={`chip ${on ? 'on' : ''}`} style={{ background: on ? undefined : 'var(--bg)', minWidth: 44 }} aria-pressed={on} onClick={() => toggleDay(d.n)}>{d.label}</button>
            );
          })}
        </div>
      </div>

      {withTeam && <div className="widget stack">
        <h2 className="title-lg">Equipo</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Cada profesional atiende una cita a la vez. Si sois varios, se pueden reservar citas a la misma hora y el cliente puede elegir con quién.
          {staff.length === 0 && ' Sin equipo, la agenda funciona como un solo puesto.'}
        </p>
        {staff.map((s, i) => (
          <div key={s.name} className="list-row">
            <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>{s.name.slice(0, 1).toUpperCase()}</span>
            <span className="grow t">{s.name}</span>
            <button className="icon-btn" onClick={() => change({ staff: staff.filter((_, j) => j !== i) })} aria-label={`Quitar a ${s.name}`}><Icon name="trash" size={18} /></button>
          </div>
        ))}
        <form className="row" style={{ gap: 8 }} onSubmit={addStaff}>
          <input className="input grow" aria-label="Nombre del profesional" placeholder="Nombre (ej. Laura)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn primary sm" disabled={!newName.trim()}><Icon name="plus" size={16} /> Añadir</button>
        </form>
      </div>}

      {dirty && (
        <button className="cta-bar above-tabs" onClick={save} disabled={busy}>
          <span style={{ fontSize: 14, opacity: 0.7 }}>Cambios sin guardar</span>
          <span className="go">{busy ? 'Guardando…' : 'Guardar'}</span>
        </button>
      )}
    </div>
  );
}
