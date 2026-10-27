import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Mono, Sheet, Spinner, StatusVeil, useToast } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { kindOf } from '../lib/categories.js';
import useAsync from '../hooks/useAsync.js';
import { adminBusinesses, getRestaurantSettings, isPickup, isReservation, setDemoAs, subscribe } from '../lib/data.js';
import OwnerForm from './OwnerForm.jsx';
import { typeOf } from '../lib/businessTypes.js';
import { modulesFor } from '../lib/questionnaire.js';
import { parseTableBooking } from '../lib/agenda.js';
import { normalize } from '../lib/format.js';
import { businessUrl } from '../lib/qr.js';
import { chime, soundOn, systemNotify, unlockSound } from '../lib/alerts.js';
import { usePanelPrefs } from '../lib/panelPrefs.js';
import { isUnseen, markSeen, panelSections, sectionOf } from '../lib/panelNav.js';

const CUSTOMER_NAV = [
  { to: '/', label: 'Hoy', icon: 'today', end: true },
  { to: '/explorar', label: 'Explorar', icon: 'compass' },
  { to: '/escanear', label: 'Escanear', icon: 'scan' },
  { to: '/reservas', label: 'Reservas', icon: 'calendar' },
  { to: '/cuenta', label: 'Cuenta', icon: 'person' },
];

const DETAIL_ROUTES = ['/negocio/', '/mesa/', '/chat/', '/reserva/'];

export function Brand({ to = '/', label = 'NetWish' }) {
  return (
    <NavLink to={to} className="brand">
      <svg className="mono" viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="116" fill="var(--accent)" />
        <g transform="translate(-7 23)" fill="var(--ink)" stroke="var(--ink)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M149 352V160L333 352V264" fill="none" strokeWidth="64" />
          <path d="M333 82Q341 132 395 140Q341 148 333 198Q325 148 271 140Q325 132 333 82Z" strokeWidth="8" />
        </g>
      </svg>
      <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>{label}</span>
    </NavLink>
  );
}

function TabBar({ items, onMore, moreActive }) {
  return (
    <nav className="tabbar" aria-label="Pestañas">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} aria-label={it.label} className={({ isActive }) => (it.className !== undefined ? it.className : isActive ? 'active' : '')}>
          <Icon name={it.icon} size={21} />
          <span className="tab-label">{it.short || it.label}</span>
          {it.badge ? <span className="tab-dot" aria-label={`${it.badge} nuevas`} /> : it.isNew ? <span className="tab-dot new" aria-label="Nuevo" /> : null}
        </NavLink>
      ))}
      {onMore && (
        <a href="#mas" role="button" aria-label="Más" className={moreActive ? 'active' : ''} onClick={(e) => { e.preventDefault(); onMore(); }}>
          <Icon name="grid" size={21} />
          <span className="tab-label">Más</span>
        </a>
      )}
    </nav>
  );
}

// Device preferences for the panel: night mode, the host-stand tablet mode and the booking chime.
export function PanelPrefs({ prefs, setPref, dark }) {
  const row = (label, sub, on, toggle) => (
    <button className="list-row" onClick={toggle} role="switch" aria-checked={on}>
      <span className="grow stack" style={{ gap: 1 }}>
        <span className="t" style={{ color: 'inherit' }}>{label}</span>
        <span className="s" style={{ color: dark ? 'rgba(255,255,255,.6)' : undefined }}>{sub}</span>
      </span>
      <span className={`switch ${on ? 'on' : ''}`} aria-hidden="true"><span /></span>
    </button>
  );
  return (
    <div className="stack" style={{ gap: 0 }}>
      {row('Modo noche', prefs.theme === 'auto' ? 'Automático: oscuro de 20:00 a 8:00' : prefs.theme === 'dark' ? 'Siempre oscuro' : 'Siempre claro',
        prefs.theme !== 'light', () => setPref('theme', prefs.theme === 'auto' ? 'dark' : prefs.theme === 'dark' ? 'light' : 'auto'))}
      {row('Sonido de avisos', 'Suena cuando entra una reserva o un pedido nuevo', prefs.sound, () => { unlockSound(); setPref('sound', !prefs.sound); })}
      {row('Modo atril', 'Pantalla completa y sin apagarse, para la tablet de la entrada', prefs.stand, () => setPref('stand', !prefs.stand))}
    </div>
  );
}

function SideNav({ items, header, footer }) {
  return (
    <aside className="sidebar">
      {header}
      <nav aria-label="Navegación principal">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (it.className !== undefined ? it.className : isActive ? 'active' : '')}>
            <Icon name={it.icon} size={20} />
            <span>{it.label}</span>
            {it.badge ? <span className="badge">{it.badge}</span> : it.isNew ? <span className="new-dot" aria-label="Nuevo" /> : null}
          </NavLink>
        ))}
      </nav>
      <div className="foot">{footer}</div>
    </aside>
  );
}

