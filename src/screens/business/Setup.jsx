import { useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { PageHeader, Ring, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { saveRestaurantSettings } from '../../lib/data.js';
import { isAnswered, profileProgress, RESTAURANT_SECTIONS, sectionProgress, settingsFromProfile, visibleQuestions } from '../../lib/questionnaire.js';

function Option({ on, onClick, children }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="row between"
      style={{ width: '100%', minHeight: 56, padding: '0 18px', borderRadius: 18, border: 0, fontSize: 17, fontWeight: 700, textAlign: 'left', background: on ? 'var(--ink)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink)', boxShadow: on ? 'none' : 'var(--shadow)' }}>
      <span>{children}</span>
      {on && <Icon name="check" size={18} stroke={3} style={{ color: 'var(--accent)' }} />}
    </button>
  );
}

function Answer({ q, answers, set }) {
  const value = answers[q.id];
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10 };

  if (q.type === 'yesno') {
    return (
      <div style={grid}>
        <Option on={value === true} onClick={() => set({ [q.id]: true })}>Sí</Option>
        <Option on={value === false} onClick={() => set({ [q.id]: false })}>No</Option>
      </div>
    );
  }
  if (q.type === 'choice') {
    return (
      <div style={grid}>
        {q.options.map((o) => <Option key={o.value} on={value === o.value} onClick={() => set({ [q.id]: o.value })}>{o.label}</Option>)}
      </div>
    );
  }
  if (q.type === 'multi' || q.type === 'days') {
    const list = Array.isArray(value) ? value : [];
    const toggle = (v) => set({ [q.id]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] });
    return (
      <div style={grid}>
        {q.options.map((o) => <Option key={o.value} on={list.includes(o.value)} onClick={() => toggle(o.value)}>{o.label}</Option>)}
      </div>
    );
  }
  if (q.type === 'number') {
    const n = value ?? q.def;
    const change = (d) => set({ [q.id]: Math.min(q.max, Math.max(q.min, Number(n) + d)) });
    return (
      <div className="widget row between" style={{ maxWidth: 360 }}>
        <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => change(-1)} aria-label="Menos"><Icon name="minus" /></button>
        <input className="input price" aria-label={q.label} inputMode="numeric" value={n} onChange={(e) => set({ [q.id]: Math.min(q.max, Number(e.target.value.replace(/\D/g, '')) || 0) })}
          style={{ width: 96, textAlign: 'center', fontSize: 32, fontWeight: 800, background: 'none', border: 0 }} />
        <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => change(1)} aria-label="Más"><Icon name="plus" /></button>
      </div>
    );
  }
  if (q.type === 'range') {
    const [a, b] = q.keys;
    return (
      <div className="widget bento" style={{ maxWidth: 480 }}>
        <div className="field"><label htmlFor={`${q.id}-a`}>Desde</label><input id={`${q.id}-a`} className="input" type="time" step={900} value={answers[a] || q.defaults[0]} onChange={(e) => set({ [a]: e.target.value })} /></div>
        <div className="field"><label htmlFor={`${q.id}-b`}>Hasta</label><input id={`${q.id}-b`} className="input" type="time" step={900} value={answers[b] || q.defaults[1]} onChange={(e) => set({ [b]: e.target.value })} /></div>
      </div>
    );
  }
  return (
    <textarea className="input" rows={4} maxLength={400} aria-label={q.label} placeholder={q.placeholder} value={value || ''} onChange={(e) => set({ [q.id]: e.target.value })} style={{ maxWidth: 560 }} />
  );
}

// Fills in what a question shows by default, so "Siguiente" keeps the value on screen.
function withDefaults(q, answers) {
  if (q.type === 'number' && answers[q.id] === undefined) return { [q.id]: q.def };
  if (q.type === 'range') {
    const [a, b] = q.keys;
    return { [a]: answers[a] || q.defaults[0], [b]: answers[b] || q.defaults[1] };
  }
  if ((q.type === 'multi' || q.type === 'days') && !Array.isArray(answers[q.id])) return { [q.id]: [] };
  if (q.type === 'text' && answers[q.id] === undefined) return { [q.id]: '' };
  return {};
}

