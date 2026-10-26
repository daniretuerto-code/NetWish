import { useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import FloorPlan, { DecorPreview, Defs, TablePreview } from '../../components/FloorPlan.jsx';
import { Sheet } from '../../components/ui.jsx';
import { tableMin } from '../../lib/agenda.js';
import {
  CHAIR_COLORS, CHAIR_STYLES, DECOR, DECOR_COLORS, FLOORS, itemBox, MAIN_ZONE, SHAPES, TABLE_MATERIALS, TABLE_PRESETS, tableBox, tableSize, TEMPLATES, zoneHeight, zoneOf,
} from '../../lib/floor.js';

const newId = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ROW = { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const small = { height: 40, width: 58, padding: '0 4px', textAlign: 'center', fontWeight: 800 };
const label = { fontWeight: 600, fontSize: 13, color: 'var(--muted)' };

function Stepper({ name, value, onChange, min = 0.3, max = 40, step = 0.5 }) {
  const v = Math.round(value * 10) / 10;
  return (
    <span style={ROW}>
      <span style={label}>{name}</span>
      <button type="button" className="icon-btn" style={{ width: 34, height: 34, background: 'var(--bg)' }} onClick={() => onChange(Math.max(min, Math.round((v - step) * 10) / 10))} aria-label={`Menos ${name}`}><Icon name="minus" size={15} /></button>
      <strong style={{ minWidth: 30, textAlign: 'center' }}>{v}</strong>
      <button type="button" className="icon-btn" style={{ width: 34, height: 34, background: 'var(--bg)' }} onClick={() => onChange(Math.min(max, Math.round((v + step) * 10) / 10))} aria-label={`Más ${name}`}><Icon name="plus" size={15} /></button>
    </span>
  );
}

function Swatches({ options, value, onChange, size = 30 }) {
  return (
    <div style={{ ...ROW, gap: 6 }}>
      {options.map((o) => {
        const id = o.id ?? o;
        const on = value === id;
        return (
          <button key={id} type="button" onClick={() => onChange(id)} aria-label={o.label || id} aria-pressed={on} title={o.label || ''}
            style={{ width: size, height: size, borderRadius: size / 2, border: 0, padding: 0, background: o.swatch || id, boxShadow: on ? '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)' : 'inset 0 0 0 1px rgba(0,0,0,0.15)' }} />
        );
      })}
    </div>
  );
}

function Turn({ value, onChange }) {
  const v = ((Math.round(Number(value) || 0) % 360) + 360) % 360;
  return (
    <div style={ROW}>
      <span style={label}>Giro</span>
      <button type="button" className="btn soft sm" onClick={() => onChange((v + 345) % 360)} aria-label="Girar a la izquierda">↺</button>
      <input type="range" min={0} max={345} step={15} value={v} onChange={(e) => onChange(Number(e.target.value))} aria-label="Ángulo" style={{ flex: 1, minWidth: 100, accentColor: 'var(--ink)' }} />
      <button type="button" className="btn soft sm" onClick={() => onChange((v + 15) % 360)} aria-label="Girar a la derecha">↻</button>
      <strong style={{ minWidth: 36 }}>{v}°</strong>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div className="stack" style={{ gap: 6 }}>
    <span style={label}>{title}</span>
    {children}
  </div>
);

// The owner draws the room: zones (Sala, Terraza…) with their floor and walls, tables with their
// material, chairs and size, and everything around them. `tables` come already placed; changes go up
// through onChange({ tables, zones, items }).
export default function FloorEditor({ tables, zones, items, onChange, onQr, dirty, onSave, busy }) {
  const [zoneName, setZoneName] = useState(zones[0]?.name || MAIN_ZONE);
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 600 ? 1.5 : 1));
  const [templates, setTemplates] = useState(false);
  const [adding, setAdding] = useState(null); // 'table' | 'decor' | null
  const [draft, setDraft] = useState(null);
  const [full, setFull] = useState(false);
  const [magnet, setMagnet] = useState(true);
  const [zoneOpen, setZoneOpen] = useState(false);
  const past = useRef([]);
  const future = useRef([]);
  const [, setTick] = useState(0);
  const zone = zones.find((z) => z.name === zoneName) || zones[0];
  const height = zoneHeight(zone, tables, items);
  const zoneTables = tables.filter((t) => zoneOf(t) === zone.name);

  const snapshot = () => ({ tables, zones, items });
  const remember = () => {
    past.current = [...past.current.slice(-60), snapshot()];
    future.current = [];
    setTick((n) => n + 1);
  };
  const commit = (patch) => onChange({ tables, zones, items, ...patch });
  const set = (patch) => { remember(); commit(patch); };
  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(snapshot());
    onChange(prev);
    setSelected(null);
    setTick((n) => n + 1);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(snapshot());
    onChange(next);
    setSelected(null);
    setTick((n) => n + 1);
  };

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

  const nextNumber = () => tables.reduce((m, t) => Math.max(m, Number(t.table_number) || 0), 0) + 1;
  // A free spot near the top left of the plan.
  const freeSpot = (w, h) => {
    const boxes = [
      ...zoneTables.map((t) => ({ x: t.x, y: t.y, ...tableBox(t) })),
      ...items.filter((i) => i.zone === zone.name && !['rug', 'area'].includes(i.type)).map((i) => ({ x: i.x, y: i.y, ...itemBox(i) })),
    ];
    for (let y = 0.5; y < height + 20; y += 0.5) {
      for (let x = 0.5; x + w <= zone.w; x += 0.5) {
        if (!boxes.some((o) => x < o.x + o.w && o.x < x + w && y < o.y + o.h && o.y < y + h)) return { x, y };
      }
    }
    return { x: 0, y: height };
  };

  const addTable = (preset) => {
    const n = nextNumber();
    const { label: _l, ...rest } = preset;
    const t = { id: n, table_number: n, zone: zone.name, min: Math.max(1, preset.capacity - 2), material: zone.outdoor ? 'metal' : 'madera', ...rest };
    const s = tableBox(t);
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
    if (kind === 'table') commit({ tables: tables.map((t) => (String(t.table_number) === String(key) ? { ...t, x, y } : t)) });
    else commit({ items: items.map((i) => (i.id === key ? { ...i, x, y } : i)) });
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
    const s = tableBox(table);
    set({ tables: [...tables, { ...table, id: n, table_number: n, name: '', join: [], ...freeSpot(s.w, s.h) }] });
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
    set({ zones: [...zones, { name, outdoor, open: true, from: '', to: '', w: 16, h: 12, floor: outdoor ? 'tarima' : 'parquet', walls: !outdoor, plates: true }] });
    setZoneName(name);
    setSelected(null);
    setZoneOpen(true);
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
        t.join = made.filter((o) => o !== t && o.y === t.y && Math.abs(o.x - t.x) === built.joinRows).map((o) => o.table_number);
      }
    }
    set({
      zones: zones.map((z) => (z.name === zone.name ? { ...z, ...tpl.zone } : z)),
      tables: [...others, ...made],
      items: [...items.filter((i) => i.zone !== zone.name), ...built.items.map((i) => ({ ...i, id: newId(), zone: zone.name }))],
    });
    setSelected(null);
    setTemplates(false);
  };

  const groups = Object.entries(DECOR).reduce((acc, [k, d]) => ({ ...acc, [d.group]: [...(acc[d.group] || []), k] }), {});
  const size = table ? tableSize(table) : null;

  const wrap = full
    ? { position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto', padding: '16px 16px 120px' }
    : {};

  return (
    <div className="stack" style={wrap}>
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true"><Defs /></svg>
      {full && (
        <div className="row between">
          <strong style={{ fontSize: 20 }}>{zone.name}</strong>
          <span style={ROW}>
            {dirty && <button className="btn primary sm" disabled={busy} onClick={onSave}>{busy ? 'Guardando…' : 'Guardar'}</button>}
            <button className="btn soft sm" onClick={() => setFull(false)}>Salir</button>
          </span>
        </div>
      )}

      <div className="chips">
        {zones.map((z) => (
          <button key={z.name} className={`chip ${z.name === zone.name ? 'on' : ''}`} onClick={() => { setZoneName(z.name); setSelected(null); setDraft(null); }}>
            {z.outdoor ? '☀︎ ' : ''}{z.name}{z.outdoor && z.open === false ? ' · cerrada' : ''}
          </button>
        ))}
        <button className="chip" style={{ background: 'var(--bg)' }} onClick={() => addZone(false)}>+ Sala</button>
        <button className="chip" style={{ background: 'var(--accent)' }} onClick={() => addZone(true)}>+ Terraza</button>
      </div>

      <div className="widget stack" style={{ gap: 12 }}>
        <button className="row between" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left' }} onClick={() => setZoneOpen(!zoneOpen)} aria-expanded={zoneOpen}>
          <span className="stack" style={{ gap: 0 }}>
            <strong>Zona: {zone.name}</strong>
            <span className="small muted">Suelo {FLOORS.find((f) => f.id === zone.floor)?.label.toLowerCase() || ''} · {zone.w / 2} × {zone.h / 2} m{zone.outdoor ? ` · ${zone.open === false ? 'cerrada' : 'abierta'}` : ''}</span>
          </span>
          <span className="small" style={{ fontWeight: 700 }}>{zoneOpen ? 'Cerrar' : 'Personalizar'}</span>
        </button>
        {zoneOpen && (
          <>
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
                  <span style={label}>Horario propio</span>
                  <input className="input" type="time" aria-label="Terraza desde" style={{ height: 40, width: 128 }} value={zone.from || ''} onChange={(e) => setZone({ from: e.target.value })} />
                  <span className="small muted">a</span>
                  <input className="input" type="time" aria-label="Terraza hasta" style={{ height: 40, width: 128 }} value={zone.to || ''} onChange={(e) => setZone({ to: e.target.value })} />
                  {(zone.from || zone.to) && <button className="btn soft sm" onClick={() => setZone({ from: '', to: '' })}>Quitar</button>}
                </div>
              </>
            )}
            <Section title="Suelo">
              <Swatches options={FLOORS} value={zone.floor} onChange={(floor) => setZone({ floor })} size={34} />
            </Section>
            <div style={ROW}>
              <label className="row small" style={{ gap: 6, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={zone.walls !== false} onChange={(e) => setZone({ walls: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--ink)' }} />
                Paredes alrededor
              </label>
              <label className="row small" style={{ gap: 6, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={zone.plates !== false} onChange={(e) => setZone({ plates: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--ink)' }} />
                Platos y copas en las mesas
              </label>
            </div>
            <div style={ROW}>
              <Stepper name="Ancho (m)" value={zone.w / 2} min={4} max={25} onChange={(v) => setZone({ w: Math.round(v * 2) })} />
              <Stepper name="Fondo (m)" value={zone.h / 2} min={3} max={25} onChange={(v) => setZone({ h: Math.round(v * 2) })} />
            </div>
            {zones.length > 1 && (zoneTables.length
              ? <span className="small muted">Para borrar la zona, quita o mueve antes sus mesas.</span>
              : <button className="btn soft sm" style={{ alignSelf: 'flex-start' }} onClick={removeZone}><Icon name="trash" size={15} /> Borrar zona</button>)}
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        <button className={`btn sm ${adding === 'table' ? 'primary' : 'soft'}`} onClick={() => setAdding(adding === 'table' ? null : 'table')}><Icon name="plus" size={15} /> Mesa</button>
        <button className={`btn sm ${adding === 'decor' ? 'primary' : 'soft'}`} onClick={() => setAdding(adding === 'decor' ? null : 'decor')}><Icon name="plus" size={15} /> Piezas</button>
        <button className="btn soft sm" onClick={() => setTemplates(true)}>Plantillas</button>
      </div>
      <div style={{ ...ROW, flexWrap: 'nowrap', gap: 6 }}>
        <button className="icon-btn" style={{ width: 38, height: 38, fontSize: 18 }} disabled={!past.current.length} onClick={undo} aria-label="Deshacer">↶</button>
        <button className="icon-btn" style={{ width: 38, height: 38, fontSize: 18 }} disabled={!future.current.length} onClick={redo} aria-label="Rehacer">↷</button>
        <button className={`pill ${magnet ? 'on' : ''}`} style={{ height: 36, minWidth: 0 }} onClick={() => setMagnet(!magnet)} aria-pressed={magnet} title="Encajar en la cuadrícula">Imán</button>
        <span className="grow" />
        <button className="icon-btn" style={{ width: 38, height: 38 }} disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Alejar"><Icon name="minus" size={16} /></button>
        <button className="icon-btn" style={{ width: 38, height: 38 }} disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + 0.5))} aria-label="Acercar"><Icon name="plus" size={16} /></button>
        {!full && <button className="icon-btn" style={{ width: 38, height: 38, fontSize: 18 }} onClick={() => setFull(true)} aria-label="Pantalla completa" title="Pantalla completa">⤢</button>}
      </div>

      {adding === 'table' && (
        <div className="widget" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, padding: 12 }}>
          {TABLE_PRESETS.map((p) => (
            <button key={p.label} className="row" style={{ gap: 8, border: 0, borderRadius: 14, background: 'var(--bg)', padding: '6px 10px', textAlign: 'left', fontWeight: 600, fontSize: 13 }} onClick={() => addTable(p)}>
              <TablePreview t={{ ...p, material: p.material || (zone.outdoor ? 'metal' : 'madera') }} />{p.label}
            </button>
          ))}
        </div>
      )}
      {adding === 'decor' && (
        <div className="widget stack" style={{ gap: 10, padding: 12 }}>
          {Object.entries(groups).map(([g, keys]) => (
            <div key={g} className="stack" style={{ gap: 6 }}>
              <span className="eyebrow">{g}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                {keys.map((k) => (
                  <button key={k} className="row" style={{ gap: 8, border: 0, borderRadius: 14, background: 'var(--bg)', padding: '4px 10px', textAlign: 'left', fontWeight: 600, fontSize: 13 }} onClick={() => addDecor(k)}>
                    <DecorPreview type={k} />{DECOR[k].label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <FloorPlan zone={zone} height={height + 2} tables={tables} items={items} editable selected={selected} onSelect={setSelected} onMove={move} onDragStart={remember} zoom={zoom} snap={magnet ? 0.5 : 0.1}
        look={(t) => (t.name ? { badge: t.name, badgeBg: 'rgba(255,255,255,0.92)', badgeFg: '#111' } : {})} />
      <p className="small muted" style={{ margin: '0 4px' }}>Arrastra las mesas y las piezas. Toca una para personalizarla. Cada cuadro mide 50 cm.</p>

      {table && (
        <div className="widget stack" style={{ gap: 14 }}>
          <div className="row between">
            <span style={ROW}>
              <span style={label}>Mesa</span>
              <input className="input" aria-label="Número de mesa" style={{ ...small, width: 64, fontSize: 18 }} inputMode="numeric" value={table.table_number}
                onChange={(e) => setTable({ table_number: e.target.value.replace(/\D/g, '') })} />
              <input className="input" aria-label="Nombre de la mesa" placeholder="Nombre (opcional)" maxLength={14} style={{ height: 40, width: 190 }} value={table.name || ''} onChange={(e) => setTable({ name: e.target.value })} />
            </span>
            <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => setSelected(null)} aria-label="Cerrar"><Icon name="close" size={18} /></button>
          </div>
          <div style={ROW}>
            <span style={label}>Personas: de</span>
            <input className="input" style={small} type="number" min={1} max={table.capacity} aria-label="Mínimo de personas" value={table.min ?? tableMin(table)} onChange={(e) => setTable({ min: e.target.value })} />
            <span className="small muted">a</span>
            <input className="input" style={small} type="number" min={1} max={30} aria-label="Máximo de personas" value={table.capacity} onChange={(e) => setTable({ capacity: e.target.value, w: undefined, h: undefined })} />
          </div>
          <div className="segmented" role="tablist" aria-label="Forma">
            {SHAPES.map((s) => (
              <button key={s.id} role="tab" aria-selected={size.shape === s.id} onClick={() => setTable({ shape: s.id, w: undefined, h: undefined })} style={{ background: size.shape === s.id ? undefined : 'var(--bg)' }}>{s.label}</button>
            ))}
          </div>
          <Section title="Material">
            <div style={{ ...ROW, gap: 6 }}>
              {TABLE_MATERIALS.map((m) => {
                const on = (table.material || 'madera') === m.id;
                return (
                  <button key={m.id} className="chip" style={{ height: 36, paddingLeft: 8, background: on ? 'var(--ink)' : 'var(--bg)', color: on ? '#fff' : 'var(--ink)' }} onClick={() => setTable({ material: m.id })} aria-pressed={on}>
                    <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 10, background: m.swatch, marginRight: 6, verticalAlign: 'middle', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' }} />{m.label}
                  </button>
                );
              })}
            </div>
          </Section>
          <Section title="Asientos">
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              {CHAIR_STYLES.map((c) => {
                const on = (table.chairs || 'silla') === c.id;
                return <button key={c.id} className={`chip ${on ? 'on' : ''}`} style={{ height: 36, background: on ? undefined : 'var(--bg)' }} onClick={() => setTable({ chairs: c.id })}>{c.label}</button>;
              })}
            </div>
            {table.chairs !== 'ninguna' && <Swatches options={CHAIR_COLORS} value={table.chairColor || '#A57A52'} onChange={(chairColor) => setTable({ chairColor })} />}
          </Section>
          <Section title="Tamaño">
            <div style={ROW}>
              {size.shape === 'round'
                ? <Stepper name="Diámetro (m)" value={size.w / 2} min={0.8} max={4} step={0.25} onChange={(v) => setTable({ w: v * 2, h: v * 2 })} />
                : (
                  <>
                    <Stepper name="Largo (m)" value={size.w / 2} min={0.8} max={8} step={0.25} onChange={(v) => setTable({ w: v * 2, h: size.h })} />
                    <Stepper name="Ancho (m)" value={size.h / 2} min={0.8} max={4} step={0.25} onChange={(v) => setTable({ h: v * 2, w: size.w })} />
                  </>
                )}
            </div>
          </Section>
          {size.shape !== 'round' && <Turn value={table.rot} onChange={(rot) => setTable({ rot })} />}
          <label className="row small" style={{ gap: 8, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={table.online !== false} onChange={(e) => setTable({ online: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--ink)' }} />
            Se puede reservar online
          </label>
          {zones.length > 1 && (
            <div style={ROW}>
              <span style={label}>Zona</span>
              <select className="input" style={{ height: 40, width: 'auto' }} value={zoneOf(table)} onChange={(e) => { setTable({ zone: e.target.value, x: undefined, y: undefined, join: [] }); setZoneName(e.target.value); }}>
                {zones.map((z) => <option key={z.name}>{z.name}</option>)}
              </select>
            </div>
          )}
          {zoneTables.length > 1 && (
            <Section title="Se puede juntar con (para grupos grandes)">
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {zoneTables.filter((o) => o !== table).map((o) => {
                  const on = (table.join || []).map(Number).includes(Number(o.table_number)) || (o.join || []).map(Number).includes(Number(table.table_number));
                  return <button key={o.table_number} className={`chip ${on ? 'on' : ''}`} style={{ height: 36, background: on ? undefined : 'var(--bg)' }} aria-pressed={on} onClick={() => toggleJoin(o)}>Mesa {o.table_number} ({o.capacity})</button>;
                })}
              </div>
            </Section>
          )}
          <div style={ROW}>
            <button className="btn soft sm" onClick={duplicateTable}>Duplicar</button>
            {onQr && <button className="btn soft sm" onClick={() => onQr(table)}><Icon name="qr" size={15} /> QR</button>}
            <button className="btn soft sm" onClick={removeTable}><Icon name="trash" size={15} /> Quitar</button>
          </div>
        </div>
      )}

      {item && (
        <div className="widget stack" style={{ gap: 14 }}>
          <div className="row between">
            <span className="row" style={{ gap: 8 }}><DecorPreview type={item.type} /><strong>{DECOR[item.type]?.label || 'Pieza'}</strong></span>
            <button className="icon-btn" style={{ background: 'var(--bg)' }} onClick={() => setSelected(null)} aria-label="Cerrar"><Icon name="close" size={18} /></button>
          </div>
          {DECOR[item.type]?.text !== undefined && (
            <input className="input" aria-label="Texto" maxLength={20} value={item.label ?? DECOR[item.type].text} onChange={(e) => setItem({ label: e.target.value })} />
          )}
          <Section title="Color">
            <Swatches options={DECOR_COLORS} value={item.color || DECOR[item.type]?.color} onChange={(color) => setItem({ color })} />
          </Section>
          <div style={ROW}>
            <Stepper name="Largo (m)" value={item.w / 2} min={0.1} max={20} step={0.25} onChange={(v) => setItem({ w: v * 2 })} />
            <Stepper name="Ancho (m)" value={item.h / 2} min={0.05} max={20} step={item.h < 1 ? 0.05 : 0.25} onChange={(v) => setItem({ h: v * 2 })} />
          </div>
          <Turn value={item.rot} onChange={(rot) => setItem({ rot })} />
          <div style={ROW}>
            <button className="btn soft sm" onClick={() => {
              const copy = { ...item, id: newId(), ...freeSpot(Math.ceil(itemBox(item).w), Math.ceil(itemBox(item).h)) };
              set({ items: [...items, copy] });
              setSelected({ kind: 'item', key: copy.id });
            }}>Duplicar</button>
            <button className="btn soft sm" onClick={() => { set({ items: items.filter((i) => i !== item) }); setSelected(null); }}><Icon name="trash" size={15} /> Quitar</button>
          </div>
        </div>
      )}

      <Sheet open={templates} onClose={() => setTemplates(false)} title={`Plantilla para ${zone.name}`}>
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>Se cambia lo que hay dibujado en esta zona (puedes deshacerlo). Luego mueves y ajustas cada mesa.</p>
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
