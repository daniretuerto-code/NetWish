// The panel's sections. A restaurant gets five, the same on the phone and on the computer;
// each one groups its pages, which show as tabs under the title.
export function panelSections(kind, mods) {
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
  const beauty = kind === 'beauty';
  const flat = (key, label, icon, to, extra = {}) => ({ key, label, icon, to, tabs: [], ...extra });
  return [
    flat('hoy', 'Resumen', 'chart', '/panel', { end: true }),
    flat('servicio', 'Reservas', 'calendar', '/panel/reservas', { alerts: true }),
    flat('carta', beauty ? 'Servicios' : 'Catálogo', beauty ? 'scissors' : 'book', '/panel/carta'),
    ...(beauty ? [flat('horario', 'Horario y equipo', 'calendar', '/panel/horario')] : []),
    flat('mensajes', 'Mensajes', 'chat', '/panel/mensajes'),
    flat('ajustes', 'Ajustes', 'gear', '/panel/ajustes'),
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
