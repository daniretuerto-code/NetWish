import { timeToMinutes } from './format.js';

// The dining room plan. Tables keep their own place inside `tables` (x, y, shape, rot, w, h, material,
// chairs, chairColor, name, join); the rest lives in restaurant_settings.floor:
// { zones: [{ name, outdoor, open, from, to, w, h, floor, walls, plates }], items: [{ id, zone, type, x, y, w, h, rot, color, label }] }.
// Positions and sizes are in grid cells (one cell ≈ 50 cm); one cell is drawn CELL units wide.
export const CELL = 40;
export const MAIN_ZONE = 'Sala Principal';
export const zoneOf = (t) => t.zone || MAIN_ZONE;

export const SHAPES = [
  { id: 'square', label: 'Cuadrada' },
  { id: 'round', label: 'Redonda' },
  { id: 'rect', label: 'Alargada' },
];

export const TABLE_PRESETS = [
  { label: 'Redonda de 2', shape: 'round', capacity: 2 },
  { label: 'Cuadrada de 2', shape: 'square', capacity: 2 },
  { label: 'Cuadrada de 4', shape: 'square', capacity: 4 },
  { label: 'Redonda de 4', shape: 'round', capacity: 4 },
  { label: 'Alargada de 6', shape: 'rect', capacity: 6 },
  { label: 'Alargada de 8', shape: 'rect', capacity: 8 },
  { label: 'Redonda de 8', shape: 'round', capacity: 8 },
  { label: 'Banco corrido de 6', shape: 'rect', capacity: 6, chairs: 'banco' },
  { label: 'Mesa alta de 4', shape: 'round', capacity: 4, chairs: 'taburete', material: 'negra' },
  { label: 'Mesa de terraza', shape: 'round', capacity: 2, material: 'metal', chairs: 'silla', chairColor: '#5E7D5A' },
];

export const TABLE_MATERIALS = [
  { id: 'madera', label: 'Madera', swatch: 'linear-gradient(135deg,#D3A46F,#A9743F)' },
  { id: 'nogal', label: 'Nogal', swatch: 'linear-gradient(135deg,#7A4E2D,#55331B)' },
  { id: 'marmol', label: 'Mármol', swatch: 'linear-gradient(135deg,#FBFAF7,#DAD6CF)' },
  { id: 'mantel', label: 'Mantel', swatch: '#FFFFFF' },
  { id: 'negra', label: 'Negra', swatch: '#2A2826' },
  { id: 'metal', label: 'Metal', swatch: 'linear-gradient(135deg,#D9DCDE,#9AA0A4)' },
];

export const CHAIR_STYLES = [
  { id: 'silla', label: 'Sillas' },
  { id: 'sillon', label: 'Sillones' },
  { id: 'taburete', label: 'Taburetes' },
  { id: 'banco', label: 'Banco' },
  { id: 'ninguna', label: 'Sin sillas' },
];

export const CHAIR_COLORS = ['#A57A52', '#2B2B2B', '#F2EEE6', '#8C8C8C', '#5E7D5A', '#B5482E', '#D9A441', '#3E5C76', '#C9A5A0'];

export const FLOORS = [
  { id: 'parquet', label: 'Parquet', swatch: '#D6B489' },
  { id: 'nogal', label: 'Madera oscura', swatch: '#7E5536' },
  { id: 'espiga', label: 'Espiga', swatch: '#C99D6B' },
  { id: 'baldosa', label: 'Baldosa', swatch: '#EDE6DA' },
  { id: 'hidraulico', label: 'Hidráulico', swatch: 'repeating-conic-gradient(#2B2B2B 0 25%,#F3EFE7 0 50%) 0 0/12px 12px' },
  { id: 'terrazo', label: 'Terrazo', swatch: '#E9E3D8' },
  { id: 'marmol', label: 'Mármol', swatch: '#F4F2EE' },
  { id: 'cemento', label: 'Cemento', swatch: '#BDBAB4' },
  { id: 'tarima', label: 'Tarima exterior', swatch: '#A88B6A' },
  { id: 'adoquin', label: 'Adoquín', swatch: '#B9B1A5' },
  { id: 'cesped', label: 'Césped', swatch: '#8DB665' },
];

