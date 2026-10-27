import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Spinner } from '../../components/ui.jsx';
import { PlaceInfo, placeSummary } from '../../components/BusinessCards.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { directory, myOrders, isReservation, STATUS } from '../../lib/data.js';
import { categoryOf, kindOf } from '../../lib/categories.js';
import { initials, longDate, money, todayISO, toneFor } from '../../lib/format.js';
import { isClosed } from '../../lib/booking.js';
import { modulesFor } from '../../lib/questionnaire.js';
import { eventsWithin } from '../../lib/events.js';

const ACTIVE = [STATUS.KITCHEN, STATUS.PENDING, STATUS.CONFIRMED, STATUS.READY];

const lower = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : '');

// The soonest booking or order from today on, as a slim dark cover. Nothing when there is none.
function NextBooking({ user }) {
  const { data: orders } = useAsync(() => (user ? myOrders() : Promise.resolve([])), [user?.id]);
  const today = new Date().toISOString().slice(0, 10);
  const active = (orders || []).filter((o) => ACTIVE.includes(o.status) && (o.date || '') >= today)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
  if (!active) return null;
  const label = active.status === STATUS.KITCHEN ? 'En cocina' : active.status === STATUS.PENDING ? 'Pendiente' : active.status === STATUS.CONFIRMED ? 'Confirmada' : 'Listo';
  const when = [active.date === today ? 'Hoy' : active.date ? new Date(`${active.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }) : '', (active.time || '').split(' - ')[0]].filter(Boolean).join(' · ');
  return (
    <Link to="/reservas" className="story dark" style={{ '--story-h': '150px' }}>
      <span className="eyebrow" style={{ color: 'var(--accent)' }}>{isReservation(active) ? 'Tu reserva' : 'Tu pedido'} · {label}</span>
      <span className="story-title">{active.business_name}{when ? `, ${lower(when)}` : ''}</span>
    </Link>
  );
}

// One idea per cover: today's set menu at a restaurant, told as a headline.
function MenuStory({ biz, settings, big }) {
  const sum = placeSummary(biz, settings);
  const menu = settings.daily_menu;
  const first = menu.first_courses?.[0];
  const second = menu.second_courses?.[0];
  const headline = first && second ? `${first} y ${lower(second)} en ${biz.name}` : `${first || second} en ${biz.name}`;
  const price = Number(menu.price) > 0 ? money(menu.price) : '';
  return (
    <Link to={`/negocio/${encodeURIComponent(biz.name)}`} className="story" style={{ background: toneFor(biz.name), '--story-h': big ? '430px' : '260px' }}>
      {biz.cover_url ? <><img className="cover-img" src={biz.cover_url} alt="" /><span className="cover-shade" /></> : <span className="ghost" aria-hidden="true">{initials(biz.name)}</span>}
      <span className="story-top">
        <span className="eyebrow">Menú del día</span>
        <span className="story-title">{headline}</span>
      </span>
      <span className="cover-strip">
        <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
          <span className="cover-info" style={{ fontSize: 15, fontWeight: 700 }}>{[price, sum.state?.label.replace(/^(Abierto|Cerrado) · /, '')].filter(Boolean).join(' · ')}</span>
          {menu.includes && <span className="cover-info" style={{ opacity: 0.8, fontWeight: 500 }}>Incluye {lower(menu.includes)}</span>}
        </span>
        {sum.canBook && <span className="btn sm" style={{ background: '#fff' }}>Reservar</span>}
      </span>
    </Link>
  );
}

// A place with no menu today still gets a cover: its name and what matters now.
function PlaceStory({ biz, settings, big }) {
  const sum = placeSummary(biz, settings);
  return (
    <Link to={`/negocio/${encodeURIComponent(biz.name)}`} className="story" style={{ background: toneFor(biz.name), '--story-h': big ? '430px' : '260px' }}>
      {biz.cover_url ? <><img className="cover-img" src={biz.cover_url} alt="" /><span className="cover-shade" /></> : <span className="ghost" aria-hidden="true">{initials(biz.name)}</span>}
      <span className="story-top">
        <span className="eyebrow">{biz.category || categoryOf(biz).label}</span>
        <span className="story-title">{biz.name}</span>
      </span>
      <span className="cover-strip">
        <span className="grow stack" style={{ gap: 1, minWidth: 0 }}><PlaceInfo state={sum.state} line={sum.line} /></span>
        {sum.canBook && <span className="btn sm" style={{ background: '#fff' }}>Reservar</span>}
      </span>
    </Link>
  );
}

function EventStory({ ev, biz, bookable }) {
  const day = new Date(`${ev.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
  return (
    <Link to={`/negocio/${encodeURIComponent(biz.name)}${bookable ? `?reservar=1&dia=${ev.date}` : ''}`} className="story dark" style={{ '--story-h': '200px' }}>
      <span className="eyebrow" style={{ color: 'var(--accent)' }}>{ev.date === new Date().toISOString().slice(0, 10) ? 'Hoy' : day}{ev.price ? ` · ${money(ev.price)}` : ''}</span>
      <span className="story-title">{ev.title} en {biz.name}</span>
    </Link>
  );
}

export default function Home() {
  const { user, displayName, avatar } = useAuth();
  const { data: places, loading, error } = useAsync(() => directory(), []);
  const all = places || [];
  const open = (r) => !!placeSummary(r.biz, r.settings).state?.open;
  const restaurants = all.filter((r) => r.settings && kindOf(r.biz) === 'restaurant');
  // Restaurants with today's set menu, the open ones first.
  const menus = restaurants.filter(({ settings }) => {
    const m = settings.daily_menu;
    return m && m.active !== false && (m.first_courses?.length || m.second_courses?.length) && modulesFor(settings.profile).menuDia && !isClosed(settings, todayISO());
  }).sort((a, b) => Number(open(b)) - Number(open(a)));
  const event = restaurants.flatMap(({ biz, settings }) => eventsWithin(settings.profile?.eventos).map((ev) => ({ ev, biz, bookable: settings.profile?.reservas !== false && !isClosed(settings, ev.date) })))
    .sort((a, b) => a.ev.date.localeCompare(b.ev.date))[0];
  // Lead with a menu; without one, the open restaurant (or any place) with the best cover.
  const lead = menus[0] || restaurants.find(open) || all.find((r) => r.biz.cover_url) || restaurants[0] || all[0];
  const second = menus.find((r) => r !== lead) || all.find((r) => r !== lead && r.biz !== event?.biz && kindOf(r.biz) === 'restaurant');
  const story = (r, big) => (menus.includes(r) ? <MenuStory key={r.biz.name} biz={r.biz} settings={r.settings} big={big} /> : <PlaceStory key={r.biz.name} biz={r.biz} settings={r.settings} big={big} />);

  return (
    <div className="page">
      <div className="row" style={{ alignItems: 'flex-end', padding: '0 4px' }}>
        <div className="grow stack" style={{ gap: 2 }}>
          <span className="eyebrow">{longDate()}</span>
          <h1 className="title-xl">{displayName ? `Hola, ${displayName.split(' ')[0]}` : 'Hoy'}</h1>
        </div>
        <Link to="/cuenta" className="icon-btn" aria-label="Mi cuenta" style={{ background: 'var(--ink)', color: 'var(--accent)', fontWeight: 800, overflow: 'hidden' }}>
          {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user ? initials(displayName) : <Icon name="person" size={20} />}
        </Link>
      </div>

      {loading && <Spinner />}
      {error && <Empty icon="store" title="No hemos podido cargar los comercios">Revisa tu conexión y vuelve a intentarlo.</Empty>}

      <div className="stories">
        <NextBooking user={user} />
        {lead && <div className="story-lead">{story(lead, true)}</div>}
        {event && <EventStory {...event} />}
        {second && story(second, false)}
      </div>
    </div>
  );
}
