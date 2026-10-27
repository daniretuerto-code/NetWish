import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Spinner } from '../../components/ui.jsx';
import { BusinessRow, CoverCard, PlaceInfo, placeSummary } from '../../components/BusinessCards.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { directory, myOrders, isReservation, STATUS } from '../../lib/data.js';
import { CATEGORIES, categoryOf, kindOf } from '../../lib/categories.js';
import { initials, longDate } from '../../lib/format.js';
import { openState } from '../../lib/hours.js';
import { eventCategory, eventWhen } from '../../lib/events.js';
import { eventLink, loadEvents } from './Events.jsx';

const ACTIVE = [STATUS.KITCHEN, STATUS.PENDING, STATUS.CONFIRMED, STATUS.READY];

function ActiveOrderWidget({ user }) {
  const { data: orders } = useAsync(() => (user ? myOrders() : Promise.resolve([])), [user?.id]);
  const today = new Date().toISOString().slice(0, 10);
  // Only what is still ahead: the soonest booking or order from today on.
  const active = (orders || []).filter((o) => ACTIVE.includes(o.status) && (o.date || '') >= today)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];

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

  const label = active.status === STATUS.KITCHEN ? 'En cocina' : active.status === STATUS.PENDING ? 'Pendiente' : active.status === STATUS.CONFIRMED ? 'Confirmada' : 'Listo';
  const when = [active.date === today ? 'Hoy' : active.date ? new Date(`${active.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : '', (active.time || '').split(' - ')[0]].filter(Boolean).join(' · ');
  const confirmed = active.status === STATUS.CONFIRMED || active.status === STATUS.READY;
  return (
    <Link to="/reservas" className="widget link" style={{ minHeight: 168, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
      <span className="mono lg" style={{ background: confirmed ? 'var(--accent)' : 'var(--bg)', color: 'var(--ink)', width: 56, height: 56 }} aria-label={isReservation(active) ? 'Tu reserva' : 'Tu pedido'}><Icon name={confirmed ? 'check' : 'calendar'} size={26} stroke={2.4} /></span>
      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
        <span className="eyebrow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.business_name}</span>
        <span className="title-lg">{label}</span>
        {when && <span className="small muted" style={{ fontWeight: 600 }}>{when}</span>}
      </span>
    </Link>
  );
}

// "Eventos en Palencia": the next plans in the city and its businesses.
function PalenciaEvents() {
  const { data } = useAsync(loadEvents, []);
  const next = (data || []).slice(0, 4);
  return (
    <section className="widget stack home-today" style={{ gap: 10 }}>
      <span className="row between" style={{ gap: 8, alignItems: 'flex-end' }}>
        <span className="stack" style={{ gap: 0 }}>
          <span className="eyebrow">Hoy en Palencia</span>
          <h2 className="title-lg">Eventos en Palencia</h2>
        </span>
        <Link to="/eventos" className="small muted" style={{ fontWeight: 600 }}>Ver todos</Link>
      </span>
      {data && next.length === 0 && (
        <Link to="/eventos" className="order-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <strong>Muy pronto, los planes de la ciudad</strong>
          <span className="small muted">Fiestas, conciertos, mercados y lo nuevo de los negocios de Palencia.</span>
        </Link>
      )}
      {next.map((e) => (
        <Link key={e.id} to={eventLink(e) || '/eventos'} className="order-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
            <strong>{e.title}</strong>
            <span className="small" style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{eventWhen(e).split(' · ')[0]}</span>
          </span>
          <span className="small muted">{[eventCategory(e.category).label, e.place, e.time].filter(Boolean).join(' · ')}</span>
        </Link>
      ))}
    </section>
  );
}

export default function Home() {
  const { user, displayName, avatar } = useAuth();
  const { data: places, loading, error } = useAsync(() => directory(), []);
  const all = places || [];
  const list = all.map((r) => r.biz);
  // A restaurant open right now leads, then one with a photo.
  const pick = all.find((r) => kindOf(r.biz) === 'restaurant' && placeSummary(r.biz, r.settings).state?.open)
    || all.find((r) => r.biz.cover_url) || all.find((r) => kindOf(r.biz) === 'restaurant') || all[0];
  const featured = pick?.biz;
  const featuredSum = pick ? placeSummary(pick.biz, pick.settings) : null;
  const rest = list.filter((b) => b !== featured);
  const countIn = (key) => list.filter((b) => categoryOf(b).key === key).length;

  return (
    <div className="page home">
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

      <div className="two-col home-cols">
        <div className="stack">
          {featured && <CoverCard featured minHeight={240} biz={featured} eyebrow="Destacado hoy" info={<PlaceInfo state={featuredSum.state} line={featuredSum.line} />} cta={featuredSum.canBook ? 'Reservar' : 'Ver'} to={featuredSum.canBook ? `/negocio/${encodeURIComponent(featured.name)}?reservar=1` : undefined} />}

          <div className="bento">
            <Link to="/escanear" className="widget dark link" style={{ minHeight: 168, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)', width: 56, height: 56 }}><Icon name="scan" size={28} /></span>
              <span className="stack" style={{ gap: 0 }}>
                <span className="eyebrow">Mesa o comercio</span>
                <span className="title-lg">Escanear QR</span>
              </span>
            </Link>
            <ActiveOrderWidget user={user} />
          </div>
        </div>

        <div className="stack">
          <PalenciaEvents />
          <div className="widget">
            <div className="row between" style={{ marginBottom: 10 }}>
              <h2 className="title-lg">Categorías</h2>
              <Link to="/explorar" className="small" style={{ fontWeight: 700, color: 'var(--muted)', textDecoration: 'none' }}>Ver todas</Link>
            </div>
            <div className="cat-wrap"><div className="cat-grid">
              {CATEGORIES.filter((c) => !c.hidden || countIn(c.key)).map((c, i) => {
                const n = countIn(c.key);
                return (
                  <Link key={c.key} to={`/explorar?cat=${c.key}`} className="cat-tile" data-cat={c.key} style={{ '--i': i }}>
                    <span className="cat-ico"><Icon name={c.icon} size={22} stroke={2.2} /></span>
                    <span className="cat-name">{c.label}</span>
                    {places && <span className="cat-count">{n ? `${n} ${n === 1 ? 'sitio' : 'sitios'}` : 'Pronto'}</span>}
                  </Link>
                );
              })}
            </div></div>
          </div>

          {rest.length > 0 && (
            <div className="widget home-list" style={{ paddingBottom: 6 }}>
              <div className="row between">
                <h2 className="title-lg">En NetWish</h2>
                <Link to="/explorar" className="small" style={{ fontWeight: 700, color: 'var(--muted)', textDecoration: 'none' }}>Ver todo</Link>
              </div>
              <div className="home-list-rows">
                {rest.slice(0, 8).map((b) => <BusinessRow key={b.username || b.name} biz={b} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
