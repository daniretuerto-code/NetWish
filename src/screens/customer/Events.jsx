import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Skeleton } from '../../components/ui.jsx';
import useAsync from '../../hooks/useAsync.js';
import { cityEvents, directory } from '../../lib/data.js';
import { kindOf } from '../../lib/categories.js';
import { money, toneFor } from '../../lib/format.js';
import { downloadEventIcs, EVENT_CATEGORIES, eventCategory, eventWhen, inWhen, mergeEvents, WHEN_FILTERS } from '../../lib/events.js';

export async function loadEvents() {
  const [city, places] = await Promise.all([cityEvents(), directory()]);
  return mergeEvents(city, places);
}

// Where "Reservar" goes: a restaurant's booking sheet on the event's day, otherwise its page.
export function eventLink(e) {
  if (e.biz) {
    const books = kindOf(e.biz) === 'restaurant' && !e.biz.preview;
    return `/negocio/${encodeURIComponent(e.biz.name)}${books ? `?reservar=1&dia=${e.date}` : ''}`;
  }
  if (e.bizName) return `/negocio/${encodeURIComponent(e.bizName)}`;
  return null;
}

// netwish.es/eventos: what's on in Palencia, from the city and from its businesses.
export default function Events() {
  const [params, setParams] = useSearchParams();
  const when = params.get('cuando') || 'todo';
  const cat = params.get('tema') || '';
  const { data, loading } = useAsync(loadEvents, []);
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };
  const list = useMemo(() => (data || []).filter((e) => inWhen(e, when) && (!cat || e.category === cat)), [data, when, cat]);
  const used = new Set((data || []).map((e) => e.category));

  return (
    <div className="page">
      <div className="stack" style={{ gap: 2, padding: '0 4px' }}>
        <span className="eyebrow">Palencia</span>
        <h1 className="title-xl">Eventos</h1>
      </div>

      <div className="chips" role="tablist" aria-label="Cuándo">
        {WHEN_FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={when === f.key} className={`chip ${when === f.key ? 'on' : ''}`} onClick={() => set('cuando', f.key === 'todo' ? '' : f.key)}>{f.label}</button>
        ))}
      </div>
      <div className="chips" aria-label="Tema">
        {EVENT_CATEGORIES.filter((c) => used.has(c.key) || cat === c.key).map((c) => (
          <button key={c.key} className="chip" aria-pressed={cat === c.key} onClick={() => set('tema', cat === c.key ? '' : c.key)}
            style={cat === c.key ? { background: 'var(--accent)' } : undefined}>
            <Icon name={c.icon} size={16} /> {c.label}
          </button>
        ))}
      </div>

      {loading && !data && <Skeleton rows={4} />}
      {data && list.length === 0 && (
        <Empty icon="sparkle" title={data.length ? 'Nada con estos filtros' : 'Muy pronto, los planes de Palencia'}>
          {data.length ? 'Prueba con otra fecha o tema.' : 'Fiestas, conciertos, mercados y lo nuevo de los negocios de la ciudad.'}
        </Empty>
      )}
      <div className="events-grid">
        {list.map((e) => <EventCard key={e.id} e={e} />)}
      </div>
    </div>
  );
}

export function EventCard({ e }) {
  const c = eventCategory(e.category);
  const to = eventLink(e);
  return (
    <article className="widget event-card">
      <div className="event-cover" style={{ background: toneFor(e.title) }}>
        {e.image ? <img src={e.image} alt="" loading="lazy" /> : <Icon name={c.icon} size={34} />}
        <span className="demo-pill event-tag">{c.label}</span>
      </div>
      <div className="stack" style={{ gap: 4, padding: '14px 4px 2px' }}>
        <span className="small" style={{ fontWeight: 800 }}>{eventWhen(e)}</span>
        <h2 className="title-md" style={{ margin: 0 }}>{e.title}</h2>
        <span className="small muted">{[e.place, e.price > 0 ? money(e.price) : e.price === 0 ? 'Gratis' : null].filter(Boolean).join(' · ')}</span>
        {e.text && <p className="small" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{e.text}</p>}
      </div>
      <div className="row" style={{ gap: 8, padding: '10px 4px 2px', flexWrap: 'wrap' }}>
        {to && <Link className="btn primary sm" to={to}>{e.biz && kindOf(e.biz) === 'restaurant' && !e.biz.preview ? 'Reservar' : 'Ver sitio'}</Link>}
        {e.link && <a className="btn soft sm" href={e.link} target="_blank" rel="noreferrer">Más info</a>}
        <button className="btn soft sm" onClick={() => downloadEventIcs(e)}><Icon name="calendar" size={16} /> Al calendario</button>
      </div>
    </article>
  );
}
