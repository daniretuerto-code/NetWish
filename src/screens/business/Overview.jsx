import { useEffect } from 'react';
import { Link, Navigate, useOutletContext } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { PageHeader, Ring, Skeleton, Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessInbox, businessOrders, isReservation, kitchenSessions, STATUS, subscribe } from '../../lib/data.js';
import { kindOf } from '../../lib/categories.js';
import { greeting, longDate, money, todayISO } from '../../lib/format.js';
import { profileProgress } from '../../lib/questionnaire.js';
import Today from './Today.jsx';

const ACTIVE = [STATUS.KITCHEN];

export default function Overview() {
  const { business } = useAuth();
  return kindOf(business) === 'restaurant' ? <Today /> : <GeneralOverview />;
}

function GeneralOverview() {
  const { business } = useAuth();
  const kind = kindOf(business);
  const isRestaurant = kind === 'restaurant';
  const { settings, modules } = useOutletContext();
  const { data, loading, reload } = useAsync(async () => {
    const [orders, inbox, sessions] = await Promise.all([
      businessOrders(business.name),
      businessInbox(business.name),
      isRestaurant ? kitchenSessions(business.name) : Promise.resolve([]),
    ]);
    return { orders, inbox, sessions };
  }, [business.name, isRestaurant]);

  useEffect(() => subscribe('orders', () => reload()), [reload]);

  // A restaurant that hasn't answered the questionnaire starts there.
  if (isRestaurant && settings && !settings.profile?.onboarded) return <Navigate to="/panel/empezar" replace />;
  if (loading && !data) return <Skeleton />;
  const pct = isRestaurant && settings ? profileProgress(settings.profile || {}) : 100;
  const today = todayISO();
  const todays = data.orders.filter((o) => o.date === today && o.status !== STATUS.REJECTED);
  const todaysBookings = todays
    .filter((o) => isReservation(o) && [STATUS.PENDING, STATUS.CONFIRMED].includes(o.status))
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const nowHHMM = new Date().toTimeString().slice(0, 5);
  const nextBooking = todaysBookings.find((o) => String(o.time).slice(0, 5) >= nowHHMM);
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
          <span className="eyebrow">Reservas de hoy</span>
          <span className="price" style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{todaysBookings.length}</span>
          <span className="small" style={{ opacity: 0.7 }}>
            {nextBooking ? `Próxima: ${String(nextBooking.time).slice(0, 5)} · ${nextBooking.customer}` : 'No quedan más por hoy'}
          </span>
        </div>

        {isRestaurant && modules.pedidosQr && (
          <Link to="/panel/reservas" className="widget link stack" style={{ justifyContent: 'space-between', minHeight: 150 }}>
            <Ring value={todays.length ? Math.min(1, done / todays.length) : 0} label="Comandas servidas hoy" />
            <span className="stack" style={{ gap: 0 }}>
              <span className="eyebrow">Comandas en curso</span>
              <span className="title-lg">{inProgress.length}</span>
            </span>
          </Link>
        )}

{(!isRestaurant || modules.reservas) && (
        <Link to="/panel/reservas" className="widget link stack" style={{ justifyContent: 'space-between', minHeight: 150, background: pendingRes.length ? 'var(--accent)' : undefined }}>
          <span className="mono" style={{ background: 'var(--ink)', color: 'var(--accent-on-ink)' }}><Icon name="calendar" /></span>
          <span className="stack" style={{ gap: 0 }}>
            <span className="eyebrow" style={{ color: 'inherit', opacity: 0.7 }}>Reservas</span>
            <span className="title-lg">{pendingRes.length} por confirmar</span>
          </span>
        </Link>
        )}

        <Link to="/panel/mensajes" className="widget link stack" style={{ justifyContent: 'space-between', minHeight: 150 }}>
          <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="chat" /></span>
          <span className="stack" style={{ gap: 0 }}>
            <span className="eyebrow">Mensajes</span>
            <span className="title-lg">{unread ? `${unread} sin leer` : 'Al día'}</span>
          </span>
        </Link>

        {pct < 100 && (
          <Link to="/panel/ajustes" className="widget link stack" style={{ justifyContent: 'space-between', minHeight: 150, background: 'var(--accent)' }}>
            <Ring value={pct / 100} color="var(--ink)" label={`Perfil completado al ${pct} %`} />
            <span className="stack" style={{ gap: 0 }}>
              <span className="eyebrow" style={{ color: 'inherit', opacity: 0.7 }}>Personaliza tu negocio</span>
              <span className="title-lg">{pct} % completado</span>
            </span>
          </Link>
        )}

        {isRestaurant && modules.cocina ? (
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
              <span className="eyebrow" style={{ color: 'rgba(255,255,255,.75)' }}>{kind === 'beauty' ? 'Servicios' : isRestaurant ? 'Carta' : 'Catálogo'}</span>
              <span className="title-lg">Gestionar</span>
            </span>
          </Link>
        )}
      </div>

      <div className="widget" style={{ paddingBottom: 4 }}>
        <div className="row between">
          <h2 className="title-lg">Últimas reservas</h2>
          <Link to="/panel/reservas" className="small">Ver todos</Link>
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
        {data.orders.length === 0 && <p className="small muted" style={{ padding: '10px 0' }}>Cuando lleguen reservas aparecerán aquí.</p>}
      </div>
    </div>
  );
}
