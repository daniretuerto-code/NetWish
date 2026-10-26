import { timeToMinutes } from './format.js';

// The dining room plan. Tables keep their own place (x, y, shape, rot) inside `tables`; the rest of the
// plan lives in restaurant_settings.floor: { zones: [{ name, outdoor, open, from, to, w, h }], items: [...] }.
// Positions and sizes are in grid cells; one cell is drawn CELL units wide.
export const CELL = 40;
export const MAIN_ZONE = 'Sala Principal';
export const zoneOf = (t) => t.zone || MAIN_ZONE;

export const SHAPES = [
  { id: 'square', label: 'Cuadrada' },
  { id: 'round', label: 'Redonda' },
  { id: 'rect', label: 'Alargada' },
];

export const TABLE_PRESETS = [
  { label: 'Redonda 2', shape: 'round', capacity: 2 },
  { label: 'Cuadrada 4', shape: 'square', capacity: 4 },
  { label: 'Redonda 4', shape: 'round', capacity: 4 },
  { label: 'Alargada 6', shape: 'rect', capacity: 6 },
  { label: 'Alargada 8', shape: 'rect', capacity: 8 },
  { label: 'Redonda 8', shape: 'round', capacity: 8 },
];

// Things that make the plan recognisable but are never booked.
export const DECOR = {
  wall: { label: 'Pared', w: 6, h: 0.3, fill: '#2A2A2A' },
  window: { label: 'Ventana', w: 3, h: 0.3, fill: '#A9D3E8' },
  door: { label: 'Puerta', w: 2, h: 0.3, fill: '#D4F25C' },
  bar: { label: 'Barra', w: 6, h: 1.5, fill: '#5B4636', text: 'Barra' },
  kitchen: { label: 'Cocina', w: 4, h: 3, fill: '#E7E4DD', text: 'Cocina' },
  wc: { label: 'Baños', w: 3, h: 2, fill: '#E7E4DD', text: 'Baños' },
  plant: { label: 'Planta', w: 1, h: 1, fill: '#7FB069', round: true },
  column: { label: 'Columna', w: 1, h: 1, fill: '#B5B1A8' },
  sofa: { label: 'Sofá', w: 4, h: 1.2, fill: '#C9B8A6', text: 'Sofá' },
  umbrella: { label: 'Sombrilla', w: 2, h: 2, fill: '#F2D27A', round: true },
};

// Footprint of a table with its chairs, in cells.
export function tableSize(t) {
  const cap = Math.max(1, Number(t.capacity) || 2);
  const shape = t.shape || (cap > 4 ? 'rect' : 'square');
  let w;
  let h;
  if (shape === 'round') {
    w = h = cap <= 4 ? 2 : cap <= 8 ? 3 : 4;
  } else if (shape === 'rect') {
    w = Math.max(3, Math.ceil(cap / 2));
    h = 2;
  } else {
    w = h = cap <= 4 ? 2 : 3;
  }
  return t.rot === 90 ? { w: h, h: w, shape } : { w, h, shape };
}

// Chairs drawn around a table: rectangles go along the long sides, squares on every side, rounds in a circle.
export function chairsFor(t) {
  const { w, h, shape } = tableSize(t);
  const cap = Math.max(1, Number(t.capacity) || 2);
  const W = w * CELL;
  const H = h * CELL;
  const out = [];
  if (shape === 'round') {
    const r = Math.min(W, H) / 2 - 6;
    for (let i = 0; i < cap; i += 1) {
      const a = (i / cap) * Math.PI * 2 - Math.PI / 2;
      out.push({ x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r });
    }
    return out;
  }
  const along = (n, horizontal, fixed) => {
    for (let i = 0; i < n; i += 1) {
      const p = ((i + 0.5) / n) * (horizontal ? W : H);
      out.push(horizontal ? { x: p, y: fixed } : { x: fixed, y: p });
    }
  };
  const wide = W >= H;
  if (shape === 'square' && cap <= 4) {
    const sides = [[true, 7], [false, W - 7], [true, H - 7], [false, 7]].slice(0, cap);
    for (const [hor, fixed] of sides) along(1, hor, fixed);
    return out;
  }
  const a = Math.ceil(cap / 2);
  const b = cap - a;
  if (wide) {
    along(a, true, 7);
    along(b, true, H - 7);
  } else {
    along(a, false, 7);
    along(b, false, W - 7);
  }
  return out;
}

// Zones of the plan, always including the ones the tables already use.
export function zonesOf(settings) {
  const saved = settings?.floor?.zones || [];
  const used = (settings?.tables || []).map(zoneOf);
  const names = [...new Set([...saved.map((z) => z.name), ...used])];
  if (!names.length) names.push(MAIN_ZONE);
  // Inside first, then terraces.
  return names.map((name) => {
    const z = saved.find((x) => x.name === name) || {};
    const outdoor = z.outdoor ?? /terraza|patio|jard[ií]n|exterior/i.test(name);
    return { w: 16, h: 12, open: true, from: '', to: '', ...z, name, outdoor };
  }).sort((a, b) => Number(a.outdoor) - Number(b.outdoor));
}

