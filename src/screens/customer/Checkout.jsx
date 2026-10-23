import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, Empty, PageHeader, Stepper, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { createOrder, STATUS } from '../../lib/data.js';
import { money, todayISO } from '../../lib/format.js';

const downloadUrl = (item) =>
  `/api/download?url=${encodeURIComponent(item.full_audio_url)}&filename=${encodeURIComponent(`${item.name}.mp3`)}`;

export default function Checkout() {
  const { name } = useParams();
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const current = cart.cartFor(name);
  const [when, setWhen] = useState('now');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  const pay = async () => {
    if (when === 'later' && !time) {
      toast('Elige a qué hora lo quieres', 'error');
      return;
    }
    setSaving(true);
    try {
      const order = await createOrder({
        business: name,
        user,
        items: current.items,
        total: current.total,
        date: when === 'later' ? date : undefined,
        time: when === 'later' ? time : 'Inmediato',
        status: STATUS.PAID,
      });
      setDone({ order, items: current.items });
      cart.clear(name);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    const downloads = done.items.filter((i) => i.full_audio_url);
    return (
      <div className="page">
        <div className="widget stack" style={{ alignItems: 'center', textAlign: 'center', padding: '32px 20px', maxWidth: 520, margin: '24px auto 0', width: '100%' }}>
          <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={30} stroke={3} /></span>
          <span className="eyebrow">Pedido confirmado</span>
          <h1 className="title-xl">{money(done.order.total)}</h1>
          <p className="muted">{done.order.items}</p>
          <p className="small muted">{done.order.customer_email ? `Te hemos enviado el recibo a ${done.order.customer_email}.` : 'Inicia sesión la próxima vez para recibir el recibo por correo.'}</p>
          {downloads.map((i) => (
            <a key={i.id} className="btn primary block" href={downloadUrl(i)}>
              <Icon name="download" size={18} /> Descargar {i.name}
            </a>
          ))}
          <Link to="/pedidos" className="btn soft block">Ver mis pedidos</Link>
          <Link to="/" className="btn ghost block">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <PageHeader back={<BackButton />} eyebrow={name} title="Tu pedido" />

      {current.count === 0 ? (
        <Empty icon="bag" title="Tu pedido está vacío">
          <Link to={`/negocio/${encodeURIComponent(name)}`}>Volver al comercio</Link>
        </Empty>
      ) : (
        <>
          <div className="widget" style={{ paddingBottom: 4 }}>
            {current.items.map((i) => (
              <div key={i.id} className="list-row">
                <span className="grow stack" style={{ gap: 1 }}>
                  <span className="t">{i.name}</span>
                  <span className="s price">{money(i.price * i.qty)}</span>
                </span>
                <Stepper qty={i.qty} onAdd={() => cart.add(name, i)} onRemove={() => cart.remove(name, i)} />
              </div>
            ))}
            <div className="row between" style={{ padding: '12px 0' }}>
              <span className="muted">Total</span>
              <span className="title-lg price">{money(current.total)}</span>
            </div>
          </div>

          <div className="widget stack">
            <span className="eyebrow">¿Cuándo?</span>
            <div className="segmented" style={{ background: 'var(--bg)' }}>
              <button aria-selected={when === 'now'} onClick={() => setWhen('now')}>Ahora</button>
              <button aria-selected={when === 'later'} onClick={() => setWhen('later')}>Programar</button>
            </div>
            {when === 'later' && (
              <div className="bento">
                <div className="field">
                  <label htmlFor="pick-date">Día</label>
                  <input id="pick-date" className="input" type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="pick-time">Hora</label>
                  <input id="pick-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {!user && (
            <Link to="/cuenta" className="widget link row">
              <Icon name="mail" />
              <span className="grow small">Inicia sesión para recibir el recibo por correo y ver tus pedidos.</span>
              <Icon name="chevron" size={18} />
            </Link>
          )}

          <button className="cta-bar" onClick={pay} disabled={saving}>
            <span className="row" style={{ gap: 6, fontSize: 14, opacity: 0.7 }}><Icon name="lock" size={14} /> Pago seguro</span>
            <span className="go">{saving ? 'Procesando…' : `Pagar ${money(current.total)}`}</span>
          </button>
        </>
      )}
    </div>
  );
}
