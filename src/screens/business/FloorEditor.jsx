import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import FloorPlan from '../../components/FloorPlan.jsx';
import { Sheet } from '../../components/ui.jsx';
import { tableMin } from '../../lib/agenda.js';
import { DECOR, MAIN_ZONE, SHAPES, TABLE_PRESETS, TEMPLATES, tableSize, zoneHeight, zoneOf } from '../../lib/floor.js';

const newId = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ROW = { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const small = { height: 40, width: 58, padding: '0 4px', textAlign: 'center', fontWeight: 800 };

function Stepper({ label, value, onChange, min = 0.3, max = 40, step = 1 }) {
  return (
    <span style={ROW}>
      <span className="small muted" style={{ fontWeight: 600 }}>{label}</span>
      <button type="button" className="icon-btn" style={{ width: 36, height: 36, background: 'var(--bg)' }} onClick={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))} aria-label={`Menos ${label}`}><Icon name="minus" size={16} /></button>
      <strong style={{ minWidth: 26, textAlign: 'center' }}>{value}</strong>
      <button type="button" className="icon-btn" style={{ width: 36, height: 36, background: 'var(--bg)' }} onClick={() => onChange(Math.min(max, Math.round((value + step) * 10) / 10))} aria-label={`Más ${label}`}><Icon name="plus" size={16} /></button>
    </span>
  );
}

