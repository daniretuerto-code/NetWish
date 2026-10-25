import { useEffect, useState } from 'react';
import { Empty, PageHeader, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessOrders, isReservation, notifyOrder, setOrderStatus, STATUS, subscribe } from '../../lib/data.js';
import { money, todayISO } from '../../lib/format.js';
import { kindOf } from '../../lib/categories.js';

const dateLabel = (iso) => {
  if (iso === todayISO()) return 'Hoy';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
};

function OrderCard({ order, actions, busy }) {
  return (
    <div className="order-card">
      <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
        <span className="stack" style={{ gap: 0, minWidth: 0 }}>
          <strong>{order.customer}</strong>
          <span className="small muted">{dateLabel(order.date)} · {order.time}</span>
        </span>
        {Number(order.total) > 0 && <span className="price">{money(order.total)}</span>}
      </div>
      <span style={{ fontSize: 15 }}>{order.items}</span>
      {order.customer_email && <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.customer_email}</span>}
      {actions.length > 0 && (
        <div className="row" style={{ gap: 8 }}>
          {actions.map((a) => (
            <button key={a.label} className={`btn sm ${a.kind || 'primary'}`} style={{ flex: 1 }} disabled={busy} onClick={a.run}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Column({ title, count, accent, children }) {
  return (
    <section className="widget stack" style={{ gap: 10 }}>
      <div className="row between">
        <h2 className="title-md">{title}</h2>
        <span className={`count-badge ${accent && count ? 'accent' : ''}`}>{count}</span>
      </div>
      {count === 0 ? <p className="small muted" style={{ margin: '4px 0 8px' }}>Nada por aquí.</p> : children}
    </section>
  );
}

export default function Orders() {
  const { business } = useAuth();
  const isRestaurant = kindOf(business) === 'restaurant';
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const { data, loading, reload, setData } = useAsync(() => businessOrders(business.name), [business.name]);

  useEffect(() => subscribe('orders', () => reload()), [reload]);

  if (loading && !data) return <Spinner />;
  const orders = data || [];

  const move = async (order, status) => {
    setBusy(order.id);
    try {
      await setOrderStatus(order.id, status);
      setData(orders.map((o) => (o.id === order.id ? { ...o, status } : o)));
      if (status === STATUS.CONFIRMED) {
        notifyOrder(order.id, 'confirmed');
        toast('Reserva confirmada. Avisamos al cliente por correo.');
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const reservations = orders.filter((o) => isReservation(o) && o.status === STATUS.PENDING);
  const preparing = orders.filter((o) => !isReservation(o) && [STATUS.PAID, STATUS.KITCHEN].includes(o.status));
  const ready = orders.filter((o) => !isReservation(o) && o.status === STATUS.READY);
  const upcoming = orders
    .filter((o) => isReservation(o) && o.status === STATUS.CONFIRMED && o.date >= todayISO())
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const history = orders.filter((o) => [STATUS.DONE, STATUS.REJECTED].includes(o.status) || (isReservation(o) && o.status === STATUS.CONFIRMED && o.date < todayISO()));

  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title={isRestaurant ? 'Reservas y mesas' : 'Reservas'} />

      {orders.length === 0 ? (
        <div className="widget"><Empty icon="calendar" title="Aún no hay reservas">Cuando un cliente reserve, lo verás aquí al momento.</Empty></div>
      ) : (
        <>
          <div className={isRestaurant ? 'kanban' : 'stack'}>
            <Column title="Reservas por confirmar" count={reservations.length} accent>
              {reservations.map((o) => (
                <OrderCard key={o.id} order={o} busy={busy === o.id} actions={[
                  { label: 'Confirmar', run: () => move(o, STATUS.CONFIRMED) },
                  { label: 'Rechazar', kind: 'soft', run: () => move(o, STATUS.REJECTED) },
                ]} />
              ))}
            </Column>
            {isRestaurant && (<>
            <Column title="En preparación" count={preparing.length} accent>
              {preparing.map((o) => (
                <OrderCard key={o.id} order={o} busy={busy === o.id} actions={[{ label: 'Listo', run: () => move(o, STATUS.READY) }]} />
              ))}
            </Column>
            <Column title="Listos para entregar" count={ready.length}>
              {ready.map((o) => (
                <OrderCard key={o.id} order={o} busy={busy === o.id} actions={[{ label: 'Entregado', kind: 'accent', run: () => move(o, STATUS.DONE) }]} />
              ))}
            </Column>
            </>)}
          </div>

          {upcoming.length > 0 && (
            <div className="widget" style={{ paddingBottom: 4 }}>
              <h2 className="title-lg">Próximas reservas confirmadas</h2>
              {upcoming.map((o) => (
                <div key={o.id} className="list-row">
                  <span className="grow stack" style={{ gap: 1 }}>
                    <span className="t">{o.customer}</span>
                    <span className="s">{o.items}</span>
                  </span>
                  <span className="small" style={{ fontWeight: 700 }}>{dateLabel(o.date)} · {o.time}</span>
                </div>
              ))}
            </div>
          )}

          <div className="widget" style={{ paddingBottom: 4 }}>
            <button className="row between" style={{ width: '100%', background: 'none', border: 0, padding: 0, minHeight: 44 }} onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
              <h2 className="title-lg">Historial</h2>
              <span className="small muted">{showHistory ? 'Ocultar' : `${history.length} ${history.length === 1 ? 'registro' : 'registros'}`}</span>
            </button>
            {showHistory && history.map((o) => (
              <div key={o.id} className="list-row">
                <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                  <span className="t">{o.customer}</span>
                  <span className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.items}</span>
                </span>
                <span className="stack" style={{ gap: 1, alignItems: 'flex-end' }}>
                  <span className="price small">{Number(o.total) > 0 ? money(o.total) : ''}</span>
                  <span className="small muted">{o.status === STATUS.REJECTED ? 'Rechazado' : dateLabel(o.date)}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
