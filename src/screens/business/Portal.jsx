import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { createMyBusiness, requestBusinessSignup } from '../../lib/data.js';
import { BUSINESS_TYPES } from '../../lib/businessTypes.js';
import { AuthForms } from '../customer/Account.jsx';

const PROMISES = [
  'Reservas, citas y pedidos para recoger, sin comisión',
  'Tu catálogo con fotos, tu agenda y tus clientes en el móvil',
  'Recordatorio al cliente para que no te falle',
  'Tu enlace para Google, Instagram y WhatsApp',
];

const STEPS = ['Tu cuenta', 'Tipo de negocio', 'Tus datos'];

function Steps({ current }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {STEPS.map((s, i) => (
        <span key={s} className="grow stack" style={{ gap: 6 }}>
          <span style={{ height: 6, borderRadius: 3, background: i <= current ? 'var(--ink)' : 'var(--line)' }} />
          <span className="small" style={{ fontWeight: i === current ? 800 : 500, color: i === current ? 'var(--ink)' : 'var(--muted)' }}>{s}</span>
        </span>
      ))}
    </div>
  );
}

function TypePicker({ onPick }) {
  const list = BUSINESS_TYPES.filter((t) => !t.hidden && !t.other);
  const other = BUSINESS_TYPES.find((t) => t.other);
  return (
    <div className="stack">
      <h2 className="title-lg" style={{ margin: '0 4px' }}>¿Qué tipo de negocio tienes?</h2>
      <div className="widget" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {list.map((t) => (
          <button key={t.key} className="list-row" onClick={() => onPick(t)} style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', color: 'inherit' }}>
            <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)', flex: 'none' }}><Icon name={t.icon} size={20} /></span>
            <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
              <span className="t" style={{ fontSize: 15 }}>{t.label}</span>
              {t.pitch && <span className="s">{t.pitch}</span>}
            </span>
            <Icon name="chevron" size={18} />
          </button>
        ))}
      </div>
      {other && (
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => onPick(other)}>Mi negocio no está en la lista</button>
      )}
    </div>
  );
}

const NEXT = {
  restaurant: 'Después, 2 minutos de preguntas sobre tu horario y tus mesas, y tu panel estará listo.',
  shop: 'Después, unas preguntas rápidas (horario, cómo cobras, si preparas pedidos) y ya puedes subir tus productos con fotos.',
  beauty: 'Después, unas preguntas rápidas sobre tu horario y tu equipo, y añades tus servicios con su duración.',
  classes: 'Después, unas preguntas rápidas y montas tu horario de clases con sus plazas.',
  taxi: 'Después, unas preguntas rápidas sobre tu vehículo y tu horario, y ya te pueden reservar viajes.',
};

function CreateForm({ type, onBack }) {
  const { refreshBusiness } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value.slice(0, 160) }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createMyBusiness({ name: form.name, category: type.category, phone: form.phone, address: form.address });
      await refreshBusiness();
      navigate('/panel/empezar', { replace: true });
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <form className="widget stack" onSubmit={submit}>
      <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={onBack}><Icon name="back" size={16} /> Cambiar tipo</button>
      <span className="eyebrow">{type.label}</span>
      <h2 className="title-lg">Los datos de tu negocio</h2>
      <div className="field"><label htmlFor="nb-name">Nombre del negocio</label><input id="nb-name" className="input" required minLength={2} maxLength={80} value={form.name} onChange={set('name')} placeholder={type.engine === 'restaurant' ? 'Ej.: Casa Lucio' : type.engine === 'shop' ? 'Ej.: Moda Carmen' : 'El nombre que ve la gente'} /></div>
      <div className="field"><label htmlFor="nb-phone">Teléfono</label><input id="nb-phone" className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="979 00 00 00" /></div>
      <div className="field"><label htmlFor="nb-addr">Dirección</label><input id="nb-addr" className="input" value={form.address} onChange={set('address')} placeholder="Calle Mayor 1, Palencia" /></div>
      <p className="small muted" style={{ margin: 0 }}>{NEXT[type.engine] || NEXT.beauty}</p>
      <button className="btn primary block" disabled={busy}>{busy ? 'Creando…' : 'Crear mi negocio'}</button>
    </form>
  );
}

