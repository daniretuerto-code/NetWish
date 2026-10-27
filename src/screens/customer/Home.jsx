import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Spinner } from '../../components/ui.jsx';
import { CoverCard, PlaceInfo, placeSummary } from '../../components/BusinessCards.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { directory, myOrders, isReservation, restaurantsToday, STATUS } from '../../lib/data.js';
import { CATEGORIES, kindOf } from '../../lib/categories.js';
import { longDate, money } from '../../lib/format.js';
import { isClosed } from '../../lib/booking.js';
import { modulesFor } from '../../lib/questionnaire.js';
import { eventDay, eventsWithin } from '../../lib/events.js';

const ACTIVE = [STATUS.KITCHEN, STATUS.PENDING, STATUS.CONFIRMED, STATUS.READY];

// Only shows up when there is something ahead: the soonest booking or order from today on.
function NextBooking({ user }) {
  const { data: orders } = useAsync(() => (user ? myOrders() : Promise.resolve([])), [user?.id]);
  const today = new Date().toISOString().slice(0, 10);
  const active = (orders || []).filter((o) => ACTIVE.includes(o.status) && (o.date || '') >= today)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
  if (!active) return null;
  const label = active.status === STATUS.KITCHEN ? 'En cocina' : active.status === STATUS.PENDING ? 'Pendiente' : active.status === STATUS.CONFIRMED ? 'Confirmada' : 'Listo';
  const when = [active.date === today ? 'Hoy' : active.date ? new Date(`${active.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : '', (active.time || '').split(' - ')[0]].filter(Boolean).join(' · ');
  const confirmed = active.status === STATUS.CONFIRMED || active.status === STATUS.READY;
  return (
    <Link to="/reservas" className="widget link row" style={{ gap: 14 }}>
      <span className="mono" style={{ background: confirmed ? 'var(--accent)' : 'var(--bg)', color: 'var(--ink)' }} aria-label={isReservation(active) ? 'Tu reserva' : 'Tu pedido'}><Icon name={confirmed ? 'check' : 'calendar'} size={22} stroke={2.4} /></span>
      <span className="grow stack" style={{ gap: 0, minWidth: 0 }}>
        <span className="t" style={{ fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.business_name}</span>
        <span className="small muted" style={{ fontWeight: 600 }}>{[label, when].filter(Boolean).join(' · ')}</span>
      </span>
      <Icon name="chevron" size={18} style={{ color: 'var(--muted)' }} />
    </Link>
  );
}

// Today's set menus and this week's events: one quiet list each, no boxes inside boxes.
function TodayInPalencia() {
  const { data } = useAsync(() => restaurantsToday(), []);
  const all = data || [];
  const list = all.filter((r) => r.open);
  // An event on a day the restaurant closes opens its page, not the booking sheet.
  const events = all.flatMap(({ biz, settings }) => eventsWithin(settings.profile?.eventos).map((ev) => ({ ev, biz, bookable: settings.profile?.reservas !== false && !isClosed(settings, ev.date) })))
    .sort((a, b) => a.ev.date.localeCompare(b.ev.date)).slice(0, 3);
  const withMenu = list.filter(({ settings }) => settings.daily_menu && settings.daily_menu.active !== false && settings.daily_menu.first_courses?.length && modulesFor(settings.profile).menuDia);
  return (
    <>
      {withMenu.length > 0 && (
        <section className="widget" style={{ paddingBottom: 6 }}>
          <h2 className="title-lg">Menú del día</h2>
          {withMenu.slice(0, 5).map(({ biz, settings }) => (
            <Link key={biz.name} to={`/negocio/${encodeURIComponent(biz.name)}`} className="list-row">
              <span className="grow stack" style={{ gap: 1 }}>
                <span className="t">{biz.name}</span>
                <span className="s" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{settings.daily_menu.first_courses.slice(0, 3).join(' · ')}</span>
              </span>
              {Number(settings.daily_menu.price) > 0 && <span className="price">{money(settings.daily_menu.price)}</span>}
            </Link>
          ))}
        </section>
      )}
      {events.length > 0 && (
        <section className="widget" style={{ paddingBottom: 6 }}>
          <h2 className="title-lg">Esta semana</h2>
          {events.map(({ ev, biz, bookable }) => (
            <Link key={`${biz.name}-${ev.id}`} to={`/negocio/${encodeURIComponent(biz.name)}${bookable ? `?reservar=1&dia=${ev.date}` : ''}`} className="list-row">
              <span className="date-tile">{eventDay(ev.date)}</span>
              <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                <span className="t">{ev.title}</span>
                <span className="s">{biz.name}{ev.price ? ` · ${money(ev.price)}` : ''}</span>
              </span>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}

export default function Home() {
  const { user, displayName } = useAuth();
  const { data: places, loading, error } = useAsync(() => directory(), []);
  const all = places || [];
  // A restaurant open right now leads, then one with a photo.
  const pick = all.find((r) => kindOf(r.biz) === 'restaurant' && placeSummary(r.biz, r.settings).state?.open)
    || all.find((r) => r.biz.cover_url) || all.find((r) => kindOf(r.biz) === 'restaurant') || all[0];
  const featured = pick?.biz;
  const featuredSum = pick ? placeSummary(pick.biz, pick.settings) : null;

  return (
    <div className="page">
      <div className="row" style={{ alignItems: 'flex-end', padding: '0 4px' }}>
        <div className="grow stack" style={{ gap: 2 }}>
          <span className="eyebrow">{longDate()}</span>
          <h1 className="title-xl">{displayName ? `Hola, ${displayName.split(' ')[0]}` : 'Palencia'}</h1>
        </div>
        <Link to="/escanear" className="icon-btn" aria-label="Escanear un QR" style={{ background: 'var(--ink)', color: 'var(--accent)' }}>
          <Icon name="scan" size={20} />
        </Link>
      </div>

      <div className="chips" aria-label="Categorías">
        {CATEGORIES.map((c) => (
          <Link key={c.key} to={`/explorar?cat=${c.key}`} className="chip">
            <Icon name={c.icon} size={17} />{c.label}
          </Link>
        ))}
      </div>

      {loading && <Spinner />}
      {error && <Empty icon="store" title="No hemos podido cargar los comercios">Revisa tu conexión y vuelve a intentarlo.</Empty>}

      <div className="two-col">
        <div className="stack">
          <NextBooking user={user} />
          {featured && <CoverCard featured minHeight={300} biz={featured} eyebrow="Destacado hoy" info={<PlaceInfo state={featuredSum.state} line={featuredSum.line} />} cta={featuredSum.canBook ? 'Reservar' : 'Ver'} to={featuredSum.canBook ? `/negocio/${encodeURIComponent(featured.name)}?reservar=1` : undefined} />}
        </div>
        <div className="stack">
          <TodayInPalencia />
          {all.length > 1 && (
            <Link to="/explorar" className="widget link row" style={{ gap: 14 }}>
              <span className="grow stack" style={{ gap: 0 }}>
                <span className="t" style={{ fontWeight: 800, fontSize: 16 }}>Ver todos los sitios</span>
                <span className="small muted" style={{ fontWeight: 600 }}>{all.length} en NetWish</span>
              </span>
              <Icon name="chevron" size={18} style={{ color: 'var(--muted)' }} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
