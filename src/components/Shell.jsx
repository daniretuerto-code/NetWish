import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Mono } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { kindOf } from '../lib/categories.js';
import useAsync from '../hooks/useAsync.js';
import { getRestaurantSettings } from '../lib/data.js';
import { modulesFor } from '../lib/questionnaire.js';

const CUSTOMER_NAV = [
  { to: '/', label: 'Hoy', icon: 'today', end: true },
  { to: '/explorar', label: 'Explorar', icon: 'compass' },
  { to: '/escanear', label: 'Escanear', icon: 'scan' },
  { to: '/reservas', label: 'Reservas', icon: 'calendar' },
  { to: '/cuenta', label: 'Cuenta', icon: 'person' },
];

const DETAIL_ROUTES = ['/negocio/', '/mesa/', '/chat/'];

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

function TabBar({ items }) {
  return (
    <nav className="tabbar" aria-label="Pestañas">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} aria-label={it.label} className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name={it.icon} size={21} />
          <span className="tab-label">{it.label}</span>
        </NavLink>
      ))}
    </nav>
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

export function BusinessShell() {
  const { business } = useAuth();
  const kind = kindOf(business);
  const isRestaurant = kind === 'restaurant';
  const isBeauty = kind === 'beauty';
  // Panel sections follow the business's questionnaire answers.
  const { data: settings, reload: reloadSettings } = useAsync(() => getRestaurantSettings(business.name, kind), [business.name, kind]);
  const mods = modulesFor(settings?.profile);
  const nav = [
    { to: '/panel', label: 'Resumen', icon: 'chart', end: true },
    ...(!isRestaurant || mods.reservas || mods.pedidosQr ? [{ to: '/panel/pedidos', label: isRestaurant ? (mods.reservas ? 'Reservas y mesas' : 'Comandas') : 'Reservas', icon: 'calendar' }] : []),
    ...(isRestaurant && mods.cocina ? [{ to: '/panel/cocina', label: 'Cocina', icon: 'flame' }] : []),
    { to: '/panel/carta', label: isRestaurant ? 'Carta' : isBeauty ? 'Servicios' : 'Catálogo', icon: isBeauty ? 'scissors' : 'book' },
    ...(isRestaurant && (mods.reservas || mods.pedidosQr) ? [{ to: '/panel/mesas', label: 'Mesas y QR', icon: 'grid' }] : []),
    ...(isRestaurant ? [{ to: '/panel/personalizar', label: 'Personalizar', icon: 'gear' }] : []),
    ...(isBeauty ? [{ to: '/panel/horario', label: 'Horario y equipo', icon: 'calendar' }] : []),
    { to: '/panel/mensajes', label: 'Mensajes', icon: 'chat' },
    { to: '/panel/ajustes', label: 'Ajustes', icon: 'gear' },
  ];
  const mobileNav = nav.filter((n) => ['/panel', '/panel/pedidos', '/panel/carta', '/panel/mensajes', '/panel/ajustes'].includes(n.to));
  return (
    <div className="shell">
      <SideNav
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
            <span className="small" style={{ fontWeight: 600 }}>Estamos revisando tu alta. Mientras, prepara tu panel: tu página será pública en cuanto la aprobemos.</span>
          </div>
        )}
        {business.status === 'rejected' && (
          <div className="widget row" style={{ margin: '12px var(--gutter) 0', background: '#F3C9C9', gap: 12 }} role="status">
            <Icon name="bell" size={20} />
            <span className="small" style={{ fontWeight: 600 }}>No hemos podido aprobar tu negocio. Escríbenos desde "Contactar con NetWish" y lo vemos.</span>
          </div>
        )}
        <Outlet context={{ settings, reloadSettings, modules: mods }} />
      </main>
      <TabBar items={mobileNav} />
    </div>
  );
}
