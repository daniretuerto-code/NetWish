import { useRef } from 'react';
import { CELL, chairsFor, DECOR, tableSize, zoneOf } from '../lib/floor.js';

const snap = (v) => Math.round(v * 2) / 2;

// One zone of the dining room drawn to scale. In edit mode pieces are dragged on a grid; otherwise
// tables are buttons painted with whatever `look` says (free, booked, seated…).
export default function FloorPlan({ zone, height, tables, items, editable, selected, onSelect, onMove, look, onTableClick, zoom = 1 }) {
  const svg = useRef(null);
  const drag = useRef(null);
  const W = zone.w * CELL;
  const H = height * CELL;

  const toCells = (e) => {
    const p = svg.current.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.current.getScreenCTM().inverse());
    return { x: q.x / CELL, y: q.y / CELL };
  };

  const startDrag = (e, kind, key, x, y, w, h) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.({ kind, key });
    const from = toCells(e);
    drag.current = { kind, key, x, y, w, h, from, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveDrag = (e) => {
    const d = drag.current;
    if (!d) return;
    const at = toCells(e);
    const x = Math.min(Math.max(0, snap(d.x + at.x - d.from.x)), zone.w - Math.min(d.w, zone.w));
    const y = Math.max(0, snap(d.y + at.y - d.from.y));
    if (x !== d.lastX || y !== d.lastY) {
      d.lastX = x;
      d.lastY = y;
      onMove?.(d.kind, d.key, x, y);
    }
  };
  const endDrag = () => { drag.current = null; };

  const handlers = (kind, key, x, y, w, h) => (editable ? {
    onPointerDown: (e) => startDrag(e, kind, key, x, y, w, h),
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    style: { cursor: 'grab', touchAction: 'none' },
  } : {});

  const isSel = (kind, key) => selected && selected.kind === kind && String(selected.key) === String(key);

  return (
    <div style={{ overflowX: 'auto', borderRadius: 20, background: zone.outdoor ? '#EEF3E2' : 'var(--bg)' }}>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', width: `${zoom * 100}%`, minWidth: zoom > 1 ? undefined : 0, height: 'auto' }}
        onPointerDown={() => editable && onSelect?.(null)}
        role="img"
        aria-label={`Plano de ${zone.name}`}
      >
        {editable && (
          <g>
            {Array.from({ length: zone.w + 1 }, (_, i) => <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={H} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />)}
            {Array.from({ length: height + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * CELL} x2={W} y2={i * CELL} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />)}
          </g>
        )}

        {items.filter((i) => i.zone === zone.name).map((i) => {
          const d = DECOR[i.type] || DECOR.column;
          const w = (i.w || d.w) * CELL;
          const h = (i.h || d.h) * CELL;
          const sel = isSel('item', i.id);
          return (
            <g key={i.id} transform={`translate(${i.x * CELL} ${i.y * CELL})`} {...handlers('item', i.id, i.x, i.y, i.w || d.w, i.h || d.h)}>
              {d.round
                ? <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} style={{ fill: d.fill }} />
                : <rect width={w} height={h} rx={Math.min(8, h / 2)} style={{ fill: d.fill }} />}
              {d.text && h >= CELL && <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="central" style={{ fill: i.type === 'bar' ? '#fff' : '#6B6862', fontSize: 15, fontWeight: 700, pointerEvents: 'none' }}>{i.label || d.text}</text>}
              {sel && <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={10} style={{ fill: 'none', stroke: '#111', strokeWidth: 3, strokeDasharray: '6 5' }} />}
            </g>
          );
        })}

        {tables.filter((t) => zoneOf(t) === zone.name).map((t) => {
          const { w, h, shape } = tableSize(t);
          const Wt = w * CELL;
          const Ht = h * CELL;
          const sel = isSel('table', t.table_number);
          const l = look?.(t) || {};
          const fill = l.fill || '#fff';
          const fg = l.fg || '#111';
          const inset = 14;
          const click = !editable && onTableClick ? {
            onClick: () => onTableClick(t),
            onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTableClick(t); } },
            role: 'button',
            tabIndex: 0,
            'aria-label': `Mesa ${t.table_number}${l.label ? `, ${l.label}` : ''}`,
            style: { cursor: 'pointer' },
          } : {};
          return (
            <g key={t.table_number} transform={`translate(${t.x * CELL} ${t.y * CELL})`} {...handlers('table', t.table_number, t.x, t.y, w, h)} {...click}>
              {chairsFor(t).map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={8} style={{ fill: l.chair || '#CFCBC2' }} />)}
              {shape === 'round'
                ? <ellipse cx={Wt / 2} cy={Ht / 2} rx={Wt / 2 - inset} ry={Ht / 2 - inset} style={{ fill, stroke: l.stroke || '#111', strokeWidth: 2 }} />
                : <rect x={inset} y={inset} width={Wt - inset * 2} height={Ht - inset * 2} rx={8} style={{ fill, stroke: l.stroke || '#111', strokeWidth: 2 }} />}
              <text x={Wt / 2} y={Ht / 2 - (l.label ? 8 : 0)} textAnchor="middle" dominantBaseline="central" style={{ fill: fg, fontSize: 22, fontWeight: 800, pointerEvents: 'none' }}>{t.table_number}</text>
              {l.label && <text x={Wt / 2} y={Ht / 2 + 13} textAnchor="middle" dominantBaseline="central" style={{ fill: fg, fontSize: 12, fontWeight: 700, pointerEvents: 'none' }}>{String(l.label).slice(0, w * 4)}</text>}
              {t.online === false && <circle cx={Wt - inset} cy={inset} r={6} style={{ fill: '#B5B1A8' }}><title>Solo sin reserva</title></circle>}
              {sel && <rect x={2} y={2} width={Wt - 4} height={Ht - 4} rx={12} style={{ fill: 'none', stroke: '#111', strokeWidth: 3, strokeDasharray: '6 5' }} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
