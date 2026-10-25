import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Mono } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { kindOf } from '../lib/categories.js';

const CUSTOMER_NAV = [
  { to: '/', label: 'Hoy', icon: 'today', end: true },
  { to: '/explorar', label: 'Explorar', icon: 'compass' },
  { to: '/escanear', label: 'Escanear', icon: 'scan' },
  { to: '/pedidos', label: 'Pedidos', icon: 'bag' },
  { to: '/cuenta', label: 'Cuenta', icon: 'person' },
];

const DETAIL_ROUTES = ['/negocio/', '/pagar/', '/mesa/', '/chat/'];

function Brand() {
  return (
    <NavLink to="/" className="brand">
      <svg className="mono" viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="116" fill="var(--accent)" />
        <g transform="translate(-7 23)" fill="var(--ink)" stroke="var(--ink)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M149 352V160L333 352V264" fill="none" strokeWidth="64" />
          <path d="M333 82Q341 132 395 140Q341 148 333 198Q325 148 271 140Q325 132 333 82Z" strokeWidth="8" />
        </g>
      </svg>
      <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>NetWish</span>
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
  const { business, setMode } = useAuth();
  const isDetail = DETAIL_ROUTES.some((r) => pathname.startsWith(r));
  return (
    <div className="shell">
      <SideNav
        items={CUSTOMER_NAV}
        header={<Brand />}
        footer={business ? (
          <NavLink to="/panel" onClick={() => setMode('business')} className="btn accent block">Ir a mi negocio</NavLink>
        ) : null}
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
  const isRestaurant = kindOf(business) === 'restaurant';
  const nav = [
    { to: '/panel', label: 'Resumen', icon: 'chart', end: true },
    { to: '/panel/pedidos', label: 'Pedidos', icon: 'bag' },
    ...(isRestaurant ? [{ to: '/panel/cocina', label: 'Cocina', icon: 'flame' }] : []),
    { to: '/panel/carta', label: isRestaurant ? 'Carta y stock' : 'Catálogo', icon: 'book' },
    ...(isRestaurant ? [{ to: '/panel/mesas', label: 'Mesas y QR', icon: 'grid' }] : []),
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
              <span className="small" style={{ color: 'var(--accent)' }}>● Recibiendo pedidos</span>
            </span>
          </div>
        )}
      />
      <main className="shell-main">
        <Outlet />
      </main>
      <TabBar items={mobileNav} />
    </div>
  );
}
