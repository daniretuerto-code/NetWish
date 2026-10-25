import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { AuthForms, ClaimSheet, SignupSheet } from '../customer/Account.jsx';

const FEATURES = [
  { icon: 'calendar', title: 'Reservas online', text: 'Tus clientes eligen día y hora. Tú confirmas con un toque y les avisamos por correo.' },
  { icon: 'scissors', title: 'Citas por servicio', text: 'En peluquerías, cada servicio tiene su duración y la agenda solo ofrece huecos donde cabe.' },
  { icon: 'book', title: 'Carta y catálogo', text: 'Publica tu carta, tus servicios o tus productos con precios siempre al día.' },
  { icon: 'chat', title: 'Mensajes', text: 'Habla con tus clientes desde el mismo panel, sin dar tu número personal.' },
];

// netwish.es/negocios: the door for business owners, kept apart from the everyday app.
export default function Portal() {
  const { ready, user, business, signOut } = useAuth();
  const [claimOpen, setClaimOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  if (!ready) return <Spinner />;
  if (business) return <Navigate to="/panel" replace />;

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
          <p style={{ opacity: 0.7, fontSize: 17, margin: 0, maxWidth: 560 }}>Reservas, carta y mensajes de tus clientes en un solo panel, desde el móvil o el ordenador.</p>
        </div>
      </header>

      <main className="two-col" style={{ maxWidth: 1040, margin: '-36px auto 0', padding: '0 var(--gutter) 48px' }}>
        <div className="stack">
          {!user ? (
            <>
              <AuthForms next="/negocios" />
              <p className="small muted" style={{ margin: '0 4px' }}>Entra con tu cuenta de NetWish. Si es tu primera vez, crea una y después vincula o da de alta tu negocio.</p>
            </>
          ) : (
            <div className="widget stack">
              <span className="eyebrow">Hola, {user.email}</span>
              <h2 className="title-lg">Conecta tu negocio</h2>
              <p className="muted" style={{ margin: 0 }}>Si ya estabas en NetWish, vincúlalo con el usuario y la contraseña de antes. Si no, solicita el alta y te lo dejamos listo.</p>
              <button className="btn primary block" onClick={() => setClaimOpen(true)}>Vincular mi negocio</button>
              <button className="btn soft block" onClick={() => setSignupOpen(true)}>Dar de alta un negocio nuevo</button>
              <button className="btn ghost sm" onClick={() => signOut()}>Usar otra cuenta</button>
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
        </div>
      </main>

      <ClaimSheet open={claimOpen} onClose={() => setClaimOpen(false)} />
      <SignupSheet open={signupOpen} onClose={() => setSignupOpen(false)} email={user?.email} />
    </div>
  );
}
