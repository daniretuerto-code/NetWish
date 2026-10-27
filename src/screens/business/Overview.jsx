import { useEffect } from 'react';
import { Link, Navigate, useOutletContext } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { PageHeader, Ring, Skeleton, Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessInbox, businessOrders, isPickup, isReservation, kitchenSessions, listProducts, STATUS, subscribe } from '../../lib/data.js';
import { kindOf } from '../../lib/categories.js';
import { nounsOf, typeOf } from '../../lib/businessTypes.js';
import { classesOn, isClassBooking, takenIn } from '../../lib/classes.js';
import { availability } from '../../lib/shop.js';
import { sectionsFor } from '../../lib/typeQuestions.js';
import { duration, greeting, longDate, money, todayISO } from '../../lib/format.js';
import { profileProgress } from '../../lib/questionnaire.js';
import Today from './Today.jsx';

const ACTIVE = [STATUS.KITCHEN];

export default function Overview() {
  const { business } = useAuth();
  const kind = kindOf(business);
  if (kind === 'restaurant') return <Today />;
  if (kind === 'shop') return <ShopHome />;
  if (kind === 'classes') return <ClassesHome />;
  return <GeneralOverview />;
}

// New shops, studios and taxis start with the questionnaire, like restaurants.
function useOnboarding() {
  const { settings } = useOutletContext();
  const { business } = useAuth();
  return settings && !settings.profile?.onboarded && !business.viewingDemo;
}

function Tile({ to, eyebrow, title, icon, tone, children }) {
  const look = {
    accent: { background: 'var(--accent)' },
    dark: { background: 'var(--ink)', color: '#fff' },
    cover: { background: 'var(--cover)', color: '#fff' },
  }[tone] || {};
  const onDark = tone === 'dark' || tone === 'cover';
  return (
    <Link to={to} className="widget link stack" style={{ justifyContent: 'space-between', minHeight: 150, ...look }}>
      {children || <span className="mono" style={onDark ? { background: 'rgba(255,255,255,.16)', color: '#fff' } : { background: tone === 'accent' ? 'var(--ink)' : 'var(--bg)', color: tone === 'accent' ? 'var(--accent-on-ink)' : 'var(--ink)' }}><Icon name={icon} /></span>}
      <span className="stack" style={{ gap: 0 }}>
        <span className="eyebrow" style={onDark ? { color: 'rgba(255,255,255,.75)' } : tone === 'accent' ? { color: 'inherit', opacity: 0.7 } : undefined}>{eyebrow}</span>
        <span className="title-lg">{title}</span>
      </span>
    </Link>
  );
}

function ProfileTile({ business, settings }) {
  const pct = settings ? profileProgress(settings.profile || {}, sectionsFor(business)) : 100;
  if (pct >= 100) return null;
  return (
    <Tile to="/panel/ajustes" eyebrow="Personaliza tu negocio" title={`${pct} % completado`} tone="accent">
      <Ring value={pct / 100} color="var(--ink)" label={`Perfil completado al ${pct} %`} />
    </Tile>
  );
}