// Inside the booking button a restaurant puts on its own website (public/reservar.js):
// only the page, no NetWish menus. Remembered for the visit so inner links keep it.
function isEmbedded(search) {
  try {
    if (new URLSearchParams(search).get('embed') === '1') sessionStorage.setItem('netwish.embed', '1');
    return window.self !== window.top && sessionStorage.getItem('netwish.embed') === '1';
  } catch {
    return false;
  }
}

export function CustomerShell() {
  const { pathname, search } = useLocation();
  const { business } = useAuth();
  const isDetail = DETAIL_ROUTES.some((r) => pathname.startsWith(r));
  if (isEmbedded(search)) {
    return (
      <div className="shell embed">
        <main className="shell-main"><Outlet /></main>
      </div>
    );
  }
  return (
    <div className="shell">
      <StatusVeil />
      <SideNav
        items={CUSTOMER_NAV}
        header={<Brand />}
        footer={(
          <NavLink to={business ? '/panel' : '/negocios'} className="btn ghost block" style={{ color: '#fff' }}>
            {business ? 'Ir a mi panel' : 'NetWish para negocios'}
          </NavLink>
        )}
      />
      <main className="shell-main">
        <Outlet />
      </main>
      {!isDetail && <TabBar items={CUSTOMER_NAV} />}
    </div>
  );
}