// Things that make the plan recognisable but are never booked. `color` is the default, the owner can change it.
export const DECOR = {
  wall: { label: 'Pared', w: 6, h: 0.3, color: '#3A3632', group: 'Estructura' },
  window: { label: 'Ventana', w: 3, h: 0.3, color: '#A9D3E8', group: 'Estructura' },
  door: { label: 'Puerta', w: 2, h: 2, color: '#8A6A4B', group: 'Estructura' },
  column: { label: 'Columna', w: 1, h: 1, color: '#B5B1A8', group: 'Estructura' },
  stairs: { label: 'Escalera', w: 2, h: 4, color: '#CFC9BF', group: 'Estructura' },
  bar: { label: 'Barra', w: 7, h: 2.2, color: '#5B4636', text: 'Barra', group: 'Servicio' },
  kitchen: { label: 'Cocina', w: 5, h: 3, color: '#C9CDD0', text: 'Cocina', group: 'Servicio' },
  register: { label: 'Caja', w: 2, h: 1, color: '#2E2E2E', text: 'Caja', group: 'Servicio' },
  shelf: { label: 'Botellero', w: 4, h: 0.8, color: '#6B4A31', group: 'Servicio' },
  wc: { label: 'Baños', w: 3, h: 2.5, color: '#DCE7EC', text: 'Aseos', group: 'Servicio' },
  plant: { label: 'Planta', w: 1, h: 1, color: '#5E8C4A', group: 'Decoración' },
  tree: { label: 'Árbol', w: 3, h: 3, color: '#4E7D3A', group: 'Decoración' },
  planter: { label: 'Jardinera', w: 4, h: 0.8, color: '#7A5A3C', group: 'Decoración' },
  rug: { label: 'Alfombra', w: 4, h: 3, color: '#B5482E', group: 'Decoración' },
  sofa: { label: 'Sofá', w: 4, h: 1.5, color: '#9C8672', group: 'Decoración' },
  fireplace: { label: 'Chimenea', w: 3, h: 1, color: '#9B4A33', group: 'Decoración' },
  piano: { label: 'Piano', w: 3, h: 2.5, color: '#1E1E1E', group: 'Decoración' },
  stage: { label: 'Escenario', w: 6, h: 3, color: '#8E6B4A', text: 'Escenario', group: 'Decoración' },
  tv: { label: 'Tele', w: 3, h: 0.3, color: '#151515', group: 'Decoración' },
  screen: { label: 'Biombo', w: 4, h: 0.5, color: '#C2A27C', group: 'Decoración' },
  umbrella: { label: 'Sombrilla', w: 3, h: 3, color: '#F1E4C6', group: 'Terraza' },
  heater: { label: 'Estufa', w: 1, h: 1, color: '#6F6F6F', group: 'Terraza' },
  fence: { label: 'Valla', w: 6, h: 0.3, color: '#5B4636', group: 'Terraza' },
  area: { label: 'Zona marcada', w: 5, h: 4, color: '#D4F25C', text: 'Reservado', group: 'Otros' },
  text: { label: 'Texto', w: 4, h: 1, color: '#111111', text: 'Texto', group: 'Otros' },
};

export const DECOR_COLORS = ['#3A3632', '#5B4636', '#8E6B4A', '#C2A27C', '#F1E4C6', '#FFFFFF', '#B5482E', '#D9A441', '#D4F25C', '#5E8C4A', '#3E5C76', '#A9D3E8', '#9C8672', '#151515'];

const sizeOf = (shape, cap) => {
  if (shape === 'round') return cap <= 2 ? [2, 2] : cap <= 4 ? [2.5, 2.5] : cap <= 6 ? [3, 3] : [3.5, 3.5];
  if (shape === 'rect') return [Math.max(3, Math.ceil(cap / 2) * 1.25 + 0.5), 2.5];
  return cap <= 2 ? [2, 2] : cap <= 4 ? [2.5, 2.5] : [3, 3];
};

// A table's own size (chairs included), before turning it.
export function tableSize(t) {
  const cap = Math.max(1, Number(t.capacity) || 2);
  const shape = t.shape || (cap > 4 ? 'rect' : 'square');
  const [dw, dh] = sizeOf(shape, cap);
  const w = Number(t.w) || dw;
  const h = shape === 'round' && !t.h ? w : Number(t.h) || dh;
  return { w, h, shape };
}

// The box it takes on the plan once turned (90° turns swap the sides; other angles keep the box).
export function boxOf(w, h, rot) {
  return (Math.round(Number(rot) || 0) % 180 + 180) % 180 === 90 ? { w: h, h: w } : { w, h };
}
export const tableBox = (t) => { const s = tableSize(t); return boxOf(s.w, s.h, t.rot); };
export const itemBox = (i) => boxOf(i.w || 1, i.h || 1, i.rot);

// The table top sits inside the footprint, leaving room for the chairs around it.
export const TABLE_INSET = 15;