// Shops: what to prepare, who is coming to pick up, what is running out.
function ShopHome() {
  const { business } = useAuth();
  const { settings } = useOutletContext();
  const type = typeOf(business);
  const onboarding = useOnboarding();
  const { data, loading, reload } = useAsync(async () => {
    const [orders, products, inbox] = await Promise.all([businessOrders(business.name), listProducts(business.name), businessInbox(business.name)]);
    return { orders: orders.filter(isPickup), products, inbox };
  }, [business.name]);
  useEffect(() => subscribe('orders', () => reload()), [reload]);

  if (onboarding) return <Navigate to="/panel/empezar" replace />;
  if (loading && !data) return <Skeleton />;
  const today = todayISO();
  const live = data.orders.filter((o) => ![STATUS.CANCELLED, STATUS.REJECTED].includes(o.status));
  const fresh = live.filter((o) => o.status === STATUS.ORDERED);
  const preparing = live.filter((o) => o.status === STATUS.PREPARING);
  const ready = live.filter((o) => o.status === STATUS.PICKUP);
  const todays = live.filter((o) => o.date === today && o.status !== STATUS.COLLECTED).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const week = live.filter((o) => o.date >= weekAgo && o.date <= today);
  const weekSales = week.reduce((n, o) => n + Number(o.total || 0), 0);
  const shown = data.products.filter((p) => !p.hidden);
  const out = shown.filter((p) => availability(p).soldOut);
  const low = shown.filter((p) => availability(p).low);
  const noPhoto = shown.filter((p) => !p.image_url).length;
  const unread = data.inbox.reduce((n, t) => n + t.unread, 0);
  const top = new Map();
  for (const o of week) for (const l of o.lines || []) top.set(l.name, (top.get(l.name) || 0) + Number(l.qty || 1));
  const best = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const notTaking = settings && settings.profile?.recogida !== true;

  return (
    <div className="page">
      <PageHeader eyebrow={longDate()} title={greeting()} />

      {notTaking && (
        <Link to="/panel/ajustes" className="widget row" style={{ gap: 12, background: 'var(--accent)' }}>
          <Icon name="bag" size={20} />
          <span className="small grow" style={{ fontWeight: 600 }}>Tus clientes aún no pueden reservar para recoger. Actívalo en Ajustes → Lo básico.</span>
        </Link>
      )}

      <div className="bento">
        <Link to="/panel/reservas" className="widget dark span-2 stack" style={{ gap: 6, textDecoration: 'none', color: '#fff' }}>
          <span className="eyebrow">Pedidos para recoger hoy</span>
          <span className="price" style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{todays.length}</span>
          <span className="small" style={{ opacity: 0.7 }}>
            {todays[0] ? `Próximo: ${String(todays[0].time).slice(0, 5)} · ${todays[0].customer}` : 'No hay más recogidas hoy'}
          </span>
        </Link>
        <Tile to="/panel/reservas" eyebrow="Nuevos" title={fresh.length ? `${fresh.length} por preparar` : 'Al día'} icon="bag" tone={fresh.length ? 'accent' : ''} />
        <Tile to="/panel/reservas" eyebrow="Esperando al cliente" title={`${ready.length} ${ready.length === 1 ? 'listo' : 'listos'}`} icon="check" />
        <Tile to="/panel/reservas" eyebrow="Últimos 7 días" title={money(weekSales)} icon="chart" tone="cover" />
        <Tile to={type.shop?.daily ? '/panel/stock' : '/panel/carta'} eyebrow={type.shop?.daily ? 'Mostrador' : 'Stock'} title={out.length ? `${out.length} ${out.length === 1 ? 'agotado' : 'agotados'}` : low.length ? `${low.length} quedan pocos` : 'Todo en orden'} icon="box" tone={out.length ? 'accent' : ''} />
        <Tile to="/panel/mensajes" eyebrow="Mensajes" title={unread ? `${unread} sin leer` : 'Al día'} icon="chat" />
        <ProfileTile business={business} settings={settings} />
      </div>

      {preparing.length > 0 && <p className="small muted" style={{ margin: 0 }}>{preparing.length} {preparing.length === 1 ? 'pedido se está' : 'pedidos se están'} preparando.</p>}

      <div className="two-col">
        <section className="widget" style={{ paddingBottom: 4 }}>
          <div className="row between">
            <h2 className="title-lg">Recogidas de hoy</h2>
            <Link to="/panel/reservas" className="small">Ver todos</Link>
          </div>
          {todays.length === 0 ? <p className="small muted" style={{ padding: '10px 0' }}>Cuando alguien reserve para recoger hoy, aparecerá aquí.</p> : todays.slice(0, 8).map((o) => (
            <div key={o.id} className="list-row">
              <span className="small" style={{ fontWeight: 800, width: 46 }}>{String(o.time).slice(0, 5)}</span>
              <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                <span className="t">{o.customer}</span>
                <span className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(o.lines || []).map((l) => `${l.qty}× ${l.name}`).join(', ') || o.items}</span>
              </span>
              {o.pickup_code && <span className="code-tag">{o.pickup_code}</span>}
            </div>
          ))}
        </section>
        <section className="widget" style={{ paddingBottom: 4 }}>
          <h2 className="title-lg">Lo que más se lleva</h2>
          {best.length === 0 ? <p className="small muted" style={{ padding: '10px 0' }}>Con los primeros pedidos verás aquí lo que más sale esta semana.</p> : best.map(([name, n]) => (
            <div key={name} className="list-row"><span className="grow t">{name}</span><span className="small" style={{ fontWeight: 800 }}>{n} uds.</span></div>
          ))}
          {(out.length > 0 || noPhoto > 0) && (
            <div className="stack" style={{ gap: 4, padding: '10px 0' }}>
              {out.length > 0 && <Link to="/panel/carta" className="small">Agotado: {out.slice(0, 4).map((p) => p.name).join(', ')}{out.length > 4 ? '…' : ''}</Link>}
              {noPhoto > 0 && <Link to="/panel/carta" className="small">{noPhoto} {noPhoto === 1 ? 'producto sin foto' : 'productos sin foto'}: con foto se venden mucho más</Link>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Studios and gyms: today's classes and how full they are.
function ClassesHome() {
  const { business } = useAuth();
  const { settings } = useOutletContext();
  const onboarding = useOnboarding();
  const { data, loading, reload } = useAsync(async () => {
    const [orders, inbox] = await Promise.all([businessOrders(business.name), businessInbox(business.name)]);
    return { orders, inbox };
  }, [business.name]);
  useEffect(() => subscribe('orders', () => reload()), [reload]);

  if (onboarding) return <Navigate to="/panel/empezar" replace />;
  if (loading && !data || !settings) return <Skeleton />;
  const today = todayISO();
  const classes = classesOn(settings.profile?.clases || [], today);
  const todays = data.orders.filter((o) => isClassBooking(o) && o.date === today && ![STATUS.CANCELLED, STATUS.REJECTED, STATUS.PENDING].includes(o.status));
  const waiting = data.orders.filter((o) => isClassBooking(o) && o.date >= today && o.status === STATUS.PENDING).length;
  const unread = data.inbox.reduce((n, t) => n + t.unread, 0);
  const places = classes.reduce((n, c) => n + Number(c.plazas || 0), 0);
  const now = new Date().toTimeString().slice(0, 5);
  const next = classes.find((c) => c.time >= now);

  return (
    <div className="page">
      <PageHeader eyebrow={longDate()} title={greeting()} />
      <div className="bento">
        <Link to="/panel/clases" className="widget dark span-2 stack" style={{ gap: 6, textDecoration: 'none', color: '#fff' }}>
          <span className="eyebrow">Plazas reservadas hoy</span>
          <span className="price" style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{todays.length}<span style={{ fontSize: 22, opacity: 0.6 }}> / {places}</span></span>
          <span className="small" style={{ opacity: 0.7 }}>{next ? `Próxima: ${next.time} · ${next.name}` : classes.length ? 'No quedan clases hoy' : 'Hoy no hay clases'}</span>
        </Link>
        <Tile to="/panel/reservas" eyebrow="Lista de espera" title={waiting ? `${waiting} esperando` : 'Nadie'} icon="users" tone={waiting ? 'accent' : ''} />
        <Tile to="/panel/mensajes" eyebrow="Mensajes" title={unread ? `${unread} sin leer` : 'Al día'} icon="chat" />
        <Tile to="/panel/clases" eyebrow="Horario" title="Gestionar clases" icon="dumbbell" tone="cover" />
        <ProfileTile business={business} settings={settings} />
      </div>
      <section className="widget" style={{ paddingBottom: 4 }}>
        <h2 className="title-lg">Clases de hoy</h2>
        {classes.length === 0 ? <p className="small muted" style={{ padding: '10px 0' }}>Hoy no hay clases en tu horario.</p> : classes.map((c) => {
          const n = takenIn(todays, c);
          return (
            <Link key={c.id} to="/panel/clases" className="list-row" style={{ color: 'inherit' }}>
              <span className="small" style={{ fontWeight: 800, width: 46 }}>{c.time}</span>
              <span className="grow stack" style={{ gap: 1 }}>
                <span className="t">{c.name}</span>
                <span className="s">{[c.teacher && `con ${c.teacher}`, duration(c.min)].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="pill" style={{ background: n >= c.plazas ? 'var(--danger-soft)' : 'var(--accent)' }}>{n}/{c.plazas}</span>
            </Link>
          );
        })}
      </section>
    </div>
  );
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

  const onboarding = useOnboarding();
  // A restaurant or taxi that hasn't answered the questionnaire starts there.
  if ((isRestaurant || kind === 'taxi') && onboarding) return <Navigate to="/panel/empezar" replace />;
  if (loading && !data) return <Skeleton />;
  const pct = settings && kind !== 'music' ? profileProgress(settings.profile || {}, sectionsFor(business)) : 100;
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
        <div className="widget dark span-2 stack" style={{ gap: 6, textDecoration: 'none', color: '#fff' }}>
          <span className="eyebrow">{kind === 'beauty' ? 'Citas de hoy' : kind === 'taxi' ? 'Viajes de hoy' : 'Reservas de hoy'}</span>
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
            <span className="eyebrow" style={{ color: 'inherit', opacity: 0.7 }}>{kind === 'beauty' ? 'Citas' : kind === 'taxi' ? 'Viajes' : 'Reservas'}</span>
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
              <span className="eyebrow" style={{ color: 'rgba(255,255,255,.75)' }}>{kind === 'taxi' ? 'Precios' : isRestaurant ? 'Carta' : nounsOf(business).list}</span>
              <span className="title-lg">Gestionar</span>
            </span>
          </Link>
        )}
      </div>

      <div className="widget" style={{ paddingBottom: 4 }}>
        <div className="row between">
          <h2 className="title-lg">{kind === 'beauty' ? 'Últimas citas' : kind === 'taxi' ? 'Últimos viajes' : 'Últimas reservas'}</h2>
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
