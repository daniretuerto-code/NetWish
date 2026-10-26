import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Mono, Sheet, useToast } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { kindOf } from '../lib/categories.js';
import useAsync from '../hooks/useAsync.js';
import { getRestaurantSettings, isReservation, subscribe } from '../lib/data.js';
import { modulesFor } from '../lib/questionnaire.js';
import { parseTableBooking } from '../lib/agenda.js';
import { normalize } from '../lib/format.js';
import { chime, soundOn, systemNotify, unlockSound } from '../lib/alerts.js';
import { usePanelPrefs } from '../lib/panelPrefs.js';

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
        <NavLink key={it.to} to={it.to} end={it.end} aria-label={it.label} className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name={it.icon} size={21} />
          <span className="tab-label">{it.label}</span>
          {it.badge ? <span className="tab-dot" aria-label={`${it.badge} nuevas`} /> : null}
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
function PanelPrefs({ prefs, setPref, dark }) {
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
      {row('Sonido de reservas', 'Suena cuando entra una reserva nueva', prefs.sound, () => { unlockSound(); setPref('sound', !prefs.sound); })}
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
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={it.icon} size={20} />
            <span>{it.label}</span>
            {it.badge ? <span className="badge">{it.badge}</span> : null}
          </NavLink>
        ))}
      </nav>
      <div className="foot">{footer}</div>
    </aside>
  );
}

export function CustomerShell() {
  const { pathname } = useLocation();
  const { business } = useAuth();
  const isDetail = DETAIL_ROUTES.some((r) => pathname.startsWith(r));
  return (
    <div className="shell">
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
      if (!isReservation(o) || ['telefono', 'local'].includes(o.source)) return;
      const b = parseTableBooking(o);
      const when = new Date(`${o.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
      const text = `Nueva reserva · ${o.customer} · ${b.guests} pers. · ${when} ${b.start}`;
      if (soundOn()) chime();
      systemNotify('Nueva reserva', `${o.customer} · ${b.guests} pers. · ${when} ${b.start}`);
      toast(text, 'info', { action: { label: 'Ver', onClick: () => navigate('/panel/pedidos') }, duration: 9000 });
      onNew();
    });
    return () => { off(); window.removeEventListener('pointerdown', unlock); };
  }, [business.name]);
}

export function BusinessShell() {
  const { business } = useAuth();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const [fresh, setFresh] = useState(0);
  const { prefs, setPref, dark } = usePanelPrefs();
  useNewBookingAlerts(business, () => setFresh((n) => n + 1));
  useEffect(() => { if (pathname === '/panel/pedidos') setFresh(0); }, [pathname]);
  useEffect(() => setMore(false), [pathname]);
  const kind = kindOf(business);
  const isRestaurant = kind === 'restaurant';
  const isBeauty = kind === 'beauty';
  // Panel sections follow the business's questionnaire answers.
  const { data: settings, reload: reloadSettings } = useAsync(() => getRestaurantSettings(business.name, kind), [business.name, kind]);
  const mods = modulesFor(settings?.profile);
  const nav = [
    { to: '/panel', label: isRestaurant ? 'Hoy' : 'Resumen', icon: isRestaurant ? 'today' : 'chart', end: true },
    ...(!isRestaurant || mods.reservas || mods.pedidosQr ? [{ to: '/panel/pedidos', label: isRestaurant && !mods.reservas ? 'Comandas' : 'Reservas', icon: 'calendar', badge: fresh || null }] : []),
    ...(isRestaurant && mods.cocina ? [{ to: '/panel/cocina', label: 'Cocina', icon: 'flame' }] : []),
    { to: '/panel/carta', label: isRestaurant ? 'Carta' : isBeauty ? 'Servicios' : 'Catálogo', icon: isBeauty ? 'scissors' : 'book' },
    ...(isRestaurant && (mods.reservas || mods.pedidosQr) ? [{ to: '/panel/mesas', label: 'Tu sala', icon: 'grid' }] : []),
    ...(isRestaurant ? [{ to: '/panel/personalizar', label: 'Personalizar', icon: 'gear' }] : []),
    ...(isBeauty ? [{ to: '/panel/horario', label: 'Horario y equipo', icon: 'calendar' }] : []),
    { to: '/panel/mensajes', label: 'Mensajes', icon: 'chat' },
    { to: '/panel/ajustes', label: 'Ajustes', icon: 'gear' },
  ];
  // Four sections on the phone's bar; everything else lives under "Más".
  const mobileNav = nav.filter((n) => ['/panel', '/panel/pedidos', '/panel/carta', '/panel/mensajes'].includes(n.to));
  const rest = nav.filter((n) => !mobileNav.includes(n));
  return (
    <div className={`shell panel${prefs.stand ? ' stand' : ''}`} data-theme={dark ? 'dark' : 'light'}>
      <SideNav
        footer={<PanelPrefs prefs={prefs} setPref={setPref} dark />}
        items={nav}
        header={(
          <div className="row" style={{ padding: '0 6px' }}>
            <Mono name={business.name} image={business.image} />
            <span className="stack" style={{ gap: 0, minWidth: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{business.name}</span>
              <span className="small" style={{ color: 'var(--accent)' }}>{business.status === 'approved' ? '● Recibiendo reservas' : '● Pendiente de aprobación'}</span>
            </span>
          </div>
        )}
      />
      <main className="shell-main">
        {business.status === 'pending' && (
          <div className="widget row" style={{ margin: '12px var(--gutter) 0', background: 'var(--accent)', gap: 12 }} role="status">
            <Icon name="bell" size={20} />
            <span className="small" style={{ fontWeight: 600 }}>Tu página aún no es pública. Completa la lista "Para salir publicado" y la revisamos enseguida.</span>
          </div>
        )}
        {business.status === 'rejected' && (
          <div className="widget row" style={{ margin: '12px var(--gutter) 0', background: 'var(--danger-soft)', gap: 12 }} role="status">
            <Icon name="bell" size={20} />
            <span className="small" style={{ fontWeight: 600 }}>No hemos podido aprobar tu negocio. Escríbenos desde "Contactar con NetWish" y lo vemos.</span>
          </div>
        )}
        <Outlet context={{ settings, reloadSettings, modules: mods }} />
      </main>
      <TabBar items={mobileNav} onMore={() => setMore(true)} moreActive={rest.some((n) => pathname.startsWith(n.to))} />
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
        <div className="widget" style={{ marginTop: 12, paddingTop: 4, paddingBottom: 4 }}>
          <PanelPrefs prefs={prefs} setPref={setPref} />
        </div>
      </Sheet>
    </div>
  );
}