// Seats around a table, in table units: where each one goes, which way it looks and which side it is on.
export function chairsFor(t) {
  const { w, h, shape } = tableSize(t);
  const cap = Math.max(1, Number(t.capacity) || 2);
  const W = w * CELL;
  const H = h * CELL;
  const out = [];
  const edge = TABLE_INSET - 3;
  if (shape === 'round') {
    const rx = W / 2 - edge;
    const ry = H / 2 - edge;
    for (let i = 0; i < cap; i += 1) {
      const a = (i / cap) * Math.PI * 2 - Math.PI / 2;
      out.push({ x: W / 2 + Math.cos(a) * rx, y: H / 2 + Math.sin(a) * ry, a: a + Math.PI, side: 'round' });
    }
    return out;
  }
  const along = (n, side) => {
    for (let i = 0; i < n; i += 1) {
      if (side === 'top' || side === 'bottom') {
        const usable = W - TABLE_INSET * 2;
        out.push({ x: TABLE_INSET + ((i + 0.5) / n) * usable, y: side === 'top' ? edge : H - edge, a: side === 'top' ? Math.PI / 2 : -Math.PI / 2, side });
      } else {
        const usable = H - TABLE_INSET * 2;
        out.push({ x: side === 'left' ? edge : W - edge, y: TABLE_INSET + ((i + 0.5) / n) * usable, a: side === 'left' ? 0 : Math.PI, side });
      }
    }
  };
  const wide = W >= H;
  if (shape === 'square' && cap <= 4) {
    const sides = cap === 2 ? (wide ? ['left', 'right'] : ['top', 'bottom']) : ['top', 'right', 'bottom', 'left'].slice(0, cap);
    for (const s of sides) along(1, s);
    return out;
  }
  // Long tables: chairs on the long sides, and one at each end when the table is long enough.
  const ends = cap >= 8 && cap % 2 === 0 && t.chairs !== 'banco' ? 2 : 0;
  const a = Math.ceil((cap - ends) / 2);
  const b = cap - ends - a;
  if (wide) {
    along(a, 'top');
    along(b, 'bottom');
    if (ends) { along(1, 'left'); along(1, 'right'); }
  } else {
    along(a, 'left');
    along(b, 'right');
    if (ends) { along(1, 'top'); along(1, 'bottom'); }
  }
  return out;
}

