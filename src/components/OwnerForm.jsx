import { useState } from 'react';
import { useToast } from './ui.jsx';
import { adminAssignOwner, adminReleaseOwner } from '../lib/data.js';

// "¿De quién es este negocio?": the owner's e-mail links the business to their account.
// The admin keeps access to every panel anyway.
export default function OwnerForm({ business, onDone }) {
  const toast = useToast();
  const [email, setEmail] = useState(business.pending_owner_email || '');
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const assign = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await adminAssignOwner(business.username, email);
      toast(out.assigned
        ? `Listo: ${business.name} ya aparece en la cuenta ${out.email}`
        : `${out.email} aún no tiene cuenta. En cuanto se registre con ese correo, le aparecerá su panel.`);
      onDone?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const release = async () => {
    if (!sure) { setSure(true); return; }
    setBusy(true);
    try {
      await adminReleaseOwner(business.username);
      toast(`${business.name} vuelve a estar sin conectar`);
      onDone?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
      setSure(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 10, padding: 12, borderRadius: 16, background: 'var(--bg)' }}>
      {business.owner_email ? (
        <>
          <span className="small">Lo lleva <strong>{business.owner_email}</strong>. Tú sigues pudiendo entrar y cambiarlo.</span>
          <button className="btn ghost sm" disabled={busy} onClick={release}>{sure ? 'Sí, quitarle el negocio' : 'Quitar dueño'}</button>
        </>
      ) : (
        <form className="stack" style={{ gap: 8 }} onSubmit={assign}>
          <label className="small" htmlFor={`ow-${business.username}`} style={{ fontWeight: 700 }}>¿De quién es este negocio?</label>
          <input id={`ow-${business.username}`} className="input" type="email" required placeholder="Correo con el que entra en NetWish" value={email} onChange={(e) => setEmail(e.target.value)} />
          <span className="small muted">Confírmalo antes con el dueño: quien tenga este correo verá sus reservas y sus clientes.</span>
          <button className="btn primary sm" disabled={busy}>{busy ? 'Asignando…' : 'Asignar'}</button>
        </form>
      )}
    </div>
  );
}