// A booking made by a customer (not one the restaurant wrote down) rings and shows a banner.
function useNewBookingAlerts(business, onNew) {
  const toast = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener('pointerdown', unlock, { once: true });
    const off = subscribe('orders', (payload) => {
      const o = payload.new;
      if (payload.eventType !== 'INSERT' || !o || normalize(o.business_name) !== normalize(business.name)) return;
      if ((!isReservation(o) && !isPickup(o)) || ['telefono', 'local'].includes(o.source)) return;
      if (isPickup(o)) {
        const text = `Nuevo pedido · ${o.customer} · ${o.items.replace(/^Pedido para recoger:\s*/i, '').split(' · ')[0]}`;
        if (soundOn()) chime();
        systemNotify('Nuevo pedido para recoger', text);
        toast(text, 'info', { action: { label: 'Ver', onClick: () => navigate('/panel/reservas') }, duration: 9000 });
        onNew();
        return;
      }
      if (!/\d+\s*pax/i.test(o.items || '')) {
        const text = `Nueva reserva · ${o.customer} · ${String(o.time || '').split(' - ')[0]}`;
        if (soundOn()) chime();
        systemNotify('Nueva reserva', text);
        toast(text, 'info', { action: { label: 'Ver', onClick: () => navigate('/panel/reservas') }, duration: 9000 });
        onNew();
        return;
      }
      const b = parseTableBooking(o);
      const when = new Date(`${o.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
      const text = `Nueva reserva · ${o.customer} · ${b.guests} pers. · ${when} ${b.start}`;
      if (soundOn()) chime();
      systemNotify('Nueva reserva', `${o.customer} · ${b.guests} pers. · ${when} ${b.start}`);
      toast(text, 'info', { action: { label: 'Ver', onClick: () => navigate('/panel/reservas') }, duration: 9000 });
      onNew();
    });
    return () => { off(); window.removeEventListener('pointerdown', unlock); };
  }, [business.name]);
}

// The admin inside someone's panel: what kind of business it is, its owner and the way out.
function AdminBanner({ business, onExit }) {
  const { refreshBusiness } = useAuth();
  const [owner, setOwner] = useState(false);
  const { data: row, reload } = useAsync(
    () => (owner ? adminBusinesses().then((list) => list.find((b) => b.username === business.username) || null) : Promise.resolve(null)),
    [owner, business.username],
  );
  const text = business.viewingDemo
    ? `Estás viendo el panel de ejemplo de ${business.name}. Lo que cambies se ve en su página.`
    : business.preview
      ? `Vista previa: ${business.name} aún no está conectado. Móntalo a tu gusto y, cuando quieras, asígnaselo a su dueño.`
      : `Estás dentro del panel de ${business.name} como administrador. Lo que cambies se ve en su página.`;
  return (
    <>
      <div className="widget row" style={{ margin: '12px var(--gutter) 0', background: 'var(--accent)', gap: 12, flexWrap: 'wrap' }} role="status">
        <Icon name="eye" size={20} />
        <span className="small grow" style={{ fontWeight: 600, minWidth: 180 }}>{text}</span>
        {!business.viewingDemo && <button className="btn soft sm" onClick={() => setOwner(true)}>Dueño</button>}
        <button className="btn primary sm" onClick={onExit}>Salir</button>
      </div>
      <Sheet open={owner} onClose={() => setOwner(false)} title="Dueño del negocio">
        {row ? <OwnerForm business={row} onDone={() => { reload(); refreshBusiness(); setOwner(false); }} /> : <Spinner />}
      </Sheet>
    </>
  );
}

export function BusinessShell() {
  const { business } = useAuth();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const [fresh, setFresh] = useState(0);
  const { prefs, setPref, dark } = usePanelPrefs();
  const { refreshBusiness } = useAuth();
  const navigate = useNavigate();
  const exitDemo = async () => {
    setDemoAs(null);
    await refreshBusiness();
    navigate('/admin');
  };
  useNewBookingAlerts(business, () => setFresh((n) => n + 1));
  useEffect(() => { if (pathname === '/panel/reservas') setFresh(0); }, [pathname]);
  useEffect(() => setMore(false), [pathname]);
  const kind = kindOf(business);
  // Panel sections follow the business's questionnaire answers.
  const { data: settings, reload: reloadSettings } = useAsync(() => getRestaurantSettings(business.name, kind), [business.name, kind]);
  const mods = modulesFor(settings?.profile);
  const type = typeOf(business);
  const sections = panelSections(kind, mods, type);
  const current = sectionOf(sections, pathname);
  // Opening a section or tab clears its "new" dot.
  useEffect(() => { if (current) markSeen(current.key, pathname); }, [current?.key, pathname]);
  const nav = sections.map((s) => ({
    to: s.to, label: s.label, short: s.short, icon: s.icon, end: s.end,
    badge: s.alerts ? fresh || null : null,
    isNew: s.isNew && current?.key !== s.key && isUnseen(s.key),
    className: current?.key === s.key ? 'active' : '',
  }));
  // Up to five sections fit the phone's bar; any more go under "Más".
  const mobileNav = nav.length <= 5 ? nav : nav.slice(0, 4);
  const rest = nav.filter((n) => !mobileNav.includes(n));
  return (
    <div className={`shell panel${prefs.stand ? ' stand' : ''}`} data-theme={dark ? 'dark' : 'light'}>
      <StatusVeil />
      <SideNav
        items={nav}
        footer={<a className="btn ghost block" style={{ color: '#fff' }} href={businessUrl(business.name)} target="_blank" rel="noreferrer">Ver mi página</a>}
        header={(
          <div className="row" style={{ padding: '0 6px' }}>
            <Mono name={business.name} image={business.image} />
            <span className="stack" style={{ gap: 0, minWidth: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{business.name}</span>
              <span className="small" style={{ color: 'var(--accent)' }}>{business.viewingDemo ? '● Negocio de ejemplo' : business.preview ? '● Aún no conectado' : business.status === 'approved' ? (kind === 'shop' ? '● Recibiendo pedidos' : '● Recibiendo reservas') : '● Pendiente de aprobación'}</span>
            </span>
          </div>
        )}
      />
      <main className="shell-main">
        {business.viewingAs && <AdminBanner business={business} onExit={exitDemo} />}
        {business.status === 'pending' && !business.viewingAs && (
          <div className="widget row" style={{ margin: '12px var(--gutter) 0', background: 'var(--accent)', gap: 12 }} role="status">
            <Icon name="bell" size={20} />
            <span className="small" style={{ fontWeight: 600 }}>Tu página aún no es pública. Completa la lista "Para salir publicado" y la revisamos enseguida.</span>
          </div>
        )}
        {business.status === 'rejected' && !business.viewingAs && (
          <div className="widget row" style={{ margin: '12px var(--gutter) 0', background: 'var(--danger-soft)', gap: 12 }} role="status">
            <Icon name="bell" size={20} />
            <span className="small" style={{ fontWeight: 600 }}>No hemos podido aprobar tu negocio. Escríbenos desde "Contactar con NetWish" y lo vemos.</span>
          </div>
        )}
        <Outlet context={{ settings, reloadSettings, modules: mods, sections, prefs, setPref }} />
      </main>
      <TabBar items={mobileNav} onMore={rest.length ? () => setMore(true) : null} moreActive={rest.some((n) => n.className)} />
      {prefs.stand && <button className="stand-exit" onClick={() => setPref('stand', false)}>Salir del modo atril</button>}
      <Sheet open={more} onClose={() => setMore(false)} title="Más">
        <div className="widget" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {rest.map((n) => (
            <NavLink key={n.to} to={n.to} className="list-row">
              <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name={n.icon} size={20} /></span>
              <span className="grow t">{n.label}</span>
              <Icon name="chevron" size={18} />
            </NavLink>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
