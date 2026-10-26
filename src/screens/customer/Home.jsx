import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Spinner } from '../../components/ui.jsx';
import { BusinessRow, CoverCard } from '../../components/BusinessCards.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { listBusinesses, myOrders, isReservation, restaurantsToday, STATUS } from '../../lib/data.js';
import { CATEGORIES, kindOf, taglineFor } from '../../lib/categories.js';
import { initials, longDate, money } from '../../lib/format.js';
import { eventDay, eventsWithin } from '../../lib/events.js';

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

// Restaurants open today: their daily menu and a straight way to book a table.
function TodayInPalencia() {
  const { data } = useAsync(() => restaurantsToday(), []);
  const all = data || [];
  const list = all.filter((r) => r.open);
  const events = all.flatMap(({ biz, settings }) => eventsWithin(settings.profile?.eventos).map((ev) => ({ ev, biz })))
    .sort((a, b) => a.ev.date.localeCompare(b.ev.date)).slice(0, 6);
  if (!list.length && !events.length) return null;
  const withMenu = list.filter(({ settings }) => settings.daily_menu && settings.daily_menu.active !== false && settings.daily_menu.first_courses?.length);
  const tonight = list.filter(({ settings }) => settings.dinner_start);
  return (
    <section className="widget stack" style={{ gap: 10 }}>
      <span className="stack" style={{ gap: 0 }}>
        <span className="eyebrow">Hoy en Palencia</span>
        <h2 className="title-lg">¿Dónde comemos?</h2>
      </span>
      {withMenu.map(({ biz, settings }) => (
        <Link key={biz.name} to={`/negocio/${encodeURIComponent(biz.name)}`} className="order-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="row between" style={{ gap: 8 }}>
            <strong>{biz.name}</strong>
            {Number(settings.daily_menu.price) > 0 && <span className="price">{money(settings.daily_menu.price)}</span>}
          </span>
          <span className="small muted">Menú del día: {settings.daily_menu.first_courses.slice(0, 3).join(' · ')}</span>
        </Link>
      ))}
      {events.length > 0 && (
        <>
          <span className="eyebrow" style={{ marginTop: 4 }}>Esta semana</span>
          {events.map(({ ev, biz }) => (
            <Link key={`${biz.name}-${ev.id}`} to={`/negocio/${encodeURIComponent(biz.name)}?reservar=1&dia=${ev.date}`} className="order-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="row between" style={{ gap: 8 }}>
                <strong>{ev.title}</strong>
                <span className="small" style={{ fontWeight: 800 }}>{eventDay(ev.date)}</span>
              </span>
              <span className="small muted">{biz.name}{ev.price ? ` · ${money(ev.price)}` : ''}{ev.text ? ` · ${ev.text}` : ''}</span>
            </Link>
          ))}
        </>
      )}
      {tonight.length > 0 && (
        <>
          <span className="eyebrow" style={{ marginTop: 4 }}>Reserva para esta noche</span>
          <div className="chips">
            {tonight.map(({ biz }) => (
              <Link key={biz.name} to={`/negocio/${encodeURIComponent(biz.name)}?reservar=1`} className="chip" style={{ background: 'var(--bg)', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'var(--ink)' }}>
                <Icon name="utensils" size={16} /> {biz.name}
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
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
          {featured && <CoverCard featured biz={featured} eyebrow="Destacado hoy" subtitle={taglineFor(featured)} />}

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
          <TodayInPalencia />
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