// A zone is bookable when it is open (a terrace closes for the winter or when it rains) and, if it has
// its own hours, the time falls inside them.
export function zoneOpenAt(zone, slot) {
  if (!zone || zone.open === false) return false;
  if (!slot || !zone.from || !zone.to) return true;
  const m = timeToMinutes(slot);
  return m >= timeToMinutes(zone.from) && m <= timeToMinutes(zone.to) - 60;
}

// Tables that have never been placed get a tidy spot in rows, without overlapping placed ones.
export function placeTables(tables, zones, items = []) {
  const result = tables.map((t) => ({ ...t }));
  for (const zone of zones) {
    const taken = items.filter((i) => i.zone === zone.name).map((i) => ({ x: i.x, y: i.y, w: i.w || 1, h: i.h || 1 }));
    const inZone = result.filter((t) => zoneOf(t) === zone.name);
    for (const t of inZone) if (Number.isFinite(t.x) && Number.isFinite(t.y)) taken.push({ x: t.x, y: t.y, ...tableSize(t) });
    for (const t of inZone) {
      if (Number.isFinite(t.x) && Number.isFinite(t.y)) continue;
      const s = tableSize(t);
      let spot = null;
      for (let y = 1; !spot && y + s.h <= Math.max(zone.h, 60); y += 1) {
        for (let x = 1; x + s.w <= zone.w - 1; x += 1) {
          if (!taken.some((o) => x < o.x + o.w + 1 && o.x < x + s.w + 1 && y < o.y + o.h + 1 && o.y < y + s.h + 1)) {
            spot = { x, y };
            break;
          }
        }
      }
      Object.assign(t, spot || { x: 1, y: 1 });
      taken.push({ ...t, ...s });
    }
  }
  return result;
}

// How tall a zone must be to show everything in it.
export function zoneHeight(zone, tables, items) {
  const bottoms = [
    ...tables.filter((t) => zoneOf(t) === zone.name).map((t) => (t.y || 0) + tableSize(t).h),
    ...items.filter((i) => i.zone === zone.name).map((i) => (i.y || 0) + (i.h || 1)),
  ];
  return Math.max(zone.h, Math.ceil(Math.max(0, ...bottoms)) + 1);
}

// Two tables can be pushed together when the owner said so on either of them.
export const canJoin = (a, b) =>
  Number(a.table_number) !== Number(b.table_number) && zoneOf(a) === zoneOf(b)
  && ((a.join || []).map(Number).includes(Number(b.table_number)) || (b.join || []).map(Number).includes(Number(a.table_number)));

export function joinPairs(tables) {
  const pairs = [];
  tables.forEach((a, i) => tables.slice(i + 1).forEach((b) => { if (canJoin(a, b)) pairs.push([a, b]); }));
  return pairs;
}

// Ready-made rooms to start from.
export const TEMPLATES = [
  {
    id: 'bistro',
    label: 'Bar con barra',
    help: 'Barra, mesas de 2 y 4',
    build: (zone) => ({
      items: [
        { type: 'wall', x: 0, y: 0, w: zone.w, h: 0.3 },
        { type: 'bar', x: 1, y: 1, w: 8, h: 1.5 },
        { type: 'door', x: zone.w - 4, y: 0, w: 2, h: 0.3 },
        { type: 'wc', x: zone.w - 4, y: zone.h - 3, w: 3, h: 2 },
      ],
      tables: [
        ...[0, 1, 2, 3].map((i) => ({ shape: 'round', capacity: 2, x: 1 + i * 4, y: 5 })),
        ...[0, 1, 2].map((i) => ({ shape: 'square', capacity: 4, x: 1 + i * 4, y: 9 })),
      ],
    }),
  },
  {
    id: 'comedor',
    label: 'Comedor',
    help: 'Filas de mesas de 4 que se juntan',
    build: (zone) => ({
      items: [
        { type: 'wall', x: 0, y: 0, w: zone.w, h: 0.3 },
        { type: 'window', x: 3, y: 0, w: 3, h: 0.3 },
        { type: 'window', x: 10, y: 0, w: 3, h: 0.3 },
        { type: 'kitchen', x: zone.w - 5, y: 1, w: 4, h: 3 },
      ],
      tables: [1, 5, 9].flatMap((y) => [0, 1, 2].map((i) => ({ shape: 'square', capacity: 4, x: 1 + i * 4, y }))),
      joinRows: true,
    }),
  },
  {
    id: 'terraza',
    label: 'Terraza',
    help: 'Mesas redondas con sombrillas',
    build: (zone) => ({
      items: [
        { type: 'umbrella', x: 3, y: 0.5, w: 2, h: 2 },
        { type: 'umbrella', x: 11, y: 0.5, w: 2, h: 2 },
        { type: 'plant', x: 0, y: 0, w: 1, h: 1 },
        { type: 'plant', x: zone.w - 1, y: 0, w: 1, h: 1 },
      ],
      tables: [3, 7].flatMap((y) => [0, 1, 2, 3].map((i) => ({ shape: 'round', capacity: i % 2 ? 2 : 4, x: 1 + i * 4, y }))),
    }),
  },
];
