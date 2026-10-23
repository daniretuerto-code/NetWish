import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Mono } from './ui.jsx';
import { categoryOf } from '../lib/categories.js';
import { initials, toneFor } from '../lib/format.js';

export const bizPath = (b) => `/negocio/${encodeURIComponent(b.name)}`;

export function CoverCard({ biz, eyebrow, title, subtitle, cta = 'Ver', minHeight = 300 }) {
  return (
    <Link to={bizPath(biz)} className="cover" style={{ background: toneFor(biz.name), minHeight }}>
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
        <span className="grow stack" style={{ gap: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{biz.name}</span>
          <span style={{ fontSize: 13, opacity: 0.75 }}>{subtitle || biz.category}</span>
        </span>
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
