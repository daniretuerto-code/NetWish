// The panel's sections. A restaurant gets five, the same on the phone and on the computer;
// each one groups its pages, which show as tabs under the title. Other businesses get theirs by engine.
export function panelSections(kind, mods, type) {
  if (kind === 'restaurant') {
    const service = [
      mods.reservas && { to: '/panel/reservas', label: 'Reservas' },
      mods.pedidosQr && { to: '/panel/comandas', label: 'Comandas' },
      mods.cocina && { to: '/panel/cocina', label: 'Cocina' },
    ].filter(Boolean);
    return [
      { key: 'hoy', label: 'Hoy', icon: 'today', to: '/panel', end: true, tabs: [] },
      ...(service.length ? [{ key: 'servicio', label: service[0].label, icon: 'calendar', to: service[0].to, tabs: service, alerts: true }] : []),
      {
        key: 'clientes', label: 'Clientes', icon: 'users', to: '/panel/clientes', isNew: true,
        tabs: [
          { to: '/panel/clientes', label: 'Clientes' },
          { to: '/panel/mensajes', label: 'Mensajes' },
          ...(mods.reservas ? [{ to: '/panel/campanas', label: 'Campañas' }] : []),
          { to: '/panel/numeros', label: 'Números', isNew: true },
        ],
      },
      {
        key: 'local', label: 'Tu restaurante', short: 'Restaurante', icon: 'store', to: '/panel/carta', isNew: true,
        tabs: [
          { to: '/panel/carta', label: 'Carta' },
          { to: '/panel/eventos', label: 'Eventos' },
          { to: '/panel/compartir', label: 'Compartir', isNew: true },
        ],
      },
      { key: 'ajustes', label: 'Ajustes', icon: 'gear', to: '/panel/ajustes', tabs: [], match: ['/panel/mesas', '/panel/personalizar', '/panel/empezar'] },
    ];
  }
  const flat = (key, label, icon, to, extra = {}) => ({ key, label, icon, to, tabs: [], ...extra });
  const clients = { key: 'clientes', label: 'Clientes', icon: 'users', to: '/panel/clientes', tabs: [{ to: '/panel/clientes', label: 'Clientes' }, { to: '/panel/mensajes', label: 'Mensajes' }] };
  const settings = flat('ajustes', 'Ajustes', 'gear', '/panel/ajustes', { match: ['/panel/personalizar', '/panel/empezar', '/panel/horario'] });
  if (kind === 'shop') {
    const catalog = [{ to: '/panel/carta', label: 'Productos' }, ...(type?.shop?.daily ? [{ to: '/panel/stock', label: 'Mostrador de hoy', isNew: true }] : [])];
    return [
      flat('hoy', 'Hoy', 'today', '/panel', { end: true }),
      flat('servicio', 'Pedidos', 'bag', '/panel/reservas', { alerts: true }),
      { key: 'carta', label: type?.shop?.noun || 'Catálogo', short: 'Catálogo', icon: 'tag', to: '/panel/carta', tabs: catalog.length > 1 ? catalog : [] },
      clients,
      settings,
    ];
  }
  if (kind === 'classes') {
    return [
      flat('hoy', 'Hoy', 'today', '/panel', { end: true }),
      flat('servicio', 'Reservas', 'calendar', '/panel/reservas', { alerts: true }),
      { key: 'clases', label: 'Clases', icon: 'dumbbell', to: '/panel/clases', tabs: [{ to: '/panel/clases', label: 'Horario' }, { to: '/panel/carta', label: 'Tarifas' }] },
      clients,
      settings,
    ];
  }
  if (kind === 'taxi') {
    return [
      flat('hoy', 'Hoy', 'today', '/panel', { end: true }),
      flat('servicio', 'Viajes', 'taxi', '/panel/reservas', { alerts: true }),
      flat('carta', 'Precios', 'tag', '/panel/carta'),
      clients,
      settings,
    ];
  }
  const beauty = kind === 'beauty';
  const nouns = type?.noun || { list: 'Servicios' };
  return [
    flat('hoy', beauty ? 'Hoy' : 'Resumen', beauty ? 'today' : 'chart', '/panel', { end: true }),
    flat('servicio', beauty ? 'Citas' : 'Reservas', 'calendar', '/panel/reservas', { alerts: true }),
    flat('carta', beauty ? nouns.list : 'Catálogo', beauty ? type?.icon || 'scissors' : 'book', '/panel/carta', beauty ? { short: 'Servicios' } : {}),
    ...(beauty ? [flat('horario', 'Horario y equipo', 'clock', '/panel/horario', { short: 'Horario' })] : []),
    clients,
    { ...settings, match: ['/panel/personalizar', '/panel/empezar'] },
  ];
}

const under = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);

export function sectionOf(sections, pathname) {
  return sections.find((s) => (s.end ? pathname === s.to : under(pathname, s.to)
    || s.tabs.some((t) => under(pathname, t.to)) || (s.match || []).some((m) => under(pathname, m))));
}

// A lime dot marks a section or tab the first time it shows up; it goes once it is opened.
const SEEN = 'netwish.seen';
const readSeen = () => {
  try { return JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch { return []; }
};
export const isUnseen = (id) => !readSeen().includes(id);
export function markSeen(...ids) {
  const seen = readSeen();
  const next = [...new Set([...seen, ...ids])];
  if (next.length === seen.length) return;
  try { localStorage.setItem(SEEN, JSON.stringify(next)); } catch { /* storage unavailable */ }
}
