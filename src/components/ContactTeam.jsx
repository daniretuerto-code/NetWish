import { useState } from 'react';
import Icon from './Icon.jsx';
import { Sheet, useToast } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { requestBusinessSignup } from '../lib/data.js';

// "¿Quieres más para tu negocio?" — the message reaches the NetWish team on Telegram.
export default function ContactTeam({ dark = false }) {
  const { user, business } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [phone, setPhone] = useState(business?.telefono || '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await requestBusinessSignup({
        kind: 'contacto',
        name: business?.name || 'Sin negocio',
        category: business?.category || null,
        email: user?.email || null,
        phone: phone.trim() || null,
        description: text.trim().slice(0, 1200),
      });
      setSent(true);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={`widget stack ${dark ? 'dark' : ''}`} style={{ gap: 10 }}>
        <span className="eyebrow">A medida</span>
        <strong style={{ fontSize: 20, letterSpacing: '-0.02em' }}>¿Quieres más para tu negocio?</strong>
        <span className="small" style={{ opacity: 0.75 }}>Si necesitas algo que NetWish aún no hace, cuéntanoslo y lo preparamos contigo.</span>
        <button className={`btn ${dark ? 'accent' : 'primary'} block`} onClick={() => { setSent(false); setOpen(true); }}>
          <Icon name="chat" size={18} /> Contactar con NetWish
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={sent ? 'Mensaje enviado' : 'Cuéntanos qué necesitas'}>
        {sent ? (
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
            <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={28} stroke={3} /></span>
            <p className="muted">Te escribimos muy pronto{user?.email ? ` a ${user.email}` : ''}.</p>
            <button className="btn primary block" onClick={() => setOpen(false)}>Hecho</button>
          </div>
        ) : (
          <form className="stack" onSubmit={send}>
            <div className="field">
              <label htmlFor="ct-text">¿Qué te gustaría que hiciera NetWish por tu negocio?</label>
              <textarea id="ct-text" className="input" rows={5} required minLength={5} maxLength={1200} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej.: me gustaría que mis clientes pudieran encargar tartas con dos días de antelación…" />
            </div>
            <div className="field"><label htmlFor="ct-phone">Teléfono (opcional)</label><input id="ct-phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <button className="btn primary block" disabled={busy}>{busy ? 'Enviando…' : 'Enviar'}</button>
          </form>
        )}
      </Sheet>
    </>
  );
}
