import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Ring, Spinner } from '../../components/ui.jsx';
import { BusinessRow, CoverCard } from '../../components/BusinessCards.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { listBusinesses, myOrders, isReservation, STATUS } from '../../lib/data.js';
import { CATEGORIES, kindOf } from '../../lib/categories.js';
import { initials, longDate, money } from '../../lib/format.js';

const ACTIVE = [STATUS.KITCHEN, STATUS.PENDING, STATUS.PAID, STATUS.CONFIRMED, STATUS.READY];

function ActiveOrderWidget({ user }) {
  const { data: orders } = useAsync(() => (user ? myOrders() : Promise.resolve([])), [user?.id]);
  const today = new Date().toISOString().slice(0, 10);
  const active = (orders || []).find((o) => ACTIVE.includes(o.status) && (o.date >= today || isReservation(o)));

  if (!active) {
    return (
      <Link to="/explorar" className="widget link" style={{ minHeight: 168, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="compass" /></span>
        <span className="stack" style={{ gap: 0 }}>
          <span className="eyebrow">Descubre</span>
          <span className="title-lg">Explorar</span>
        </span>
      </Link>
    );
  }

  const progress = active.status === STATUS.KITCHEN ? 0.62 : active.status === STATUS.PENDING ? 0.3 : 0.9;
  const label = active.status === STATUS.KITCHEN ? 'En cocina' : active.status === STATUS.PENDING ? 'Pendiente' : active.status === STATUS.CONFIRMED ? 'Confirmada' : 'Pagado';
  return (
    <Link to="/pedidos" className="widget link" style={{ minHeight: 168, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <Ring value={progress} label={`${label}`} />
      <span className="stack" style={{ gap: 0 }}>
        <span className="eyebrow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.business_name}</span>
        <span className="title-lg">{label}</span>
      </span>
    </Link>
  );
}

export default function Home() {
  const { user, displayName, avatar } = useAuth();
  const { data: businesses, loading, error } = useAsync(() => listBusinesses(), []);
  const list = businesses || [];
  const featured = list.find((b) => b.cover_url) || list.find((b) => kindOf(b) === 'restaurant') || list[0];
  const rest = list.filter((b) => b !== featured);

  return (
    <div className="page">
      <div className="row" style={{ alignItems: 'flex-end', padding: '0 4px' }}>
        <div className="grow stack" style={{ gap: 2 }}>
          <span className="eyebrow">{longDate()}</span>
          <h1 className="title-xl">{displayName ? `Hola, ${displayName.split(' ')[0]}` : 'Hoy en Palencia'}</h1>
        </div>
        <Link to="/cuenta" className="icon-btn" aria-label="Mi cuenta" style={{ background: 'var(--ink)', color: 'var(--accent)', fontWeight: 800, overflow: 'hidden' }}>
          {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user ? initials(displayName) : <Icon name="person" size={20} />}
        </Link>
      </div>

      {loading && <Spinner />}
      {error && <Empty icon="store" title="No hemos podido cargar los comercios">Revisa tu conexión y vuelve a intentarlo.</Empty>}

      <div className="two-col">
        <div className="stack">
          {featured && <CoverCard biz={featured} eyebrow="Destacado hoy" subtitle={kindOf(featured) === 'restaurant' ? 'Reserva o pide desde tu mesa' : featured.category} />}

          <div className="bento">
            <Link to="/escanear" className="widget dark link" style={{ minHeight: 168, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)', width: 56, height: 56 }}><Icon name="scan" size={28} /></span>
              <span className="stack" style={{ gap: 0 }}>
                <span className="eyebrow">Pagar o pedir</span>
                <span className="title-lg">Escanear QR</span>
              </span>
            </Link>
            <ActiveOrderWidget user={user} />
          </div>
        </div>

        <div className="stack">
          <div className="widget">
            <div className="row between" style={{ marginBottom: 8 }}>
              <h2 className="title-lg">Categorías</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {CATEGORIES.map((c) => (
                <Link key={c.key} to={`/explorar?cat=${c.key}`} className="stack" style={{ alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 18, background: 'var(--bg)', textDecoration: 'none' }}>
                  <Icon name={c.icon} size={24} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {rest.length > 0 && (
            <div className="widget" style={{ paddingBottom: 6 }}>
              <div className="row between">
                <h2 className="title-lg">En NetWish</h2>
                <Link to="/explorar" className="small" style={{ fontWeight: 700, color: 'var(--muted)', textDecoration: 'none' }}>Ver todo</Link>
              </div>
              {rest.slice(0, 5).map((b) => <BusinessRow key={b.username || b.name} biz={b} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
