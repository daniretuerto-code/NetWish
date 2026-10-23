import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, Mono, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { createOrder, findBusiness, STATUS } from '../../lib/data.js';
import { initials, money, toneFor } from '../../lib/format.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'];

export default function Pay() {
  const { name } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [cents, setCents] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const { data: biz, loading } = useAsync(() => findBusiness(name), [name]);

  const amount = (parseInt(cents || '0', 10) || 0) / 100;
  const press = (k) => {
    if (k === 'del') setCents((c) => c.slice(0, -1));
    else setCents((c) => (c + k).replace(/^0+/, '').slice(0, 7));
  };

  const pay = async () => {
    if (amount <= 0) return;
    setSaving(true);
    try {
      const order = await createOrder({
        business: biz?.name || name,
        user,
        items: [{ name: note || 'Pago directo', qty: 1, price: amount }],
        itemsText: note ? `Pago directo: ${note}` : 'Pago Directo Terminal',
        total: amount,
        status: STATUS.PAID,
      });
      setDone(order);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;
  const title = biz?.name || name;

  if (done) {
    return (
      <div className="page">
        <div className="widget stack" style={{ alignItems: 'center', textAlign: 'center', padding: '32px 20px', maxWidth: 480, margin: '24px auto 0', width: '100%' }}>
          <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={30} stroke={3} /></span>
          <span className="eyebrow">Pago completado</span>
          <h1 className="title-xl">{money(done.total)}</h1>
          <p className="muted">en {title}</p>
          <Link to="/" className="btn primary block">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 520, paddingBottom: 'calc(110px + var(--safe-bottom))' }}>
      <div className="row between">
        <BackButton label="Cerrar" />
        <span className="eyebrow row" style={{ gap: 6 }}><Icon name="lock" size={12} stroke={2.6} /> Pago seguro</span>
        <span style={{ width: 44 }} />
      </div>

      <div className="cover" style={{ minHeight: 112, background: toneFor(title), padding: '16px 18px', boxShadow: 'none' }}>
        <span className="ghost" aria-hidden="true" style={{ fontSize: 130, top: -14, right: -10 }}>{initials(title)}</span>
        <span className="eyebrow" style={{ color: 'rgba(255,255,255,.75)', position: 'relative' }}>Vas a pagar a</span>
        <span className="row" style={{ position: 'relative', gap: 8 }}>
          {biz?.image && <Mono name={title} image={biz.image} size="sm" />}
          <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</span>
          {biz && <Icon name="check" size={18} stroke={3} label="Comercio verificado" style={{ color: 'var(--accent)' }} />}
        </span>
      </div>

      <div className="stack" style={{ alignItems: 'center', padding: '6px 0' }}>
        <output className="price" style={{ fontSize: 68, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1 }} aria-live="polite">
          {money(amount).replace(/\s?€/, '')}<span style={{ fontSize: 34, color: 'var(--muted)' }}> €</span>
        </output>
        <input className="input" style={{ maxWidth: 280, height: 40, textAlign: 'center', borderRadius: 20, marginTop: 8 }} placeholder="Añadir concepto (opcional)" value={note} onChange={(e) => setNote(e.target.value.slice(0, 80))} aria-label="Concepto" />
      </div>

      <div className="widget keypad" style={{ padding: 8 }}>
        {KEYS.map((k) => (
          <button key={k} onClick={() => press(k)} aria-label={k === 'del' ? 'Borrar' : k}>
            {k === 'del' ? <Icon name="back" size={22} /> : k}
          </button>
        ))}
      </div>

      <button className="cta-bar" onClick={pay} disabled={saving || amount <= 0}>
        <span style={{ fontSize: 14, opacity: 0.7 }}>{user ? 'Recibo a tu correo' : 'Sin sesión iniciada'}</span>
        <span className="go">{saving ? 'Procesando…' : `Pagar ${money(amount)}`}</span>
      </button>
    </div>
  );
}
