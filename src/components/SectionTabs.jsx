import { NavLink, useLocation, useOutletContext } from 'react-router-dom';
import { isUnseen, sectionOf } from '../lib/panelNav.js';

// The pages of the current section (Clientes · Mensajes · Campañas…), under the page title.
export default function SectionTabs() {
  const { pathname } = useLocation();
  const { sections } = useOutletContext() || {};
  const section = sections && sectionOf(sections, pathname);
  if (!section || section.tabs.length < 2) return null;
  return (
    <nav className="subnav" aria-label={section.label}>
      {section.tabs.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          {t.label}
          {t.isNew && !pathname.startsWith(t.to) && isUnseen(t.to) && <span className="new-dot" aria-label="Nuevo" />}
        </NavLink>
      ))}
    </nav>
  );
}