// The owner draws the room: zones (Sala, Terraza…), tables dragged into place, and walls, bar, doors…
// `tables` come already placed; changes go up through onChange({ tables, zones, items }).
export default function FloorEditor({ tables, zones, items, onChange, onQr }) {
  const [zoneName, setZoneName] = useState(zones[0]?.name || MAIN_ZONE);
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 600 ? 1.5 : 1));
  const [templates, setTemplates] = useState(false);
  const [adding, setAdding] = useState(null); // 'table' | 'decor' | null
  const [draft, setDraft] = useState(null);
  const zone = zones.find((z) => z.name === zoneName) || zones[0];
  const height = zoneHeight(zone, tables, items);
  const zoneTables = tables.filter((t) => zoneOf(t) === zone.name);

  const set = (patch) => onChange({ tables, zones, items, ...patch });
  const setZone = (patch) => {
    if (patch.name !== undefined && patch.name !== zone.name) {
      const name = patch.name;
      set({
        zones: zones.map((z) => (z.name === zone.name ? { ...z, ...patch } : z)),
        tables: tables.map((t) => (zoneOf(t) === zone.name ? { ...t, zone: name } : t)),
        items: items.map((i) => (i.zone === zone.name ? { ...i, zone: name } : i)),
      });
      setZoneName(name);
      return;
    }
    set({ zones: zones.map((z) => (z.name === zone.name ? { ...z, ...patch } : z)) });
  };

  const nextNumber = (list = tables) => list.reduce((m, t) => Math.max(m, Number(t.table_number) || 0), 0) + 1;
  // A free spot near the top left of the visible plan.
  const freeSpot = (w, h) => {
    const boxes = [
      ...zoneTables.map((t) => ({ x: t.x, y: t.y, ...tableSize(t) })),
      ...items.filter((i) => i.zone === zone.name).map((i) => ({ x: i.x, y: i.y, w: i.w, h: i.h })),
    ];
    for (let y = 1; y < height + 20; y += 1) {
      for (let x = 1; x + w <= zone.w; x += 1) {
        if (!boxes.some((o) => x < o.x + o.w && o.x < x + w && y < o.y + o.h && o.y < y + h)) return { x, y };
      }
    }
    return { x: 0, y: height };
  };

  const addTable = (preset) => {
    const n = nextNumber();
    const t = { id: n, table_number: n, capacity: preset.capacity, shape: preset.shape, zone: zone.name, min: Math.max(1, preset.capacity - 2) };
    const s = tableSize(t);
    set({ tables: [...tables, { ...t, ...freeSpot(s.w, s.h) }] });
    setSelected({ kind: 'table', key: n });
    setAdding(null);
  };
  const addDecor = (type) => {
    const d = DECOR[type];
    const item = { id: newId(), type, zone: zone.name, w: d.w, h: d.h, ...freeSpot(Math.ceil(d.w), Math.ceil(d.h)) };
    set({ items: [...items, item] });
    setSelected({ kind: 'item', key: item.id });
    setAdding(null);
  };

  const move = (kind, key, x, y) => {
    if (kind === 'table') set({ tables: tables.map((t) => (String(t.table_number) === String(key) ? { ...t, x, y } : t)) });
    else set({ items: items.map((i) => (i.id === key ? { ...i, x, y } : i)) });
  };

  const table = selected?.kind === 'table' && tables.find((t) => String(t.table_number) === String(selected.key));
  const item = selected?.kind === 'item' && items.find((i) => i.id === selected.key);
  const setTable = (patch) => {
    set({ tables: tables.map((t) => (t === table ? { ...t, ...patch } : t)) });
    if (patch.table_number !== undefined) setSelected({ kind: 'table', key: patch.table_number });
  };
  const setItem = (patch) => set({ items: items.map((i) => (i === item ? { ...i, ...patch } : i)) });

  const removeTable = () => {
    const n = Number(table.table_number);
    set({ tables: tables.filter((t) => t !== table).map((t) => ({ ...t, join: (t.join || []).filter((j) => Number(j) !== n) })) });
    setSelected(null);
  };
  const duplicateTable = () => {
    const n = nextNumber();
    const s = tableSize(table);
    set({ tables: [...tables, { ...table, id: n, table_number: n, join: [], ...freeSpot(s.w, s.h) }] });
    setSelected({ kind: 'table', key: n });
  };
  const toggleJoin = (other) => {
    const n = Number(other.table_number);
    const mine = (table.join || []).map(Number);
    const on = mine.includes(n) || (other.join || []).map(Number).includes(Number(table.table_number));
    set({
      tables: tables.map((t) => {
        if (t === table) return { ...t, join: on ? mine.filter((j) => j !== n) : [...mine, n] };
        if (t === other) return { ...t, join: (t.join || []).filter((j) => Number(j) !== Number(table.table_number)) };
        return t;
      }),
    });
  };

  const addZone = (outdoor) => {
    const base = outdoor ? 'Terraza' : 'Sala';
    let name = base;
    for (let i = 2; zones.some((z) => z.name === name); i += 1) name = `${base} ${i}`;
    set({ zones: [...zones, { name, outdoor, open: true, from: '', to: '', w: 16, h: 12 }] });
    setZoneName(name);
    setSelected(null);
  };
  const removeZone = () => {
    set({ zones: zones.filter((z) => z.name !== zone.name), items: items.filter((i) => i.zone !== zone.name) });
    setZoneName(zones.find((z) => z.name !== zone.name)?.name || MAIN_ZONE);
  };

  const applyTemplate = (tpl) => {
    const built = tpl.build(zone);
    const reuse = zoneTables.map((t) => Number(t.table_number)).sort((a, b) => a - b);
    const others = tables.filter((t) => zoneOf(t) !== zone.name);
    let next = nextNumber();
    const made = built.tables.map((t) => {
      const n = reuse.length ? reuse.shift() : next++;
      return { id: n, table_number: n, zone: zone.name, min: Math.max(1, t.capacity - 2), ...t };
    });
    if (built.joinRows) {
      for (const t of made) {
        t.join = made.filter((o) => o !== t && o.y === t.y && Math.abs(o.x - t.x) === 4).map((o) => o.table_number);
      }
    }
    set({
      tables: [...others, ...made],
      items: [...items.filter((i) => i.zone !== zone.name), ...built.items.map((i) => ({ ...i, id: newId(), zone: zone.name }))],
    });
    setSelected(null);
    setTemplates(false);
  };

  return (
    <div className="stack">
      <div className="chips">
        {zones.map((z) => (
          <button key={z.name} className={`chip ${z.name === zone.name ? 'on' : ''}`} onClick={() => { setZoneName(z.name); setSelected(null); setDraft(null); }}>
            {z.outdoor ? '☀︎ ' : ''}{z.name}{z.outdoor && z.open === false ? ' · cerrada' : ''}
          </button>
        ))}
        <button className="chip" style={{ background: 'var(--bg)' }} onClick={() => addZone(false)}>+ Sala</button>
        {!zones.some((z) => z.outdoor) && <button className="chip" style={{ background: 'var(--accent)' }} onClick={() => addZone(true)}>+ Terraza</button>}
      </div>

      <div className="widget stack" style={{ gap: 10 }}>
        <div style={ROW}>
          <input className="input grow" aria-label="Nombre de la zona" style={{ height: 40, fontWeight: 700, minWidth: 140 }} value={draft ?? zone.name} maxLength={30}
            onChange={(e) => setDraft(e.target.value.replace(/[()]/g, ''))}
            onBlur={() => {
              const name = (draft ?? '').trim();
              if (name && !zones.some((z) => z.name === name)) setZone({ name });
              setDraft(null);
            }} />
          <label className="row small" style={{ gap: 6, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!zone.outdoor} onChange={(e) => setZone({ outdoor: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--ink)' }} />
            Al aire libre
          </label>
        </div>
        {zone.outdoor && (
          <>
            <div style={ROW}>
              <button className="pill" onClick={() => setZone({ open: zone.open === false })} aria-pressed={zone.open !== false}
                style={{ height: 36, background: zone.open === false ? '#F3C9C9' : 'var(--accent)', color: zone.open === false ? '#8E2B2B' : 'var(--ink)' }}>
                {zone.open === false ? 'Cerrada: no se reserva' : 'Abierta a reservas'}
              </button>
              <span className="small muted">Ciérrala en invierno o si llueve.</span>
            </div>
            <div style={ROW}>
              <span className="small muted" style={{ fontWeight: 600 }}>Horario propio</span>
              <input className="input" type="time" aria-label="Terraza desde" style={{ height: 40, width: 128 }} value={zone.from || ''} onChange={(e) => setZone({ from: e.target.value })} />
              <span className="small muted">a</span>
              <input className="input" type="time" aria-label="Terraza hasta" style={{ height: 40, width: 128 }} value={zone.to || ''} onChange={(e) => setZone({ to: e.target.value })} />
              {(zone.from || zone.to) && <button className="btn soft sm" onClick={() => setZone({ from: '', to: '' })}>Quitar</button>}
            </div>
          </>
        )}
        <div style={ROW}>
          <Stepper label="Ancho" value={zone.w} min={8} max={40} onChange={(w) => setZone({ w })} />
          <Stepper label="Fondo" value={zone.h} min={6} max={40} onChange={(h) => setZone({ h })} />
          {zones.length > 1 && (zoneTables.length
            ? <span className="small muted">Para borrar la zona, quita o mueve antes sus mesas.</span>
            : <button className="btn soft sm" onClick={removeZone}><Icon name="trash" size={15} /> Borrar zona</button>)}
        </div>
      </div>

      <div style={ROW}>
        <button className={`btn sm ${adding === 'table' ? 'primary' : 'soft'}`} onClick={() => setAdding(adding === 'table' ? null : 'table')}><Icon name="plus" size={15} /> Mesa</button>
        <button className={`btn sm ${adding === 'decor' ? 'primary' : 'soft'}`} onClick={() => setAdding(adding === 'decor' ? null : 'decor')}><Icon name="plus" size={15} /> Pared, barra…</button>
        <button className="btn soft sm" onClick={() => setTemplates(true)}>Plantillas</button>
        <span className="grow" />
        <button className="icon-btn" style={{ width: 36, height: 36 }} disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Alejar"><Icon name="minus" size={16} /></button>
        <button className="icon-btn" style={{ width: 36, height: 36 }} disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + 0.5))} aria-label="Acercar"><Icon name="plus" size={16} /></button>
      </div>
      {adding === 'table' && (
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {TABLE_PRESETS.map((p) => <button key={p.label} className="chip" style={{ height: 36 }} onClick={() => addTable(p)}>{p.label}</button>)}
        </div>
      )}
      {adding === 'decor' && (
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {Object.entries(DECOR).map(([k, d]) => (
            <button key={k} className="chip" style={{ height: 36 }} onClick={() => addDecor(k)}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: d.round ? 5 : 2, background: d.fill, marginRight: 6, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' }} />{d.label}
            </button>
          ))}
        </div>
      )}

      <FloorPlan zone={zone} height={height + 2} tables={tables} items={items} editable selected={selected} onSelect={setSelected} onMove={move} zoom={zoom}
        look={(t) => (String(t.table_number) === String(selected?.key) && selected?.kind === 'table' ? { fill: 'var(--accent)' } : { label: `${tableMin(t)}-${t.capacity}` })} />
      <p className="small muted" style={{ margin: '0 4px' }}>Arrastra las mesas y las piezas. Toca una para cambiarla. Las sillas se ponen solas según las plazas.</p>

      {table && (
        <div className="widget stack" style={{ gap: 12 }}>
          <div className="row between">
            <span style={ROW}>
              <span className="small muted">Mesa</span>
              <input className="input" aria-label="Número de mesa" style={{ ...small, width: 64, fontSize: 18 }} inputMode="numeric" value={table.table_number}
                onChange={(e) => setTable({ table_number: e.target.value.replace(/\D/g, '') })} />
            </span>
            <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => setSelected(null)} aria-label="Cerrar"><Icon name="close" size={18} /></button>
          </div>
          <div style={ROW}>
            <span className="small muted" style={{ fontWeight: 600 }}>Personas: de</span>
            <input className="input" style={small} type="number" min={1} max={table.capacity} aria-label="Mínimo de personas" value={table.min ?? tableMin(table)} onChange={(e) => setTable({ min: e.target.value })} />
            <span className="small muted">a</span>
            <input className="input" style={small} type="number" min={1} max={30} aria-label="Máximo de personas" value={table.capacity} onChange={(e) => setTable({ capacity: e.target.value })} />
          </div>
          <div className="segmented" role="tablist" aria-label="Forma">
            {SHAPES.map((s) => (
              <button key={s.id} role="tab" aria-selected={tableSize(table).shape === s.id} onClick={() => setTable({ shape: s.id })} style={{ background: tableSize(table).shape === s.id ? undefined : 'var(--bg)' }}>{s.label}</button>
            ))}
          </div>
          <label className="row small" style={{ gap: 8, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={table.online !== false} onChange={(e) => setTable({ online: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--ink)' }} />
            Se puede reservar online
          </label>
          {zones.length > 1 && (
            <div style={ROW}>
              <span className="small muted" style={{ fontWeight: 600 }}>Zona</span>
              <select className="input" style={{ height: 40, width: 'auto' }} value={zoneOf(table)} onChange={(e) => { setTable({ zone: e.target.value, x: undefined, y: undefined, join: [] }); setZoneName(e.target.value); }}>
                {zones.map((z) => <option key={z.name}>{z.name}</option>)}
              </select>
            </div>
          )}
          {zoneTables.length > 1 && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="small muted" style={{ fontWeight: 600 }}>Se puede juntar con (para grupos grandes)</span>
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {zoneTables.filter((o) => o !== table).map((o) => {
                  const on = (table.join || []).map(Number).includes(Number(o.table_number)) || (o.join || []).map(Number).includes(Number(table.table_number));
                  return <button key={o.table_number} className={`chip ${on ? 'on' : ''}`} style={{ height: 36, background: on ? undefined : 'var(--bg)' }} aria-pressed={on} onClick={() => toggleJoin(o)}>Mesa {o.table_number} ({o.capacity})</button>;
                })}
              </div>
            </div>
          )}
          <div style={ROW}>
            {tableSize(table).shape !== 'round' && <button className="btn soft sm" onClick={() => setTable({ rot: table.rot === 90 ? 0 : 90 })}>Girar</button>}
            <button className="btn soft sm" onClick={duplicateTable}>Duplicar</button>
            {onQr && <button className="btn soft sm" onClick={() => onQr(table)}><Icon name="qr" size={15} /> QR</button>}
            <button className="btn soft sm" onClick={removeTable}><Icon name="trash" size={15} /> Quitar</button>
          </div>
        </div>
      )}

      {item && (
        <div className="widget stack" style={{ gap: 12 }}>
          <div className="row between">
            <strong>{DECOR[item.type]?.label || 'Pieza'}</strong>
            <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => setSelected(null)} aria-label="Cerrar"><Icon name="close" size={18} /></button>
          </div>
          {DECOR[item.type]?.text && (
            <input className="input" aria-label="Texto" maxLength={16} value={item.label ?? DECOR[item.type].text} onChange={(e) => setItem({ label: e.target.value })} />
          )}
          <div style={ROW}>
            <Stepper label="Largo" value={item.w} step={0.5} onChange={(w) => setItem({ w })} />
            <Stepper label="Ancho" value={item.h} step={item.h < 1 ? 0.1 : 0.5} onChange={(h) => setItem({ h })} />
          </div>
          <div style={ROW}>
            <button className="btn soft sm" onClick={() => setItem({ w: item.h, h: item.w })}>Girar</button>
            <button className="btn soft sm" onClick={() => {
              const copy = { ...item, id: newId(), ...freeSpot(Math.ceil(item.w), Math.ceil(item.h)) };
              set({ items: [...items, copy] });
              setSelected({ kind: 'item', key: copy.id });
            }}>Duplicar</button>
            <button className="btn soft sm" onClick={() => { set({ items: items.filter((i) => i !== item) }); setSelected(null); }}><Icon name="trash" size={15} /> Quitar</button>
          </div>
        </div>
      )}

      <Sheet open={templates} onClose={() => setTemplates(false)} title={`Plantilla para ${zone.name}`}>
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>Se cambia lo que hay dibujado en esta zona. Luego puedes mover y ajustar cada mesa.</p>
          {TEMPLATES.map((t) => (
            <button key={t.id} className="widget row between" style={{ border: 0, textAlign: 'left', background: 'var(--bg)' }} onClick={() => applyTemplate(t)}>
              <span className="stack" style={{ gap: 0 }}>
                <strong>{t.label}</strong>
                <span className="small muted">{t.help}</span>
              </span>
              <Icon name="chevron" size={18} />
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
