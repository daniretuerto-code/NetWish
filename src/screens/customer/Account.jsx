import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Mono, PageHeader, Sheet, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { claimBusiness, requestBusinessSignup } from '../../lib/data.js';
import { CATEGORIES } from '../../lib/categories.js';

function AuthForms() {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('in');
  const [form, setForm] = useState({ email: '', password: '', name: '', surname: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === 'in') await signIn(form.email.trim(), form.password);
      else if (tab === 'up') {
        if (form.password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
        const res = await signUp({ ...form, email: form.email.trim() });
        if (!res.session) setSent(true);
      } else {
        await resetPassword(form.email.trim());
        toast('Te hemos enviado un enlace para cambiar la contraseña');
        setTab('in');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="widget stack" style={{ alignItems: 'center', textAlign: 'center', padding: '28px 20px' }}>
        <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="mail" size={28} /></span>
        <h2 className="title-lg">Revisa tu correo</h2>
        <p className="muted">Te hemos enviado un enlace a {form.email} para activar tu cuenta.</p>
      </div>
    );
  }

  return (
    <div className="widget stack">
      <div className="segmented" style={{ background: 'var(--bg)' }} role="tablist">
        <button role="tab" aria-selected={tab === 'in'} onClick={() => setTab('in')}>Entrar</button>
        <button role="tab" aria-selected={tab === 'up'} onClick={() => setTab('up')}>Crear cuenta</button>
      </div>
      <form className="stack" onSubmit={submit}>
        {tab === 'up' && (
          <div className="bento">
            <div className="field"><label htmlFor="su-name">Nombre</label><input id="su-name" className="input" required value={form.name} onChange={set('name')} autoComplete="given-name" /></div>
            <div className="field"><label htmlFor="su-surname">Apellidos</label><input id="su-surname" className="input" value={form.surname} onChange={set('surname')} autoComplete="family-name" /></div>
          </div>
        )}
        <div className="field"><label htmlFor="au-email">Correo</label><input id="au-email" className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></div>
        {tab !== 'reset' && (
          <div className="field"><label htmlFor="au-pass">Contraseña</label><input id="au-pass" className="input" type="password" required value={form.password} onChange={set('password')} autoComplete={tab === 'up' ? 'new-password' : 'current-password'} /></div>
        )}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Un momento…' : tab === 'in' ? 'Entrar' : tab === 'up' ? 'Crear cuenta' : 'Enviar enlace'}
        </button>
      </form>
      {tab === 'in' && <button className="btn ghost sm" onClick={() => setTab('reset')}>He olvidado mi contraseña</button>}
      {tab === 'reset' && <button className="btn ghost sm" onClick={() => setTab('in')}>Volver</button>}
      <div className="row" style={{ gap: 10, color: 'var(--muted)' }}><span className="grow" style={{ height: 1, background: 'var(--line)' }} /><span className="small">o</span><span className="grow" style={{ height: 1, background: 'var(--line)' }} /></div>
      <button className="btn soft block" onClick={() => signInWithGoogle().catch((e) => toast(e.message, 'error'))}>
        <Icon name="google" size={18} /> Continuar con Google
      </button>
    </div>
  );
}

function ClaimSheet({ open, onClose }) {
  const { refreshBusiness, setMode } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await claimBusiness(username.trim(), password);
      await refreshBusiness();
      setMode('business');
      toast('Negocio vinculado a tu cuenta');
      onClose();
      navigate('/panel');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Vincular mi negocio">
      <form className="stack" onSubmit={submit}>
        <p className="small muted">Escribe el usuario y la contraseña que usabas para entrar al panel de tu negocio. Solo hace falta una vez: a partir de ahora entrarás con esta cuenta.</p>
        <div className="field"><label htmlFor="cl-user">Usuario del negocio</label><input id="cl-user" className="input" required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></div>
        <div className="field"><label htmlFor="cl-pass">Contraseña del negocio</label><input id="cl-pass" className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
        <button className="btn primary block" disabled={busy}>{busy ? 'Comprobando…' : 'Vincular'}</button>
      </form>
    </Sheet>
  );
}

