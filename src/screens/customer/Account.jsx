import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Mono, PageHeader, Sheet, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { claimBusiness } from '../../lib/data.js';
import { LegalLinks } from './Legal.jsx';
import { useFavorites } from '../../lib/favorites.js';

// At least 8 characters with letters and numbers; Supabase stores only a hash.
const weakPassword = (p) => p.length < 8 || !/[a-zA-Z]/.test(p) || !/\d/.test(p);

export function AuthForms({ next = '/cuenta', initialTab = 'in', simple = false }) {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState(initialTab);
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
        if (weakPassword(form.password)) throw new Error('La contraseña necesita al menos 8 caracteres, con letras y números');
        const res = await signUp({ ...form, email: form.email.trim(), next });
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
        {tab === 'up' && simple && (
          <div className="field"><label htmlFor="su-name">Tu nombre</label><input id="su-name" className="input" required value={form.name} onChange={set('name')} autoComplete="name" /></div>
        )}
        {tab === 'up' && !simple && (
          <div className="bento">
            <div className="field"><label htmlFor="su-name">Nombre</label><input id="su-name" className="input" required value={form.name} onChange={set('name')} autoComplete="given-name" /></div>
            <div className="field"><label htmlFor="su-surname">Apellidos</label><input id="su-surname" className="input" value={form.surname} onChange={set('surname')} autoComplete="family-name" /></div>
          </div>
        )}
        <div className="field"><label htmlFor="au-email">Correo</label><input id="au-email" className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></div>
        {tab !== 'reset' && (
          <div className="field">
            <label htmlFor="au-pass">Contraseña</label>
            <input id="au-pass" className="input" type="password" required minLength={tab === 'up' ? 8 : undefined} value={form.password} onChange={set('password')} autoComplete={tab === 'up' ? 'new-password' : 'current-password'} />
            {tab === 'up' && <span className="small muted">Mínimo 8 caracteres, con letras y números. Se guarda cifrada: nadie puede verla.</span>}
          </div>
        )}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Un momento…' : tab === 'in' ? 'Entrar' : tab === 'up' ? 'Crear cuenta' : 'Enviar enlace'}
        </button>
      </form>
      {tab === 'in' && <button className="btn ghost sm" onClick={() => setTab('reset')}>He olvidado mi contraseña</button>}
      {tab === 'reset' && <button className="btn ghost sm" onClick={() => setTab('in')}>Volver</button>}
      <div className="row" style={{ gap: 10, color: 'var(--muted)' }}><span className="grow" style={{ height: 1, background: 'var(--line)' }} /><span className="small">o</span><span className="grow" style={{ height: 1, background: 'var(--line)' }} /></div>
      <button className="btn soft block" onClick={() => signInWithGoogle(next).catch((e) => toast(e.message, 'error'))}>
        <Icon name="google" size={18} /> Continuar con Google
      </button>
    </div>
  );
}

export function ClaimSheet({ open, onClose }) {
  const { refreshBusiness } = useAuth();
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

function Favorites() {
  const [favs, toggle] = useFavorites();
  if (!favs.length) return null;
  return (
    <div className="widget stack" style={{ gap: 6 }}>
      <span className="eyebrow">Tus favoritos</span>
      {favs.map((f) => (
        <div key={f.name} className="row" style={{ gap: 10 }}>
          <Link to={`/negocio/${encodeURIComponent(f.name)}`} className="row grow" style={{ gap: 10, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
            <Mono name={f.name} image={f.image} />
            <span className="stack grow" style={{ gap: 0, minWidth: 0 }}><strong>{f.name}</strong>{f.category && <span className="small muted">{f.category}</span>}</span>
          </Link>
          <button className="icon-btn" aria-label={`Quitar ${f.name} de favoritos`} onClick={() => toggle(f)}><Icon name="close" size={16} /></button>
        </div>
      ))}
    </div>
  );
}

function DeleteAccount() {
  const { deleteAccount, business } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      toast('Tu cuenta y tus datos se han borrado');
      navigate('/');
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };
  return (
    <>
      <button className="btn ghost sm" style={{ alignSelf: 'center', color: 'var(--muted)' }} onClick={() => setOpen(true)}>Borrar mi cuenta</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Borrar mi cuenta">
        <div className="stack">
          {business ? (
            <p className="small" style={{ margin: 0 }}>Tu cuenta lleva el panel de <strong>{business.name}</strong>. Para borrarla, primero escríbenos para dar de baja el negocio; así no pierdes las reservas de tus clientes.</p>
          ) : (
            <>
              <p className="small" style={{ margin: 0 }}>Se borran tu cuenta, tus datos y tus mensajes. Las reservas que ya hiciste se quedan en el negocio sin tu correo ni tu teléfono. No se puede deshacer.</p>
              <div className="field"><label htmlFor="del-ok">Escribe BORRAR para confirmar</label><input id="del-ok" className="input" value={text} onChange={(e) => setText(e.target.value)} /></div>
              <button className="btn primary block" style={{ background: 'var(--danger, #C0392B)' }} disabled={busy || text.trim().toUpperCase() !== 'BORRAR'} onClick={go}>{busy ? 'Borrando…' : 'Borrar para siempre'}</button>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}

export default function Account() {
  const { user, business, displayName, avatar, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <PageHeader eyebrow="NetWish" title={user ? 'Tu cuenta' : 'Bienvenido'} />

      {!user ? (
        <>
          <AuthForms />
          <Link to="/negocios" className="widget link row" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <span className="mono" style={{ background: 'var(--ink)', color: 'var(--accent)' }}><Icon name="store" /></span>
            <span className="grow stack" style={{ gap: 0 }}>
              <strong>¿Tienes un negocio en Palencia?</strong>
              <span className="small muted">Entra en NetWish para negocios.</span>
            </span>
            <Icon name="chevron" size={18} />
          </Link>
          <Favorites />
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
            <Link to="/reservas" className="widget link stack" style={{ gap: 14, minHeight: 116, justifyContent: 'space-between' }}>
              <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="calendar" size={22} /></span>
              <strong style={{ fontSize: 17 }}>Mis reservas</strong>
            </Link>
            <Link to="/escanear" className="widget link dark stack" style={{ gap: 14, minHeight: 116, justifyContent: 'space-between' }}>
              <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="scan" size={22} /></span>
              <strong style={{ fontSize: 17 }}>Escanear QR</strong>
            </Link>
          </div>

          <Link to={business ? '/panel' : '/negocios'} className="widget dark link row" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="store" /></span>
            <span className="grow stack" style={{ gap: 0 }}>
              <span className="eyebrow">Para negocios</span>
              <strong>{business ? `Ir al panel de ${business.name}` : 'NetWish para negocios'}</strong>
            </span>
            <Icon name="chevron" size={18} />
          </Link>

          <Favorites />

          <button className="btn block" onClick={() => signOut().then(() => navigate('/'))}>
            <Icon name="logout" size={18} /> Cerrar sesión
          </button>
          <DeleteAccount />
        </>
      )}
      <div style={{ marginTop: 18 }}><LegalLinks /></div>
    </div>
  );
}
