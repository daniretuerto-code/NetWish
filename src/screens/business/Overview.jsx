import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { PageHeader, Ring, Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessInbox, businessOrders, isReservation, kitchenSessions, STATUS, subscribe } from '../../lib/data.js';
import { kindOf } from '../../lib/categories.js';
import { greeting, longDate, money, todayISO } from '../../lib/format.js';

const ACTIVE = [STATUS.PAID, STATUS.KITCHEN, STATUS.CONFIRMED];

export default function Overview() {
  const { business } = useAuth();
  const isRestaurant = kindOf(business) === 'restaurant';
  const { data, loading, reload } = useAsync(async () => {
    const [orders, inbox, sessions] = await Promise.all([
      businessOrders(business.name),
      businessInbox(business.name),
      isRestaurant ? kitchenSessions(business.name) : Promise.resolve([]),
    ]);
    return { orders, inbox, sessions };
  }, [business.name, isRestaurant]);

  useEffect(() => subscribe('orders', () => reload()), [reload]);

  if (loading && !data) return <Spinner />;
  const today = todayISO();
  const todays = data.orders.filter((o) => o.date === today && o.status !== STATUS.REJECTED);
  const sales = todays.filter((o) => !isReservation(o)).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const pendingRes = data.orders.filter((o) => isReservation(o) && o.status === STATUS.PENDING);
  const inProgress = data.orders.filter((o) => !isReservation(o) && ACTIVE.includes(o.status) && o.date === today);
  const unread = data.inbox.reduce((n, t) => n + t.unread, 0);
  const done = todays.filter((o) => o.status === STATUS.DONE).length;
  const openTables = data.sessions.filter((s) => s.status === 'open').length;

  return (
    <div className="page">
      <PageHeader eyebrow={longDate()} title={`${greeting()}`} />

      <div className="bento">
        <div className="widget dark span-2 stack" style={{ gap: 6 }}>
          <span className="eyebrow">Ventas de hoy</span>
          <span className="price" style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{money(sales)}</span>
          <span className="small" style={{ opacity: 0.7 }}>{todays.length} {todays.length === 1 ? 'pedido' : 'pedidos'} · {done} {done === 1 ? 'completado' : 'completados'}</span>
        </div>

        <Link to="/panel/pedidos" className="widget link stack" style={{ justifyContent: 'space-between', minHeight: 150 }}>
          <Ring value={todays.length ? Math.min(1, done / todays.length) : 0} label="Pedidos completados hoy" />
          <span className="stack" style={{ gap: 0 }}>
            <span className="eyebrow">En curso</span>
            <span className="title-lg">{inProgress.length} {inProgress.length === 1 ? 'pedido' : 'pedidos'}</span>
          </span>
        </Link>

        <Link to="/panel/pedidos" className="widget link stack" style={{ justifyContent: 'space-between', minHeight: 150, background: pendingRes.length ? 'var(--accent)' : undefined }}>
          <span className="mono" style={{ background: 'var(--ink)', color: 'var(--accent)' }}><Icon name="calendar" /></span>
          <span className="stack" style={{ gap: 0 }}>
            <span className="eyebrow" style={{ color: 'inherit', opacity: 0.7 }}>Reservas</span>
            <span className="title-lg">{pendingRes.length} por confirmar</span>
          </span>
        </Link>

        <Link to="/panel/mensajes" className="widget link stack" style={{ justifyContent: 'space-between', minHeight: 150 }}>
          <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="chat" /></span>
          <span className="stack" style={{ gap: 0 }}>
            <span className="eyebrow">Mensajes</span>
            <span className="title-lg">{unread ? `${unread} sin leer` : 'Al día'}</span>
          </span>
        </Link>

        {isRestaurant ? (
          <Link to="/panel/cocina" className="widget link stack" style={{ justifyContent: 'space-between', minHeight: 150, background: 'var(--cover)', color: '#fff' }}>
            <span className="mono" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }}><Icon name="flame" /></span>
            <span className="stack" style={{ gap: 0 }}>
              <span className="eyebrow" style={{ color: 'rgba(255,255,255,.75)' }}>Cocina</span>
              <span className="title-lg">{openTables} {openTables === 1 ? 'mesa abierta' : 'mesas abiertas'}</span>
            </span>
          </Link>
        ) : (
          <Link to="/panel/carta" className="widget link stack" style={{ justifyContent: 'space-between', minHeight: 150, background: 'var(--cover)', color: '#fff' }}>
            <span className="mono" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }}><Icon name="book" /></span>
            <span className="stack" style={{ gap: 0 }}>
              <span className="eyebrow" style={{ color: 'rgba(255,255,255,.75)' }}>Catálogo</span>
              <span className="title-lg">Gestionar</span>
            </span>
          </Link>
        )}
      </div>

      <div className="widget" style={{ paddingBottom: 4 }}>
        <div className="row between">
          <h2 className="title-lg">Últimos pedidos</h2>
          <Link to="/panel/pedidos" className="small">Ver todos</Link>
        </div>
        {data.orders.slice(0, 6).map((o) => (
          <div key={o.id} className="list-row">
            <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
              <span className="t">{o.customer}</span>
              <span className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.items}</span>
            </span>
            <span className="stack" style={{ gap: 1, alignItems: 'flex-end' }}>
              <span className="price" style={{ fontSize: 15 }}>{Number(o.total) > 0 ? money(o.total) : ''}</span>
              <span className="small muted">{o.time}</span>
            </span>
          </div>
        ))}
        {data.orders.length === 0 && <p className="small muted" style={{ padding: '10px 0' }}>Cuando lleguen pedidos aparecerán aquí.</p>}
      </div>
    </div>
  );
}
