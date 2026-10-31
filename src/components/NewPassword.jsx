import { useState } from 'react';
import { Sheet, useToast } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Shown after the "He olvidado mi contraseña" e-mail link: the place to write the new one.
export default function NewPassword() {
  const { recovery, endRecovery, updatePassword } = useAuth();
  const toast = useToast();
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pass.length < 8 || !/[a-zA-Z]/.test(pass) || !/\d/.test(pass)) { toast('Mínimo 8 caracteres, con letras y números', 'error'); return; }
    if (pass !== again) { toast('Las dos contraseñas no coinciden', 'error'); return; }
    setBusy(true);
    try {
      await updatePassword(pass);
      toast('Contraseña cambiada. Ya has entrado.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={recovery} onClose={endRecovery} title="Nueva contraseña">
      <form className="stack" onSubmit={submit}>
        <p className="small muted" style={{ margin: 0 }}>Escribe tu nueva contraseña. A partir de ahora entrarás con ella.</p>
        <div className="field"><label htmlFor="np-1">Nueva contraseña</label><input id="np-1" className="input" type="password" autoComplete="new-password" required minLength={8} value={pass} onChange={(e) => setPass(e.target.value)} /></div>
        <div className="field"><label htmlFor="np-2">Repítela</label><input id="np-2" className="input" type="password" autoComplete="new-password" required minLength={8} value={again} onChange={(e) => setAgain(e.target.value)} /></div>
        <button className="btn primary block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>
    </Sheet>
  );
}
