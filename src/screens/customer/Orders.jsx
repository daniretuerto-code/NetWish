import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Mono, PageHeader, Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { isReservation, myOrders, STATUS, subscribe } from '../../lib/data.js';
import { money, todayISO } from '../../lib/format.js';

const LABELS = {
  [STATUS.PAID]: { text: 'Pagado', tone: 'var(--accent)' },
  [STATUS.PENDING]: { text: 'Pendiente', tone: '#F4E3B5' },
  [STATUS.KITCHEN]: { text: 'En cocina', tone: '#F7D2C4' },
  [STATUS.CONFIRMED]: { text: 'Confirmada', tone: 'var(--accent)' },
  [STATUS.READY]: { text: 'Listo', tone: 'var(--accent)' },
  [STATUS.DONE]: { text: 'Completado', tone: 'var(--bg)' },
  [STATUS.REJECTED]: { text: 'Rechazado', tone: '#F3C9C9' },
};

const dateLabel = (iso) => {
  if (!iso) return '';
  if (iso === todayISO()) return 'Hoy';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
};

function OrderRow({ order }) {
  const label = LABELS[order.status] || { text: order.status, tone: 'var(--bg)' };
  return (
    <div className="list-row" style={{ alignItems: 'flex-start' }}>
      <Mono name={order.business_name} />
      <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
        <span className="row between" style={{ gap: 8 }}>
          <Link to={`/negocio/${encodeURIComponent(order.business_name)}`} className="t" style={{ textDecoration: 'none', color: 'inherit' }}>{order.business_name}</Link>
          <span className="price" style={{ fontSize: 15 }}>{Number(order.total) > 0 ? money(order.total) : ''}</span>
        </span>
        <span className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{order.items}</span>
        <span className="row" style={{ gap: 8, marginTop: 4 }}>
          <span className="pill" style={{ background: label.tone, height: 26, fontSize: 12 }}>{label.text}</span>
          <span className="small muted">{dateLabel(order.date)} · {order.time}</span>
        </span>
      </span>
    </div>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const { data, loading, reload } = useAsync(() => (user ? myOrders() : Promise.resolve([])), [user?.id]);

  useEffect(() => {
    if (!user) return undefined;
    return subscribe('orders', () => reload(), `customer_id=eq.${user.id}`);
  }, [user, reload]);

  if (!user) {
    return (
      <div className="page">
        <PageHeader eyebrow="Tu actividad" title="Reservas" />
        <div className="widget">
          <Empty icon="calendar" title="Inicia sesión para ver tus reservas">
            <Link to="/cuenta" className="btn primary" style={{ marginTop: 8 }}>Entrar o crear cuenta</Link>
          </Empty>
        </div>
      </div>
    );
  }

  if (loading && !data) return <Spinner />;
  const orders = data || [];
  const reservations = orders.filter((o) => isReservation(o) && o.status !== STATUS.DONE && o.status !== STATUS.REJECTED && (o.date || '') >= todayISO());
  const rest = orders.filter((o) => !reservations.includes(o));

  return (
    <div className="page">
      <PageHeader eyebrow="Tu actividad" title="Reservas" />
      {orders.length === 0 ? (
        <div className="widget">
          <Empty icon="calendar" title="Aún no tienes reservas">
            <Link to="/explorar">Descubre comercios de Palencia</Link>
          </Empty>
        </div>
      ) : (
        <div className="two-col">
          <div className="stack">
            {reservations.length > 0 && (
              <div className="widget dark stack">
                <span className="eyebrow row" style={{ gap: 6 }}><Icon name="calendar" size={14} /> Próximas reservas</span>
                {reservations.map((o) => (
                  <div key={o.id} className="row between" style={{ gap: 10 }}>
                    <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                      <strong>{o.business_name}</strong>
                      <span className="small" style={{ opacity: 0.7 }}>{dateLabel(o.date)} · {o.time}</span>
                      <span className="small" style={{ opacity: 0.7 }}>{o.items}</span>
                    </span>
                    <span className="pill" style={{ background: o.status === STATUS.CONFIRMED ? 'var(--accent)' : 'rgba(255,255,255,.14)', color: o.status === STATUS.CONFIRMED ? 'var(--ink)' : '#fff' }}>
                      {o.status === STATUS.CONFIRMED ? 'Confirmada' : 'Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="widget" style={{ paddingBottom: 4 }}>
              <h2 className="title-lg">Historial</h2>
              {rest.map((o) => <OrderRow key={o.id} order={o} />)}
              {rest.length === 0 && <p className="small muted" style={{ padding: '10px 0' }}>Nada más por aquí.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
