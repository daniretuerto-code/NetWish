import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Spinner } from '../../components/ui.jsx';
import { CoverCard, PlaceInfo, placeSummary } from '../../components/BusinessCards.jsx';
import useAsync from '../../hooks/useAsync.js';
import { directory, dishIndex } from '../../lib/data.js';
import { CATEGORIES, categoryOf } from '../../lib/categories.js';
import { normalize } from '../../lib/format.js';

// Quick filters for places to eat.
const FILTERS = [
  { key: 'abierto', label: 'Abierto ahora' },
  { key: 'reserva', label: 'Reserva online' },
  { key: 'menu', label: 'Menú del día' },
  { key: 'terraza', label: 'Terraza' },
];

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat') || '';
  const [query, setQuery] = useState(() => params.get('q') || '');
  const [filters, setFilters] = useState([]);
  const [dishes, setDishes] = useState(null);
  const { data, loading } = useAsync(() => directory(), []);

  // Dishes load only once someone searches: "lechazo" finds the restaurant that has it.
  useEffect(() => {
    if (query.trim().length >= 3 && !dishes) dishIndex().then(setDishes).catch(() => setDishes(new Map()));
  }, [query, dishes]);

  const results = useMemo(() => {
    const q = normalize(query);
    return (data || []).map((r) => ({ ...r, sum: placeSummary(r.biz, r.settings) })).filter(({ biz, sum }) => {
      if (cat && categoryOf(biz).key !== cat) return false;
      if (filters.some((f) => !sum.tags.includes(f))) return false;
      if (!q) return true;
      return normalize(`${biz.name} ${biz.category} ${sum.line} ${biz.address || ''} ${dishes?.get(normalize(biz.name)) || ''}`).includes(q);
    // Open places first, then the rest as they came.
    }).sort((a, b) => Number(!!b.sum.state?.open) - Number(!!a.sum.state?.open));
  }, [data, cat, query, filters, dishes]);

  const toggle = (key) => setFilters((f) => (f.includes(key) ? f.filter((x) => x !== key) : [...f, key]));
  const showFilters = !cat || cat === 'rest';

  return (
    <div className="page">
      <div className="stack" style={{ gap: 2, padding: '0 4px' }}>
        <span className="eyebrow">Palencia</span>
        <h1 className="title-xl">Explorar</h1>
      </div>

      <label className="search">
        <Icon name="search" size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Restaurantes, platos, comercios…" aria-label="Buscar" type="search" />
      </label>

      <div className="chips" role="tablist" aria-label="Categorías">
        <button role="tab" aria-selected={!cat} className={`chip ${!cat ? 'on' : ''}`} onClick={() => setParams({})}>Todo</button>
        {CATEGORIES.filter((c) => !c.hidden || (data || []).some((r) => categoryOf(r.biz).key === c.key)).map((c) => (
          <button key={c.key} role="tab" aria-selected={cat === c.key} className={`chip ${cat === c.key ? 'on' : ''}`} onClick={() => setParams({ cat: c.key })}>
            {c.label}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="chips" aria-label="Filtros">
          {FILTERS.map((f) => {
            const on = filters.includes(f.key);
            return (
              <button key={f.key} className="chip" aria-pressed={on} onClick={() => toggle(f.key)}
                style={{ height: 34, fontSize: 13.5, background: on ? 'var(--accent)' : 'transparent', boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--line)' }}>
                {on && <Icon name="check" size={14} stroke={3} />}{f.label}
              </button>
            );
          })}
        </div>
      )}

      {loading ? <Spinner /> : results.length === 0 ? (
        <Empty icon="search" title="Sin resultados">{filters.length ? 'Quita algún filtro para ver más sitios.' : 'Prueba con otra categoría o búsqueda.'}</Empty>
      ) : (
        <div className="cards-grid">
          {results.map(({ biz, sum }) => (
            <CoverCard
              key={biz.username || biz.name}
              biz={biz}
              compact
              eyebrow={categoryOf(biz).label}
              info={<PlaceInfo state={sum.state} line={sum.line} />}
            />
          ))}
        </div>
      )}
    </div>
  );
}