function SignupSheet({ open, onClose, email }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', city: 'Palencia', address: '', category: CATEGORIES[0].label, modality: 'Local físico', email: email || '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value.slice(0, 200) }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await requestBusinessSignup({ ...form, name: form.name.trim(), email: form.email.trim() });
      setDone(true);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Dar de alta mi negocio">
      {done ? (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
          <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={28} stroke={3} /></span>
          <h2 className="title-lg">Solicitud enviada</h2>
          <p className="muted">Te escribiremos a {form.email} en cuanto tu negocio esté listo.</p>
          <button className="btn primary block" onClick={onClose}>Hecho</button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <div className="field"><label htmlFor="bs-name">Nombre del negocio</label><input id="bs-name" className="input" required minLength={2} value={form.name} onChange={set('name')} /></div>
          <div className="bento">
            <div className="field"><label htmlFor="bs-cat">Sector</label>
              <select id="bs-cat" className="input" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="bs-mod">Modalidad</label>
              <select id="bs-mod" className="input" value={form.modality} onChange={set('modality')}>
                <option>Local físico</option><option>Online</option><option>A domicilio</option>
              </select>
            </div>
          </div>
          <div className="bento">
            <div className="field"><label htmlFor="bs-city">Ciudad</label><input id="bs-city" className="input" value={form.city} onChange={set('city')} /></div>
            <div className="field"><label htmlFor="bs-phone">Teléfono</label><input id="bs-phone" className="input" type="tel" value={form.phone} onChange={set('phone')} /></div>
          </div>
          <div className="field"><label htmlFor="bs-addr">Dirección</label><input id="bs-addr" className="input" value={form.address} onChange={set('address')} /></div>
          <div className="field"><label htmlFor="bs-email">Correo de contacto</label><input id="bs-email" className="input" type="email" required value={form.email} onChange={set('email')} /></div>
          <button className="btn primary block" disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
        </form>
      )}
    </Sheet>
  );
}

export default function Account() {
  const { user, business, displayName, avatar, setMode, signOut } = useAuth();
  const navigate = useNavigate();
  const [claimOpen, setClaimOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <PageHeader eyebrow="NetWish" title={user ? 'Tu cuenta' : 'Bienvenido'} />

      {!user ? (
        <>
          <AuthForms />
          <button className="widget link row" onClick={() => setSignupOpen(true)} style={{ border: 0, textAlign: 'left', width: '100%' }}>
            <span className="mono" style={{ background: 'var(--ink)', color: 'var(--accent)' }}><Icon name="store" /></span>
            <span className="grow stack" style={{ gap: 0 }}>
              <strong>¿Tienes un negocio en Palencia?</strong>
              <span className="small muted">Solicita el alta y empieza a recibir pedidos.</span>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        </>
      ) : (
        <>
          <div className="widget row" style={{ gap: 14 }}>
            <Mono name={displayName} image={avatar} size="lg" />
            <span className="grow stack" style={{ gap: 0, minWidth: 0 }}>
              <span className="title-lg">{displayName}</span>
              <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
            </span>
          </div>

          <div className="bento">
            <Link to="/pedidos" className="widget link stack" style={{ gap: 18 }}>
              <Icon name="bag" size={24} />
              <strong>Mis pedidos</strong>
            </Link>
            <Link to="/escanear" className="widget link dark stack" style={{ gap: 18 }}>
              <Icon name="scan" size={24} />
              <strong>Escanear QR</strong>
            </Link>
          </div>

          <div className="widget dark stack">
            <span className="eyebrow">Para comercios</span>
            {business ? (
              <>
                <span className="row" style={{ gap: 12 }}>
                  <Mono name={business.name} image={business.image} />
                  <span className="title-lg">{business.name}</span>
                </span>
                <button className="btn accent block" onClick={() => { setMode('business'); navigate('/panel'); }}>Ir a mi panel</button>
              </>
            ) : (
              <>
                <p style={{ opacity: 0.75, margin: 0 }}>Si ya tenías un negocio en NetWish, vincúlalo a esta cuenta una sola vez.</p>
                <button className="btn accent block" onClick={() => setClaimOpen(true)}>Vincular mi negocio</button>
                <button className="btn ghost block" style={{ color: '#fff' }} onClick={() => setSignupOpen(true)}>Dar de alta un negocio nuevo</button>
              </>
            )}
          </div>

          <button className="btn soft block" onClick={() => signOut().then(() => navigate('/'))}>
            <Icon name="logout" size={18} /> Cerrar sesión
          </button>
        </>
      )}

      <ClaimSheet open={claimOpen} onClose={() => setClaimOpen(false)} />
      <SignupSheet open={signupOpen} onClose={() => setSignupOpen(false)} email={user?.email} />
    </div>
  );
}