// Zones of the plan, always including the ones the tables already use. Inside first, then terraces.
export function zonesOf(settings) {
  const saved = settings?.floor?.zones || [];
  const used = (settings?.tables || []).map(zoneOf);
  const names = [...new Set([...saved.map((z) => z.name), ...used])];
  if (!names.length) names.push(MAIN_ZONE);
  return names.map((name) => {
    const z = saved.find((x) => x.name === name) || {};
    const outdoor = z.outdoor ?? /terraza|patio|jard[ií]n|exterior/i.test(name);
    return { w: 16, h: 12, open: true, from: '', to: '', floor: outdoor ? 'tarima' : 'parquet', walls: !outdoor, plates: true, ...z, name, outdoor };
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

// Tables that have never been placed get a tidy spot in rows, without overlapping anything placed.
export function placeTables(tables, zones, items = []) {
  const result = tables.map((t) => ({ ...t }));
  for (const zone of zones) {
    const taken = items.filter((i) => i.zone === zone.name && !['rug', 'area', 'text'].includes(i.type)).map((i) => ({ x: i.x, y: i.y, ...itemBox(i) }));
    const inZone = result.filter((t) => zoneOf(t) === zone.name);
    for (const t of inZone) if (Number.isFinite(t.x) && Number.isFinite(t.y)) taken.push({ x: t.x, y: t.y, ...tableBox(t) });
    for (const t of inZone) {
      if (Number.isFinite(t.x) && Number.isFinite(t.y)) continue;
      const s = tableBox(t);
      let spot = null;
      for (let y = 1; !spot && y + s.h <= Math.max(zone.h, 60); y += 0.5) {
        for (let x = 1; x + s.w <= zone.w - 0.5; x += 0.5) {
          if (!taken.some((o) => x < o.x + o.w + 0.5 && o.x < x + s.w + 0.5 && y < o.y + o.h + 0.5 && o.y < y + s.h + 0.5)) {
            spot = { x, y };
            break;
          }
        }
      }
      Object.assign(t, spot || { x: 1, y: 1 });
      taken.push({ x: t.x, y: t.y, ...s });
    }
  }
  return result;
}

// How tall a zone must be to show everything in it.
export function zoneHeight(zone, tables, items) {
  const bottoms = [
    ...tables.filter((t) => zoneOf(t) === zone.name).map((t) => (t.y || 0) + tableBox(t).h),
    ...items.filter((i) => i.zone === zone.name).map((i) => (i.y || 0) + itemBox(i).h),
  ];
  return Math.max(zone.h, Math.ceil(Math.max(0, ...bottoms)));
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
    help: 'Barra con taburetes, mesas de 2 y de 4, aseos',
    zone: { floor: 'hidraulico', walls: true },
    build: (zone) => ({
      items: [
        { type: 'bar', x: 1, y: 0.5, w: 8, h: 2.2 },
        { type: 'shelf', x: 1, y: 0.2, w: 8, h: 0.3 },
        { type: 'door', x: zone.w - 3.5, y: zone.h - 2, w: 2, h: 2, rot: 180 },
        { type: 'wc', x: zone.w - 4, y: 0.5, w: 3.5, h: 2.5 },
        { type: 'plant', x: 10, y: 0.5, w: 1, h: 1 },
      ],
      tables: [
        ...[0, 1, 2, 3].map((i) => ({ shape: 'round', capacity: 2, x: 1 + i * 3.5, y: 4, material: 'marmol', chairColor: '#2B2B2B' })),
        ...[0, 1, 2].map((i) => ({ shape: 'square', capacity: 4, x: 1 + i * 4, y: 7.5, material: 'madera', chairColor: '#2B2B2B' })),
      ],
    }),
  },
  {
    id: 'comedor',
    label: 'Comedor',
    help: 'Mesas de 4 en filas que se juntan, ventanas y cocina',
    zone: { floor: 'parquet', walls: true },
    build: (zone) => ({
      items: [
        { type: 'window', x: 2, y: 0, w: 3, h: 0.3 },
        { type: 'window', x: 7, y: 0, w: 3, h: 0.3 },
        { type: 'kitchen', x: zone.w - 4, y: 0.3, w: 3.7, h: 3 },
        { type: 'door', x: 0.3, y: zone.h - 2.3, w: 2, h: 2, rot: 270 },
        { type: 'plant', x: zone.w - 1.3, y: zone.h - 1.3, w: 1, h: 1 },
      ],
      tables: [1, 4.5, 8].flatMap((y) => [0, 1, 2].map((i) => ({ shape: 'square', capacity: 4, x: 0.8 + i * 3, y, material: 'mantel', chairColor: '#A57A52' }))),
      joinRows: 3,
    }),
  },
  {
    id: 'restaurante',
    label: 'Restaurante elegante',
    help: 'Mesas redondas con mantel, sofás y chimenea',
    zone: { floor: 'espiga', walls: true },
    build: (zone) => ({
      items: [
        { type: 'fireplace', x: 6, y: 0.3, w: 3, h: 1 },
        { type: 'rug', x: 4.5, y: 4, w: 6, h: 4, color: '#7A3B2E' },
        { type: 'sofa', x: 0.3, y: 2, w: 4, h: 1.5, rot: 90 },
        { type: 'plant', x: 0.5, y: 0.5, w: 1, h: 1 },
        { type: 'plant', x: zone.w - 1.5, y: 0.5, w: 1, h: 1 },
        { type: 'door', x: zone.w / 2 - 1, y: zone.h - 2, w: 2, h: 2, rot: 180 },
      ],
      tables: [
        { shape: 'round', capacity: 6, x: 6, y: 4.5, material: 'mantel', chairs: 'sillon', chairColor: '#C9A5A0' },
        ...[1.5, 7.5].flatMap((y) => [{ x: 2, y }, { x: 11, y }]).map((p) => ({ shape: 'round', capacity: 4, ...p, material: 'mantel', chairColor: '#C9A5A0' })),
      ],
    }),
  },
  {
    id: 'terraza',
    label: 'Terraza',
    help: 'Mesas de metal con sombrillas y jardineras',
    zone: { floor: 'tarima', walls: false },
    build: (zone) => ({
      items: [
        { type: 'planter', x: 0, y: 0, w: zone.w, h: 0.8 },
        { type: 'umbrella', x: 2.5, y: 2.3, w: 3, h: 3 },
        { type: 'umbrella', x: 9.5, y: 2.3, w: 3, h: 3 },
        { type: 'heater', x: 7, y: 6, w: 1, h: 1 },
      ],
      tables: [2, 6.5].flatMap((y) => [0, 1, 2, 3].map((i) => ({ shape: 'round', capacity: i % 2 ? 2 : 4, x: 0.8 + i * 3.6, y, material: 'metal', chairColor: '#5E7D5A' }))),
    }),
  },
];