function Wizard({ section, onboarding }) {
  const { business } = useAuth();
  const { settings, reloadSettings } = useOutletContext();
  const navigate = useNavigate();
  const toast = useToast();
  const [answers, setAnswers] = useState(() => ({ ...(settings?.profile || {}) }));
  const [i, setI] = useState(0);
  const [saving, setSaving] = useState(false);

  const qs = visibleQuestions(section, answers);
  const q = qs[Math.min(i, qs.length - 1)];
  const last = i >= qs.length - 1;
  const needsPick = q.type === 'choice' || q.type === 'yesno';

  const finish = async (final) => {
    setSaving(true);
    try {
      const profile = { ...final, ...(onboarding ? { onboarded: true } : {}) };
      const patch = section.onboarding ? settingsFromProfile(profile, settings) : {};
      await saveRestaurantSettings(business.name, { ...patch, profile });
      await reloadSettings();
      toast(onboarding ? '¡Tu panel está listo!' : 'Guardado');
      navigate(onboarding ? '/panel' : '/panel/personalizar', { replace: true });
    } catch (e) {
      toast(e.message, 'error');
      setSaving(false);
    }
  };

  const next = (patch = {}) => {
    const merged = { ...answers, ...withDefaults(q, answers), ...patch };
    setAnswers(merged);
    if (last) finish(merged);
    else setI((n) => n + 1);
  };
  // Single-choice answers move on by themselves, so the tap and the step share one update.
  const pick = (patch) => (needsPick ? next(patch) : setAnswers((a) => ({ ...a, ...patch })));

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="row between">
        {i > 0 ? (
          <button className="icon-btn" onClick={() => setI((n) => n - 1)} aria-label="Pregunta anterior"><Icon name="back" stroke={2.6} /></button>
        ) : onboarding ? <span style={{ width: 44 }} /> : (
          <Link to="/panel/personalizar" className="icon-btn" aria-label="Volver"><Icon name="back" stroke={2.6} /></Link>
        )}
        <span className="small muted" style={{ fontWeight: 700 }}>{section.title} · {i + 1} de {qs.length}</span>
        <span style={{ width: 44 }} />
      </div>
      <div className="progress-steps" style={{ gridTemplateColumns: `repeat(${qs.length}, 1fr)` }}>
        {qs.map((x, n) => <span key={x.id} style={{ background: n <= i ? 'var(--ink)' : 'var(--line)' }} />)}
      </div>

      {i === 0 && section.intro && <p className="muted" style={{ margin: '4px 4px 0' }}>{section.intro}</p>}
      <h1 className="title-xl" style={{ margin: '8px 4px 0' }}>{q.label}</h1>
      {q.help && <p className="muted" style={{ margin: '0 4px' }}>{q.help}</p>}

      <Answer key={q.id} q={q} answers={answers} set={pick} />

      {!needsPick && (
        <button className="btn primary block" style={{ maxWidth: 360 }} disabled={saving} onClick={() => next()}>
          {saving ? 'Guardando…' : last ? (onboarding ? 'Crear mi panel' : 'Guardar') : q.type === 'text' && !answers[q.id] ? 'Saltar' : 'Siguiente'}
        </button>
      )}
      {needsPick && last && isAnswered(q, answers) && (
        <button className="btn primary block" style={{ maxWidth: 360 }} disabled={saving} onClick={() => finish(answers)}>{saving ? 'Guardando…' : 'Guardar'}</button>
      )}
    </div>
  );
}

export function Onboarding() {
  const { settings } = useOutletContext();
  if (!settings) return <Spinner />;
  return <Wizard section={RESTAURANT_SECTIONS[0]} onboarding={!settings.profile?.onboarded} />;
}

export function SectionWizard() {
  const { key } = useParams();
  const { settings } = useOutletContext();
  const section = RESTAURANT_SECTIONS.find((s) => s.key === key);
  if (!settings) return <Spinner />;
  if (!section) return <Navigate to="/panel/personalizar" replace />;
  return <Wizard section={section} />;
}

export default function Personalize() {
  const { business } = useAuth();
  const { settings } = useOutletContext();
  if (!settings) return <Spinner />;
  const answers = settings.profile || {};
  const pct = profileProgress(answers);
  const sections = RESTAURANT_SECTIONS.filter((s) => !s.when || s.when(answers));

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <PageHeader eyebrow={business.name} title="Personaliza tu negocio" />
      <div className="widget dark row" style={{ gap: 16 }}>
        <Ring value={pct / 100} color="var(--accent)" label={`Perfil completado al ${pct} %`} />
        <span className="stack" style={{ gap: 2 }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{pct} % completado</span>
          <span className="small" style={{ opacity: 0.7 }}>Cada respuesta ajusta tu panel o lo que ven tus clientes.</span>
        </span>
      </div>
      <div className="widget" style={{ paddingBottom: 4 }}>
        {sections.map((s) => {
          const p = sectionProgress(s, answers);
          const complete = p.done >= p.total;
          return (
            <Link key={s.key} to={s.onboarding ? '/panel/empezar' : `/panel/personalizar/${s.key}`} className="list-row">
              <span className="mono" style={{ background: complete ? 'var(--accent)' : 'var(--bg)', color: 'var(--ink)' }}>
                {complete ? <Icon name="check" size={18} stroke={3} /> : `${p.done}/${p.total}`}
              </span>
              <span className="grow stack" style={{ gap: 1 }}>
                <span className="t">{s.title}</span>
                <span className="s">{s.intro}</span>
              </span>
              <Icon name="chevron" size={18} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
