import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Spinner } from '../../components/ui.jsx';
import { CoverCard } from '../../components/BusinessCards.jsx';
import useAsync from '../../hooks/useAsync.js';
import { listBusinesses } from '../../lib/data.js';
import { CATEGORIES, categoryOf, kindOf } from '../../lib/categories.js';
import { normalize } from '../../lib/format.js';

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat') || '';
  const [query, setQuery] = useState(() => params.get('q') || '');
  const { data, loading } = useAsync(() => listBusinesses(), []);

  const results = useMemo(() => {
    const q = normalize(query);
    return (data || []).filter((b) => {
      if (cat && categoryOf(b).key !== cat) return false;
      if (!q) return true;
      return normalize(`${b.name} ${b.category}`).includes(q);
    });
  }, [data, cat, query]);

  return (
    <div className="page">
      <div className="stack" style={{ gap: 2, padding: '0 4px' }}>
        <span className="eyebrow">Palencia</span>
        <h1 className="title-xl">Explorar</h1>
      </div>

      <label className="search">
        <Icon name="search" size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar comercios" aria-label="Buscar comercios" type="search" />
      </label>

      <div className="chips" role="tablist" aria-label="Categorías">
        <button role="tab" aria-selected={!cat} className={`chip ${!cat ? 'on' : ''}`} onClick={() => setParams({})}>Todo</button>
        {CATEGORIES.map((c) => (
          <button key={c.key} role="tab" aria-selected={cat === c.key} className={`chip ${cat === c.key ? 'on' : ''}`} onClick={() => setParams({ cat: c.key })}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : results.length === 0 ? (
        <Empty icon="search" title="Sin resultados">Prueba con otra categoría o búsqueda.</Empty>
      ) : (
        <div className="cards-grid">
          {results.map((b) => (
            <CoverCard
              key={b.username || b.name}
              biz={b}
              minHeight={220}
              title={b.name}
              eyebrow={categoryOf(b).label}
              subtitle={kindOf(b) === 'restaurant' ? 'Carta, reservas y pedidos en mesa' : kindOf(b) === 'music' ? 'Escucha y compra al momento' : 'Pide y paga desde el móvil'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
