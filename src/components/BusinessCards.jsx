import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Mono } from './ui.jsx';
import { categoryOf, kindOf, taglineFor } from '../lib/categories.js';
import { initials, money, todayISO, toneFor } from '../lib/format.js';
import { openState } from '../lib/hours.js';
import { isClosed } from '../lib/booking.js';
import { modulesFor, publicFacts } from '../lib/questionnaire.js';

export const bizPath = (b) => `/negocio/${encodeURIComponent(b.name)}`;

// `info` replaces the name strip with what matters at a glance (open now, menu price); `to` points the card elsewhere.
export function CoverCard({ biz, eyebrow, title, subtitle, cta = 'Ver', minHeight = 300, featured = false, compact = false, info, to }) {
  return (
    <Link to={to || bizPath(biz)} className={`cover${featured ? ' featured' : ''}${compact ? ' compact' : ''}`} style={{ background: toneFor(biz.name), '--cover-min': `${minHeight}px` }}>
      {biz.cover_url ? (
        <>
          <img className="cover-img" src={biz.cover_url} alt="" />
          <span className="cover-shade" />
        </>
      ) : (
        <span className="ghost" aria-hidden="true">{initials(biz.name)}</span>
      )}
      <span className="cover-top">
        <span className="eyebrow">{eyebrow || categoryOf(biz).label}</span>
        <span className="cover-title">{title || biz.name}</span>
      </span>
      <span className="cover-strip">
        {info ? <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>{info}</span> : (
          <span className="grow stack" style={{ gap: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{biz.name}</span>
            <span style={{ fontSize: 13, opacity: 0.75 }}>{subtitle || biz.category}</span>
          </span>
        )}
        <span className="btn sm" style={{ background: '#fff' }}>{cta}</span>
      </span>
    </Link>
  );
}

export function BusinessRow({ biz, right }) {
  return (
    <Link to={bizPath(biz)} className="list-row">
      <Mono name={biz.name} image={biz.image} />
      <span className="grow stack" style={{ gap: 0 }}>
        <span className="t">{biz.name}</span>
        <span className="s">{categoryOf(biz).label}{biz.category ? ` · ${biz.category}` : ''}</span>
      </span>
      {right || <Icon name="chevron" size={18} style={{ color: 'var(--muted)' }} />}
    </Link>
  );
}

// "● Abierto · cierra a las 16:00" and "Menú del día 14,50 € · Asador" for a restaurant's card.
export function PlaceInfo({ state, line }) {
  return (
    <>
      {state && <span className="cover-info"><span className={`dot${state.open ? '' : ' closed'}`} />{state.label}</span>}
      {line && <span className="cover-info" style={{ opacity: 0.8, fontWeight: 500 }}>{line}</span>}
    </>
  );
}

// What a listing shows for a business: open state, one useful line, and which quick filters it matches.
export function placeSummary(biz, settings) {
  const kind = kindOf(biz);
  const profile = settings?.profile || {};
  const state = settings && (kind === 'restaurant' || kind === 'beauty') ? openState(settings) : null;
  if (kind !== 'restaurant') return { state, line: taglineFor(biz), tags: [] };
  const mods = modulesFor(profile);
  const menu = settings?.daily_menu;
  const menuToday = !!(mods.menuDia && menu && menu.active !== false && menu.first_courses?.length && !isClosed(settings, todayISO()));
  const headline = publicFacts(profile).headline;
  const line = [menuToday && `Menú del día${Number(menu.price) > 0 ? ` ${money(menu.price)}` : ''}`, headline || 'Carta y reserva de mesa'].filter(Boolean).join(' · ');
  const terrace = profile.terraza === true || (settings?.tables || []).some((t) => /terraza|patio|jard/i.test(t.zone || ''));
  const tags = [state?.open && 'abierto', settings && mods.reservas && 'reserva', menuToday && 'menu', terrace && 'terraza'].filter(Boolean);
  return { state, line, tags, canBook: !!settings && mods.reservas };
}