function NotYetForm({ type, onBack }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', phone: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await requestBusinessSignup({
        kind: type.other ? 'otro' : 'alta',
        name: form.name.trim().slice(0, 80),
        category: type.category,
        city: 'Palencia',
        email: user.email,
        phone: form.phone.trim() || null,
        description: form.description.trim().slice(0, 1200) || null,
      });
      setDone(true);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="widget stack" style={{ alignItems: 'center', textAlign: 'center', padding: '28px 20px' }}>
        <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={28} stroke={3} /></span>
        <h2 className="title-lg">¡Recibido!</h2>
        <p className="muted" style={{ margin: 0 }}>Estamos preparando NetWish para negocios como el tuyo. Te escribiremos a {user.email} en cuanto esté listo.</p>
      </div>
    );
  }

  return (
    <form className="widget stack" onSubmit={submit}>
      <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={onBack}><Icon name="back" size={16} /> Cambiar tipo</button>
      <span className="eyebrow">{type.other ? 'Tu negocio' : `${type.label} · Próximamente`}</span>
      <h2 className="title-lg">{type.other ? 'Cuéntanos qué hace tu negocio' : 'Aún estamos preparando tu panel'}</h2>
      <p className="small muted" style={{ margin: 0 }}>
        {type.other
          ? 'Explícalo con tus palabras: qué ofreces, cómo te contratan o te reservan tus clientes y qué te gustaría controlar desde el móvil. Con eso preparamos tus preguntas y tu panel.'
          : 'Déjanos tus datos y te avisamos en cuanto esté. Si nos cuentas cómo trabajas, lo haremos a tu medida.'}
      </p>
      <div className="field"><label htmlFor="ny-name">Nombre del negocio</label><input id="ny-name" className="input" required minLength={2} value={form.name} onChange={set('name')} /></div>
      <div className="field">
        <label htmlFor="ny-desc">{type.other ? '¿A qué se dedica tu negocio?' : '¿Qué te gustaría poder hacer? (opcional)'}</label>
        <textarea id="ny-desc" className="input" rows={5} required={type.other} minLength={type.other ? 20 : undefined} maxLength={1200} value={form.description} onChange={set('description')}
          placeholder={type.other ? 'Ej.: Soy fotógrafa. Hago sesiones de 1 hora en estudio o en exteriores y bodas completas. Me reservan con una señal y les entrego las fotos en 2 semanas.' : 'Ej.: que mis clientes reserven cita y vean mis precios.'} />
      </div>
      <div className="field"><label htmlFor="ny-phone">Teléfono (opcional)</label><input id="ny-phone" className="input" type="tel" value={form.phone} onChange={set('phone')} /></div>
      <button className="btn primary block" disabled={busy}>{busy ? 'Enviando…' : 'Enviar'}</button>
    </form>
  );
}

// netwish.es/negocios: the door for business owners, kept apart from the everyday app.
export default function Portal() {
  const { ready, user, business, signOut } = useAuth();
  const [type, setType] = useState(null);

  if (!ready) return <Spinner />;
  if (business) return <Navigate to="/panel" replace />;
  const step = !user ? 0 : type ? 2 : 1;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--ink)', color: '#fff', padding: 'calc(20px + var(--safe-top)) var(--gutter) 64px' }}>
        <div className="row between" style={{ maxWidth: 1040, margin: '0 auto' }}>
          <span className="row" style={{ gap: 10 }}>
            <img src="/icon.svg" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>NetWish <span style={{ color: 'var(--accent)' }}>Negocios</span></span>
          </span>
          <Link to="/" className="small" style={{ color: 'rgba(255,255,255,.7)', fontWeight: 600, textDecoration: 'none' }}>Ir a NetWish</Link>
        </div>
        <div className="stack" style={{ maxWidth: 1040, margin: '40px auto 0', gap: 12 }}>
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>Para comercios de Palencia</span>
          <h1 style={{ fontSize: 'clamp(34px, 6vw, 56px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.02, margin: 0, maxWidth: 680 }}>
            Tu negocio, abierto también en el móvil de tus clientes.
          </h1>
          <ul className="stack" style={{ gap: 6, margin: 0, padding: 0, listStyle: 'none', maxWidth: 560 }}>
            {PROMISES.map((p) => (
              <li key={p} className="row" style={{ gap: 10, fontSize: 16, opacity: 0.85 }}>
                <Icon name="check" size={16} stroke={3} style={{ color: 'var(--accent)', flex: '0 0 auto' }} />{p}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <main className="stack" style={{ maxWidth: 560, margin: '-36px auto 0', padding: '0 var(--gutter) 48px' }}>
        <div className="widget"><Steps current={step} /></div>

        {!user && <AuthForms next="/negocios" initialTab="up" simple />}
        {user && !type && <TypePicker onPick={setType} />}
        {user && type && !type.other && <CreateForm type={type} onBack={() => setType(null)} />}
        {user && type?.other && <NotYetForm type={type} onBack={() => setType(null)} />}

        {user && (
          <p className="small muted" style={{ margin: '0 4px' }}>
            Conectado como {user.email}. <button className="btn ghost sm" style={{ display: 'inline', height: 'auto', padding: 0, textDecoration: 'underline' }} onClick={() => { setType(null); signOut(); }}>Usar otra cuenta</button>
          </p>
        )}
      </main>
    </div>
  );
}
