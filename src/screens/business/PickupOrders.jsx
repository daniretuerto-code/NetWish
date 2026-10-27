import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Empty, PageHeader, Skeleton, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessOrders, isPickup, notifyOrder, setOrderStatus, STATUS, subscribe } from '../../lib/data.js';
import { telLink, whatsappLink } from '../../lib/agenda.js';
import { money, normalize, todayISO } from '../../lib/format.js';
import { paymentLabel, variantLabel } from '../../lib/shop.js';

const dateLabel = (iso) => {
  if (iso === todayISO()) return 'Hoy';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
};

// "Pedido para recoger: 2x Barra, 1x Napolitana · Nota: …" when the order has no lines saved.
const linesOf = (o) => (Array.isArray(o.lines) && o.lines.length
  ? o.lines
  : String(o.items || '').replace(/^Pedido para recoger:\s*/i, '').split(' · Nota:')[0].split(', ').filter(Boolean).map((t) => {
    const m = /^(\d+)x\s+(.*)$/.exec(t);
    return m ? { qty: Number(m[1]), name: m[2] } : { qty: 1, name: t };
  }));

function PickupCard({ order, busy, actions }) {
  const lines = linesOf(order);
  return (
    <div className="order-card">
      <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
        <span className="stack" style={{ gap: 2, minWidth: 0 }}>
          <strong>{order.customer}</strong>
          <span className="small muted">Recoge {dateLabel(order.date)} · {String(order.time || '').slice(0, 5)}</span>
        </span>
        <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
          {order.pickup_code && <span className="code-tag">{order.pickup_code}</span>}
          <span className="price">{money(order.total)}</span>
        </span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {lines.map((l, i) => (
          <div key={`${l.id || l.name}-${i}`} className="row" style={{ gap: 10 }}>
            {l.image ? <img src={l.image} alt="" width={36} height={36} style={{ borderRadius: 8, objectFit: 'cover', flex: 'none' }} /> : null}
            <span className="grow" style={{ fontSize: 15 }}><strong>{l.qty}×</strong> {l.name}{l.variant ? <span className="muted"> · {variantLabel(l.variant)}</span> : null}</span>
          </div>
        ))}
      </div>
      {order.note && <span className="small" style={{ background: 'var(--bg)', borderRadius: 10, padding: '6px 10px' }}>{order.note}</span>}
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="pill" style={{ background: 'var(--surface)', minWidth: 0 }}><Icon name={order.payment === 'efectivo' ? 'cash' : 'card'} size={14} /> Paga: {paymentLabel(order.payment)}</span>
        {order.phone && <a className="pill" style={{ background: 'var(--surface)', minWidth: 0 }} href={telLink(order.phone)}><Icon name="phone" size={14} /> Llamar</a>}
        {order.phone && <a className="pill" style={{ background: 'var(--surface)', minWidth: 0 }} href={whatsappLink(order.phone, `Hola ${order.customer}, te escribimos por tu pedido ${order.pickup_code || ''}.`)} target="_blank" rel="noreferrer"><Icon name="chat" size={14} /> WhatsApp</a>}
      </div>
      {actions.length > 0 && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {actions.map((a) => (
            <button key={a.label} className={`btn sm ${a.kind || 'primary'}`} style={{ flex: a.minor ? '0 0 auto' : '1 1 auto' }} disabled={busy} onClick={a.run}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Column({ title, count, accent, empty, children }) {
  return (
    <section className="widget stack" style={{ gap: 10 }}>
      <div className="row between">
        <h2 className="title-md">{title}</h2>
        <span className={`count-badge ${accent && count ? 'accent' : ''}`}>{count}</span>
      </div>
      {count === 0 ? <p className="small muted" style={{ margin: '4px 0 8px' }}>{empty}</p> : children}
    </section>
  );
}

// Shops: orders to pick up, from "new" to "collected", like the restaurant's agenda but for a counter.
export default function PickupOrders() {
  const { business } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [q, setQ] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const { data, loading, reload, setData } = useAsync(() => businessOrders(business.name), [business.name]);

  useEffect(() => subscribe('orders', () => reload()), [reload]);

  if (loading && !data) return <Skeleton />;
  const all = data || [];
  const orders = all.filter(isPickup);
  const other = all.filter((o) => !isPickup(o) && o.status === STATUS.PENDING);

  const move = async (order, status) => {
    setBusy(order.id);
    try {
      await setOrderStatus(order.id, status);
      setData(all.map((o) => (o.id === order.id ? { ...o, status } : o)));
      if (status === STATUS.PICKUP) {
        notifyOrder(order.id, 'ready');
        toast(order.customer_email ? 'Le avisamos por correo de que ya puede pasar.' : 'Marcado como listo.');
      }
      if (status === STATUS.CANCELLED) toast('Pedido cancelado. Lo apartado vuelve al stock.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
      setConfirmCancel(null);
    }
  };

  const cancel = (o) => ({
    label: confirmCancel === o.id ? '¿Cancelar?' : 'Cancelar',
    kind: confirmCancel === o.id ? 'danger' : 'ghost',
    minor: true,
    run: () => (confirmCancel === o.id ? move(o, STATUS.CANCELLED) : setConfirmCancel(o.id)),
  });

  const byPickup = (a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
  const found = (o) => !q || normalize(`${o.pickup_code || ''} ${o.customer} ${o.phone || ''}`).includes(normalize(q));
  const fresh = orders.filter((o) => o.status === STATUS.ORDERED && found(o)).sort(byPickup);
  const preparing = orders.filter((o) => o.status === STATUS.PREPARING && found(o)).sort(byPickup);
  const ready = orders.filter((o) => o.status === STATUS.PICKUP && found(o)).sort(byPickup);
  const history = orders.filter((o) => [STATUS.COLLECTED, STATUS.CANCELLED, STATUS.REJECTED].includes(o.status) && found(o));
  const todayTotal = orders.filter((o) => o.date === todayISO() && ![STATUS.CANCELLED, STATUS.REJECTED].includes(o.status)).reduce((n, o) => n + Number(o.total || 0), 0);

  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title="Pedidos para recoger" />

      {orders.length === 0 && other.length === 0 ? (
        <div className="widget"><Empty icon="bag" title="Aún no hay pedidos">Cuando un cliente reserve algo para recoger, aparece aquí al momento con su código, y suena un aviso.</Empty></div>
      ) : (
        <>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <div className="field grow" style={{ minWidth: 200 }}>
              <label htmlFor="po-q" className="sr-only">Buscar</label>
              <input id="po-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, nombre o teléfono" />
            </div>
            <span className="pill" style={{ background: 'var(--surface)', alignSelf: 'center' }}>Hoy: {money(todayTotal)}</span>
          </div>

          <div className="kanban">
            <Column title="Nuevos" count={fresh.length} accent empty="No hay pedidos nuevos.">
              {fresh.map((o) => (
                <PickupCard key={o.id} order={o} busy={busy === o.id} actions={[
                  { label: 'Preparar', run: () => move(o, STATUS.PREPARING) },
                  { label: 'Ya está listo', kind: 'accent', run: () => move(o, STATUS.PICKUP) },
                  cancel(o),
                ]} />
              ))}
            </Column>
            <Column title="Preparando" count={preparing.length} empty="Nada preparándose.">
              {preparing.map((o) => (
                <PickupCard key={o.id} order={o} busy={busy === o.id} actions={[
                  { label: 'Listo para recoger', run: () => move(o, STATUS.PICKUP) },
                  cancel(o),
                ]} />
              ))}
            </Column>
            <Column title="Esperando al cliente" count={ready.length} empty="Nadie tiene que pasar ahora.">
              {ready.map((o) => (
                <PickupCard key={o.id} order={o} busy={busy === o.id} actions={[
                  { label: 'Entregado', kind: 'accent', run: () => move(o, STATUS.COLLECTED) },
                  cancel(o),
                ]} />
              ))}
            </Column>
          </div>

          {other.length > 0 && (
            <div className="widget" style={{ paddingBottom: 4 }}>
              <h2 className="title-lg">Otras solicitudes</h2>
              {other.map((o) => (
                <div key={o.id} className="list-row">
                  <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                    <span className="t">{o.customer}</span>
                    <span className="s">{o.items}</span>
                  </span>
                  <button className="btn sm primary" disabled={busy === o.id} onClick={() => { move(o, STATUS.CONFIRMED); notifyOrder(o.id, 'confirmed'); }}>Aceptar</button>
                </div>
              ))}
            </div>
          )}

          <div className="widget" style={{ paddingBottom: 4 }}>
            <button className="row between" style={{ width: '100%', background: 'none', border: 0, padding: 0, minHeight: 44 }} onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
              <h2 className="title-lg">Historial</h2>
              <span className="small muted">{showHistory ? 'Ocultar' : `${history.length} ${history.length === 1 ? 'pedido' : 'pedidos'}`}</span>
            </button>
            {showHistory && history.map((o) => (
              <div key={o.id} className="list-row">
                <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                  <span className="t">{o.customer} {o.pickup_code && <span className="small muted">· {o.pickup_code}</span>}</span>
                  <span className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linesOf(o).map((l) => `${l.qty}× ${l.name}`).join(', ')}</span>
                </span>
                <span className="stack" style={{ gap: 1, alignItems: 'flex-end' }}>
                  <span className="price small">{money(o.total)}</span>
                  <span className="small muted">{o.status === STATUS.COLLECTED ? dateLabel(o.date) : 'Cancelado'}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
