import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import ContactTeam from '../../components/ContactTeam.jsx';
import { Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { createMyBusiness, requestBusinessSignup } from '../../lib/data.js';
import { BUSINESS_TYPES } from '../../lib/businessTypes.js';
import { AuthForms, ClaimSheet } from '../customer/Account.jsx';

const FEATURES = [
  { icon: 'calendar', title: 'Reservas online', text: 'Tus clientes eligen día y hora. Tú confirmas con un toque y les avisamos por correo.' },
  { icon: 'gear', title: 'Un panel a tu medida', text: 'Respondes unas preguntas sobre tu negocio y el panel se monta solo con lo que vas a usar.' },
  { icon: 'book', title: 'Carta y catálogo', text: 'Publica tu carta o tus productos con precios siempre al día.' },
  { icon: 'chat', title: 'Mensajes', text: 'Habla con tus clientes desde el mismo panel, sin dar tu número personal.' },
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
  return (
    <div className="stack">
      <h2 className="title-lg" style={{ margin: '0 4px' }}>¿Qué tipo de negocio tienes?</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
        {BUSINESS_TYPES.map((t) => (
          <button key={t.key} className="widget link row" onClick={() => onPick(t)} style={{ border: 0, textAlign: 'left', gap: 12, display: 'flex', flexDirection: 'row', alignItems: 'center', opacity: t.ready || t.other ? 1 : 0.85 }}>
            <span className="mono" style={{ background: t.ready ? 'var(--accent)' : 'var(--bg)', color: 'var(--ink)', flex: '0 0 auto' }}><Icon name={t.icon} /></span>
            <span className="grow stack" style={{ gap: 0 }}>
              <strong>{t.label}</strong>
              <span className="small muted">{t.ready ? 'Disponible' : t.other ? 'Cuéntanos qué haces' : 'Próximamente'}</span>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

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
      <div className="field"><label htmlFor="nb-name">Nombre del negocio</label><input id="nb-name" className="input" required minLength={2} maxLength={80} value={form.name} onChange={set('name')} placeholder="Ej.: Casa Lucio" /></div>
      <div className="field"><label htmlFor="nb-phone">Teléfono</label><input id="nb-phone" className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="979 00 00 00" /></div>
      <div className="field"><label htmlFor="nb-addr">Dirección</label><input id="nb-addr" className="input" value={form.address} onChange={set('address')} placeholder="Calle Mayor 1, Palencia" /></div>
      <p className="small muted" style={{ margin: 0 }}>Ahora te haremos unas preguntas para montar tu panel. Tu página será pública en cuanto revisemos el alta.</p>
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
  const [claimOpen, setClaimOpen] = useState(false);

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
            Llena tu agenda sin coger el teléfono.
          </h1>
          <p style={{ opacity: 0.7, fontSize: 17, margin: 0, maxWidth: 560 }}>Date de alta en 3 pasos y tendrás un panel hecho a la medida de tu negocio.</p>
        </div>
      </header>

      <main className="two-col" style={{ maxWidth: 1040, margin: '-36px auto 0', padding: '0 var(--gutter) 48px' }}>
        <div className="stack">
          <div className="widget"><Steps current={step} /></div>

          {!user && (
            <>
              <AuthForms next="/negocios" initialTab="up" />
              <p className="small muted" style={{ margin: '0 4px' }}>Usa el correo de tu negocio. Te enviaremos un enlace para confirmarlo.</p>
            </>
          )}
          {user && !type && <TypePicker onPick={setType} />}
          {user && type?.ready && <CreateForm type={type} onBack={() => setType(null)} />}
          {user && type && !type.ready && <NotYetForm type={type} onBack={() => setType(null)} />}

          {user && (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', padding: '0 4px' }}>
              <span className="small muted">Conectado como {user.email}.</span>
              <button className="btn ghost sm" onClick={() => setClaimOpen(true)}>Ya tenía un negocio en NetWish</button>
              <button className="btn ghost sm" onClick={() => { setType(null); signOut(); }}>Usar otra cuenta</button>
            </div>
          )}
        </div>

        <div className="stack">
          {FEATURES.map((f) => (
            <div key={f.title} className="widget row" style={{ alignItems: 'flex-start', gap: 14 }}>
              <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)', flex: '0 0 auto' }}><Icon name={f.icon} /></span>
              <span className="stack" style={{ gap: 2 }}>
                <strong>{f.title}</strong>
                <span className="small muted">{f.text}</span>
              </span>
            </div>
          ))}
          <ContactTeam dark />
        </div>
      </main>

      <ClaimSheet open={claimOpen} onClose={() => setClaimOpen(false)} />
    </div>
  );
}
