import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { readGuest } from '../lib/guest.js';

// Name, e-mail and phone for booking without an account, filled from last time.
export function useGuest() {
  const { user, displayName } = useAuth();
  const [guest, setGuest] = useState(() => {
    const g = readGuest();
    return { name: user ? displayName || g.name : g.name, email: user?.email || g.email, phone: g.phone };
  });
  return [guest, setGuest];
}

export default function GuestFields({ guest, setGuest, phoneRequired = false, prefix = 'g' }) {
  const { user } = useAuth();
  const set = (k) => (e) => setGuest({ ...guest, [k]: e.target.value });
  return (
    <div className="widget stack" style={{ gap: 10 }}>
      <span className="eyebrow">Tus datos</span>
      {!user && <div className="field"><label htmlFor={`${prefix}-name`}>Nombre</label><input id={`${prefix}-name`} className="input" required minLength={2} maxLength={60} value={guest.name} onChange={set('name')} /></div>}
      {!user && <div className="field"><label htmlFor={`${prefix}-mail`}>Correo (te mandamos la confirmación)</label><input id={`${prefix}-mail`} className="input" type="email" required value={guest.email} onChange={set('email')} /></div>}
      <div className="field"><label htmlFor={`${prefix}-tel`}>Teléfono{phoneRequired ? '' : ' (opcional)'}</label><input id={`${prefix}-tel`} className="input" type="tel" required={phoneRequired} maxLength={20} value={guest.phone} onChange={set('phone')} /></div>
      {!user && <span className="small muted">Sin registrarte. Si tienes cuenta, entra y lo verás todo en "Reservas".</span>}
    </div>
  );
}
