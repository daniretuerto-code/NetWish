import { useRef } from 'react';
import { boxOf, CELL, chairsFor, DECOR, TABLE_INSET, tableSize, zoneOf } from '../lib/floor.js';

// Lighter (amt > 0) or darker (amt < 0) version of a #rrggbb colour.
function shade(hex, amt) {
  const n = parseInt(String(hex || '#888888').slice(1, 7), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}

// Floors, materials and the soft shadow, shared by every piece of the plan.
export function Defs() {
  const planks = (id, colors, w = 120, h = 20) => (
    <pattern id={id} width={w * 2} height={h * 2} patternUnits="userSpaceOnUse">
      <rect width={w * 2} height={h * 2} fill={colors[0]} />
      <rect x={0} y={0} width={w} height={h} fill={colors[1]} />
      <rect x={w} y={0} width={w} height={h} fill={colors[2]} />
      <rect x={-w / 2} y={h} width={w} height={h} fill={colors[2]} />
      <rect x={w / 2} y={h} width={w} height={h} fill={colors[0]} />
      <rect x={w * 1.5} y={h} width={w} height={h} fill={colors[1]} />
      <path d={`M0 ${h}H${w * 2}M0 ${h * 2}H${w * 2}M${w} 0V${h}M0 0V${h}M${w / 2} ${h}V${h * 2}M${w * 1.5} ${h}V${h * 2}`} stroke="rgba(0,0,0,0.14)" strokeWidth={1} />
      <path d={`M8 ${h * 0.4}h40M70 ${h * 0.7}h30M${w + 20} ${h * 0.5}h50M${w / 2 + 10} ${h * 1.5}h36M${w * 1.5 + 30} ${h * 1.3}h44`} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
    </pattern>
  );
  return (
    <defs>
      <filter id="fp-sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#000" floodOpacity="0.28" /></filter>
      <filter id="fp-sh-soft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.22" /></filter>
      {planks('fl-parquet', ['#D6B489', '#DDBF95', '#CDAA7D'])}
      {planks('fl-nogal', ['#7E5536', '#86603F', '#714A2E'])}
      {planks('fl-tarima', ['#A88B6A', '#9E8262', '#B09372'], 160, 18)}
      <pattern id="fl-espiga" width={40} height={40} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={40} height={40} fill="#C99D6B" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={(i * 10) % 40} y={i * 10} width={30} height={10} fill={i % 2 ? '#D2A876' : '#BF9262'} stroke="rgba(0,0,0,0.12)" />)}
        {[0, 1, 2, 3].map((i) => <rect key={`b${i}`} x={(i * 10) % 40 - 40} y={i * 10} width={30} height={10} fill={i % 2 ? '#D2A876' : '#BF9262'} stroke="rgba(0,0,0,0.12)" />)}
      </pattern>
      <pattern id="fl-baldosa" width={40} height={40} patternUnits="userSpaceOnUse">
        <rect width={40} height={40} fill="#EDE6DA" stroke="#D6CCBC" strokeWidth={1.5} />
      </pattern>
      <pattern id="fl-hidraulico" width={20} height={20} patternUnits="userSpaceOnUse">
        <rect width={20} height={20} fill="#F1ECE2" />
        <rect width={10} height={10} fill="#3A3836" />
        <rect x={10} y={10} width={10} height={10} fill="#3A3836" />
        <path d="M0 0H20V20" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={0.6} />
      </pattern>
      <pattern id="fl-terrazo" width={60} height={60} patternUnits="userSpaceOnUse">
        <rect width={60} height={60} fill="#E9E3D8" />
        {[[6, 8, 2.5, '#B5482E'], [22, 15, 1.6, '#6B6862'], [40, 6, 2, '#D9A441'], [52, 26, 2.8, '#9AA3A6'], [14, 34, 2, '#6B6862'], [33, 40, 3, '#C8B8A0'], [48, 50, 1.6, '#B5482E'], [8, 52, 2.2, '#9AA3A6'], [28, 27, 1.4, '#D9A441'], [56, 8, 1.4, '#6B6862']].map(([x, y, r, c]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill={c} />)}
      </pattern>
      <pattern id="fl-marmol" width={200} height={200} patternUnits="userSpaceOnUse">
        <rect width={200} height={200} fill="#F4F2EE" />
        <path d="M0 40C40 30 60 80 110 70S170 20 200 35M20 200C40 150 90 160 120 120S180 110 200 90M60 0C70 30 50 50 80 70" fill="none" stroke="#D9D4CB" strokeWidth={1.4} />
        <path d="M0 140C30 130 50 150 80 140" fill="none" stroke="#E3DED6" strokeWidth={1} />
      </pattern>
      <pattern id="fl-cemento" width={80} height={80} patternUnits="userSpaceOnUse">
        <rect width={80} height={80} fill="#C4C1BB" />
        {[[10, 12], [50, 8], [30, 40], [70, 52], [16, 66], [58, 30], [40, 70]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.2} fill="rgba(0,0,0,0.12)" />)}
        <path d="M0 0H80V80" fill="none" stroke="rgba(0,0,0,0.08)" />
      </pattern>
      <pattern id="fl-adoquin" width={40} height={40} patternUnits="userSpaceOnUse">
        <rect width={40} height={40} fill="#A79F93" />
        <rect x={1} y={1} width={38} height={18} rx={3} fill="#BBB3A7" />
        <rect x={-19} y={21} width={38} height={18} rx={3} fill="#B3AB9F" />
        <rect x={21} y={21} width={38} height={18} rx={3} fill="#C0B8AC" />
      </pattern>
      <pattern id="fl-cesped" width={24} height={24} patternUnits="userSpaceOnUse">
        <rect width={24} height={24} fill="#8DB665" />
        <path d="M3 6l1-4M10 14l1-4M18 8l-1-4M6 21l1-4M20 20l1-4M14 3l-1-3" stroke="#77A251" strokeWidth={1.4} strokeLinecap="round" />
      </pattern>
      <pattern id="grain" width={60} height={12} patternUnits="userSpaceOnUse">
        <path d="M0 3C15 1 30 5 60 3M0 9C20 11 40 7 60 9" fill="none" stroke="rgba(60,30,10,0.14)" strokeWidth={1} />
      </pattern>
      <linearGradient id="mat-madera" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#D8AA74" /><stop offset="1" stopColor="#B07B46" /></linearGradient>
      <linearGradient id="mat-nogal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#80522F" /><stop offset="1" stopColor="#56341C" /></linearGradient>
      <radialGradient id="mat-marmol" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#DCD8D0" /></radialGradient>
      <linearGradient id="mat-negra" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3A3735" /><stop offset="1" stopColor="#1B1A19" /></linearGradient>
      <linearGradient id="mat-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E6E9EB" /><stop offset="1" stopColor="#A1A7AB" /></linearGradient>
      <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E3E6E8" /><stop offset="1" stopColor="#B2B8BC" /></linearGradient>
    </defs>
  );
}

function Chair({ c, style, color }) {
  const deg = (c.a * 180) / Math.PI + 90;
  const dark = shade(color, -0.25);
  return (
    <g transform={`translate(${c.x} ${c.y}) rotate(${deg})`} filter="url(#fp-sh-soft)">
      {style === 'taburete' && (<><circle r={8} fill={color} /><circle r={4.5} fill="none" stroke={dark} strokeWidth={1.5} /></>)}
      {style === 'sillon' && (
        <>
          <rect x={-12} y={-9} width={24} height={20} rx={7} fill={color} />
          <rect x={-12} y={5} width={24} height={7} rx={3.5} fill={dark} />
          <rect x={-12} y={-7} width={5} height={16} rx={2.5} fill={dark} />
          <rect x={7} y={-7} width={5} height={16} rx={2.5} fill={dark} />
        </>
      )}
      {style !== 'taburete' && style !== 'sillon' && (
        <>
          <rect x={-8.5} y={-8} width={17} height={14} rx={4} fill={color} />
          <rect x={-9.5} y={5} width={19} height={5} rx={2.5} fill={dark} />
        </>
      )}
    </g>
  );
}

// Booth seating: one padded bench along each side that has seats.
function Benches({ t, W, H, color }) {
  const sides = [...new Set(chairsFor(t).map((c) => c.side))];
  const dark = shade(color, -0.25);
  const L = TABLE_INSET - 6;
  return sides.map((s) => {
    const hor = s === 'top' || s === 'bottom';
    const len = (hor ? W : H) - TABLE_INSET * 2 + 10;
    const x = hor ? TABLE_INSET - 5 : s === 'left' ? -4 : W - L - 2;
    const y = hor ? (s === 'top' ? -4 : H - L - 2) : TABLE_INSET - 5;
    const w = hor ? len : L + 6;
    const h = hor ? L + 6 : len;
    const back = hor ? [x, s === 'top' ? y : y + h - 5, w, 5] : [s === 'left' ? x : x + w - 5, y, 5, h];
    return (
      <g key={s} filter="url(#fp-sh-soft)">
        <rect x={x} y={y} width={w} height={h} rx={5} fill={color} />
        <rect x={back[0]} y={back[1]} width={back[2]} height={back[3]} rx={2.5} fill={dark} />
      </g>
    );
  });
}

function TableTop({ shape, W, H, material }) {
  const i = TABLE_INSET;
  const fill = material === 'mantel' ? '#FFFFFF' : `url(#mat-${material || 'madera'})`;
  const stroke = material === 'mantel' ? '#E2DCD0' : 'rgba(0,0,0,0.18)';
  const top = shape === 'round'
    ? (p) => <ellipse cx={W / 2} cy={H / 2} rx={W / 2 - i} ry={H / 2 - i} {...p} />
    : (p) => <rect x={i} y={i} width={W - i * 2} height={H - i * 2} rx={6} {...p} />;
  return (
    <g filter="url(#fp-sh)">
      {top({ fill, stroke, strokeWidth: 1 })}
      {(material === 'madera' || material === 'nogal' || !material) && top({ fill: 'url(#grain)' })}
      {material === 'mantel' && (shape === 'round'
        ? <ellipse cx={W / 2} cy={H / 2} rx={W / 2 - i - 4} ry={H / 2 - i - 4} fill="none" stroke="#EDE8DF" strokeDasharray="3 3" />
        : <rect x={i + 4} y={i + 4} width={W - i * 2 - 8} height={H - i * 2 - 8} rx={3} fill="none" stroke="#EDE8DF" strokeDasharray="3 3" />)}
      {material === 'marmol' && top({ fill: 'none', stroke: 'rgba(170,160,150,0.35)', strokeWidth: 0.8, strokeDasharray: '30 12 8 20' })}
    </g>
  );
}

function Plates({ chairs, W, H }) {
  return chairs.map((c, k) => {
    const dx = Math.cos(c.a);
    const dy = Math.sin(c.a);
    const x = c.x + dx * 17;
    const y = c.y + dy * 17;
    if (x < TABLE_INSET || x > W - TABLE_INSET || y < TABLE_INSET || y > H - TABLE_INSET) return null;
    return (
      <g key={k}>
        <circle cx={x} cy={y} r={7} fill="#FFFFFF" stroke="#D8D2C7" strokeWidth={1} />
        <circle cx={x} cy={y} r={4.2} fill="none" stroke="#E6E1D8" strokeWidth={1} />
        <circle cx={x - dy * 10 + dx * 4} cy={y + dx * 10 + dy * 4} r={2.4} fill="rgba(210,230,240,0.9)" stroke="#B9CBD3" strokeWidth={0.8} />
      </g>
    );
  });
}

export function Decor({ i, W, H }) {
  const d = DECOR[i.type] || DECOR.column;
  const c = i.color || d.color;
  const label = i.label ?? d.text;
  const txt = (size, fill, y = H / 2) => label ? <text x={W / 2} y={y} textAnchor="middle" dominantBaseline="central" style={{ fill, fontSize: size, fontWeight: 700, pointerEvents: 'none', letterSpacing: '0.02em' }}>{label}</text> : null;
  const m = Math.min(W, H);
  switch (i.type) {
    case 'wall':
      return <rect width={W} height={H} fill={c} />;
    case 'window':
      return <g><rect width={W} height={H} fill="#EAF5FA" stroke={c} strokeWidth={2} /><line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={c} strokeWidth={1.5} /></g>;
    case 'door':
      return (
        <g>
          <rect width={W} height={5} fill="#3A3632" />
          <path d={`M${W} 4A${W} ${H - 4} 0 0 1 4 ${H}L4 4Z`} fill={shade(c, 0.85)} stroke={c} strokeWidth={1.2} strokeDasharray="4 3" />
          <rect x={0} y={4} width={5} height={H - 4} rx={1.5} fill={c} />
        </g>
      );
    case 'column':
      return <g filter="url(#fp-sh)"><rect width={W} height={H} rx={3} fill={c} /><rect x={4} y={4} width={W - 8} height={H - 8} rx={2} fill={shade(c, 0.2)} /></g>;
    case 'stairs': {
      const n = Math.max(3, Math.floor((H > W ? H : W) / 12));
      return (
        <g>
          <rect width={W} height={H} fill={c} stroke={shade(c, -0.3)} />
          {Array.from({ length: n }, (_, k) => (H > W
            ? <line key={k} x1={0} x2={W} y1={(k + 1) * (H / (n + 1))} y2={(k + 1) * (H / (n + 1))} stroke={shade(c, -0.3)} />
            : <line key={k} y1={0} y2={H} x1={(k + 1) * (W / (n + 1))} x2={(k + 1) * (W / (n + 1))} stroke={shade(c, -0.3)} />))}
          <path d={H > W ? `M${W / 2} ${H - 8}V10M${W / 2 - 6} 18L${W / 2} 10L${W / 2 + 6} 18` : `M8 ${H / 2}H${W - 10}M${W - 18} ${H / 2 - 6}L${W - 10} ${H / 2}L${W - 18} ${H / 2 + 6}`} stroke="#3A3632" strokeWidth={2} fill="none" />
        </g>
      );
    }
    case 'bar': {
      const ch = H * 0.52;
      const n = Math.max(1, Math.floor(W / 34));
      return (
        <g>
          <g filter="url(#fp-sh)">
            <rect width={W} height={ch} rx={5} fill={c} />
            <rect x={4} y={4} width={Math.max(0, W - 8)} height={Math.max(0, ch - 8)} rx={3} fill={shade(c, 0.12)} />
            <rect x={4} y={4} width={Math.max(0, W - 8)} height={Math.max(0, ch - 8)} rx={3} fill="url(#grain)" />
          </g>
          {txt(13, '#FFFFFF', ch / 2)}
          {Array.from({ length: n }, (_, k) => (
            <g key={k} filter="url(#fp-sh-soft)">
              <circle cx={(k + 0.5) * (W / n)} cy={ch + (H - ch) / 2} r={8} fill="#2B2B2B" />
              <circle cx={(k + 0.5) * (W / n)} cy={ch + (H - ch) / 2} r={4.5} fill="none" stroke="#555" strokeWidth={1.4} />
            </g>
          ))}
        </g>
      );
    }
    case 'kitchen':
      return (
        <g filter="url(#fp-sh)">
          <rect width={W} height={H} rx={4} fill="url(#steel)" stroke={shade(c, -0.3)} />
          {[[0.18, 0.28], [0.38, 0.28], [0.18, 0.62], [0.38, 0.62]].map(([px, py]) => <g key={`${px}${py}`}><circle cx={W * px} cy={H * py} r={Math.min(9, m * 0.12)} fill="#3A3A3A" /><circle cx={W * px} cy={H * py} r={Math.min(5, m * 0.07)} fill="none" stroke="#777" /></g>)}
          <rect x={W * 0.55} y={H * 0.15} width={W * 0.38} height={H * 0.7} rx={4} fill="rgba(255,255,255,0.45)" stroke="rgba(0,0,0,0.15)" />
          {label && <text x={W * 0.74} y={H / 2} textAnchor="middle" dominantBaseline="central" style={{ fill: '#3A3A3A', fontSize: 12, fontWeight: 800, pointerEvents: 'none' }}>{label}</text>}
        </g>
      );
    case 'register':
      return <g filter="url(#fp-sh)"><rect width={W} height={H} rx={4} fill={c} /><rect x={6} y={5} width={Math.min(26, W * 0.4)} height={H - 10} rx={2} fill="#7FB4D6" />{label && <text x={W * 0.68} y={H / 2} textAnchor="middle" dominantBaseline="central" style={{ fill: '#fff', fontSize: 11, fontWeight: 800 }}>{label}</text>}</g>;
    case 'shelf': {
      const n = Math.max(2, Math.floor(W / 9));
      return <g filter="url(#fp-sh-soft)"><rect width={W} height={H} rx={2} fill={c} />{Array.from({ length: n }, (_, k) => <circle key={k} cx={(k + 0.5) * (W / n)} cy={H / 2} r={Math.min(3.5, H / 3)} fill={['#2F5D46', '#6B2B2B', '#C9A44C', '#2F4F5D'][k % 4]} />)}</g>;
    }
    case 'wc':
      return (
        <g>
          <rect width={W} height={H} fill={c} stroke={shade(c, -0.3)} strokeWidth={2} />
          {Array.from({ length: Math.floor(W / 16) }, (_, k) => <line key={`v${k}`} x1={(k + 1) * 16} x2={(k + 1) * 16} y1={0} y2={H} stroke="rgba(255,255,255,0.8)" />)}
          {Array.from({ length: Math.floor(H / 16) }, (_, k) => <line key={`h${k}`} y1={(k + 1) * 16} y2={(k + 1) * 16} x1={0} x2={W} stroke="rgba(255,255,255,0.8)" />)}
          <g transform={`translate(${W / 2 - 9} ${H / 2 - 20})`}><circle cx={4} cy={3} r={2.6} fill="#3E5C76" /><circle cx={14} cy={3} r={2.6} fill="#B5482E" /><rect x={1.5} y={7} width={5} height={9} rx={2} fill="#3E5C76" /><path d="M14 7l4 9h-8z" fill="#B5482E" /></g>
          {txt(12, '#3E5C76', H / 2 + 10)}
        </g>
      );
    case 'plant':
    case 'tree': {
      const r = m / 2;
      const leaves = i.type === 'tree' ? 9 : 7;
      return (
        <g filter="url(#fp-sh)">
          {i.type === 'plant' && <circle cx={W / 2} cy={H / 2} r={r * 0.62} fill="#A0673E" />}
          {Array.from({ length: leaves }, (_, k) => {
            const a = (k / leaves) * Math.PI * 2;
            return <circle key={k} cx={W / 2 + Math.cos(a) * r * 0.48} cy={H / 2 + Math.sin(a) * r * 0.48} r={r * 0.46} fill={k % 2 ? c : shade(c, 0.18)} />;
          })}
          <circle cx={W / 2} cy={H / 2} r={r * 0.42} fill={shade(c, -0.12)} />
          <circle cx={W / 2 - r * 0.15} cy={H / 2 - r * 0.15} r={r * 0.18} fill={shade(c, 0.3)} opacity={0.7} />
        </g>
      );
    }
    case 'planter': {
      const n = Math.max(2, Math.floor(W / (H * 0.9)));
      return <g filter="url(#fp-sh-soft)"><rect width={W} height={H} rx={3} fill={c} />{Array.from({ length: n }, (_, k) => <circle key={k} cx={(k + 0.5) * (W / n)} cy={H / 2} r={H * 0.42} fill={k % 2 ? '#5E8C4A' : '#6E9E58'} />)}</g>;
    }
    case 'rug':
      return (
        <g>
          <rect width={W} height={H} rx={3} fill={c} />
          <rect x={7} y={7} width={W - 14} height={H - 14} rx={2} fill="none" stroke={shade(c, 0.35)} strokeWidth={2.5} />
          <rect x={14} y={14} width={W - 28} height={H - 28} rx={2} fill="none" stroke={shade(c, -0.2)} strokeWidth={1.5} strokeDasharray="6 4" />
          <path d={`M${W / 2} 22L${W - 26} ${H / 2}L${W / 2} ${H - 22}L26 ${H / 2}Z`} fill="none" stroke={shade(c, 0.35)} strokeWidth={1.5} />
        </g>
      );
    case 'sofa':
      return (
        <g filter="url(#fp-sh)">
          <rect width={W} height={H} rx={9} fill={c} />
          <rect width={W} height={H * 0.34} rx={7} fill={shade(c, -0.18)} />
          <rect width={11} height={H} rx={5.5} fill={shade(c, -0.12)} />
          <rect x={W - 11} width={11} height={H} rx={5.5} fill={shade(c, -0.12)} />
          {(() => {
            const n = Math.max(1, Math.round((W - 22) / 40) - 1);
            return Array.from({ length: n }, (_, k) => <line key={k} x1={11 + ((k + 1) * (W - 22)) / (n + 1)} x2={11 + ((k + 1) * (W - 22)) / (n + 1)} y1={H * 0.36} y2={H - 4} stroke={shade(c, -0.2)} />);
          })()}
        </g>
      );
    case 'fireplace':
      return (
        <g filter="url(#fp-sh)">
          <rect width={W} height={H} rx={2} fill={c} />
          <rect x={W * 0.2} y={H * 0.25} width={W * 0.6} height={H * 0.55} rx={3} fill="#2A1A12" />
          <ellipse cx={W / 2} cy={H * 0.55} rx={W * 0.16} ry={H * 0.2} fill="#F28C28" />
          <ellipse cx={W / 2} cy={H * 0.6} rx={W * 0.08} ry={H * 0.12} fill="#FFD25A" />
        </g>
      );
    case 'piano':
      return (
        <g filter="url(#fp-sh)">
          <path d={`M0 0H${W * 0.55}C${W * 0.95} 0 ${W} ${H * 0.35} ${W} ${H * 0.6}C${W} ${H * 0.9} ${W * 0.8} ${H} ${W * 0.6} ${H}H0Z`} fill={c} />
          <rect x={0} y={0} width={10} height={H} fill="#F8F6F1" />
          {Array.from({ length: Math.floor(H / 6) }, (_, k) => <line key={k} x1={4} x2={10} y1={k * 6 + 3} y2={k * 6 + 3} stroke="#1E1E1E" strokeWidth={2} />)}
        </g>
      );
    case 'stage':
      return (
        <g filter="url(#fp-sh)">
          <rect width={W} height={H} rx={3} fill={c} />
          {Array.from({ length: Math.floor(H / 12) }, (_, k) => <line key={k} x1={0} x2={W} y1={(k + 1) * 12} y2={(k + 1) * 12} stroke={shade(c, -0.18)} />)}
          {txt(15, '#FFFFFF')}
        </g>
      );
    case 'tv':
      return <rect width={W} height={H} rx={2} fill={c} filter="url(#fp-sh-soft)" />;
    case 'screen': {
      const n = Math.max(3, Math.round(W / 18));
      const pts = Array.from({ length: n + 1 }, (_, k) => `${(k * W) / n},${k % 2 ? H : 0}`).join(' ');
      return <polyline points={pts} fill="none" stroke={c} strokeWidth={4} strokeLinejoin="round" filter="url(#fp-sh-soft)" />;
    }
    case 'umbrella': {
      const r = m / 2;
      return (
        <g filter="url(#fp-sh)" opacity={0.95}>
          {Array.from({ length: 8 }, (_, k) => {
            const a1 = (k / 8) * Math.PI * 2;
            const a2 = ((k + 1) / 8) * Math.PI * 2;
            return <path key={k} d={`M${W / 2} ${H / 2}L${W / 2 + Math.cos(a1) * r} ${H / 2 + Math.sin(a1) * r}L${W / 2 + Math.cos(a2) * r} ${H / 2 + Math.sin(a2) * r}Z`} fill={k % 2 ? c : shade(c, -0.1)} />;
          })}
          <circle cx={W / 2} cy={H / 2} r={3} fill={shade(c, -0.4)} />
        </g>
      );
    }
    case 'heater':
      return <g filter="url(#fp-sh)"><circle cx={W / 2} cy={H / 2} r={m / 2 - 1} fill={c} /><circle cx={W / 2} cy={H / 2} r={m / 2 - 6} fill="none" stroke="#F28C28" strokeWidth={2.5} /><circle cx={W / 2} cy={H / 2} r={3} fill="#3A3A3A" /></g>;
    case 'fence':
      return <g><rect y={H / 2 - 2} width={W} height={4} fill={c} />{Array.from({ length: Math.floor(W / 20) + 1 }, (_, k) => <rect key={k} x={Math.min(k * 20, W - 6)} y={0} width={6} height={H} rx={1} fill={shade(c, -0.15)} />)}</g>;
    case 'area':
      return <g><rect width={W} height={H} rx={10} fill={c} fillOpacity={0.28} stroke={c} strokeWidth={2} strokeDasharray="8 6" />{txt(14, shade(c, -0.55))}</g>;
    case 'text':
      return label ? <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central" style={{ fill: c, fontSize: Math.max(10, H * 0.55), fontWeight: 800, pointerEvents: 'none' }}>{label}</text> : null;
    default:
      return <rect width={W} height={H} rx={4} fill={c} />;
  }
}

const UNDER = ['rug', 'area', 'stage'];
const placed = (x, y, w, h, rot) => {
  const b = boxOf(w, h, rot);
  return `translate(${x * CELL + (b.w * CELL) / 2} ${y * CELL + (b.h * CELL) / 2}) rotate(${Number(rot) || 0}) translate(${(-w * CELL) / 2} ${(-h * CELL) / 2})`;
};

// One zone of the dining room drawn from above, to scale: floor, walls, furniture and tables with their
// chairs. In edit mode pieces are dragged on a grid; otherwise tables are buttons, marked by `look`
// (a coloured ring and a name tag for booked or seated tables).
export default function FloorPlan({ zone, height, tables, items, editable, selected, onSelect, onMove, onDragStart, look, onTableClick, zoom = 1, snap = 0.5, grid = true }) {
  const svg = useRef(null);
  const drag = useRef(null);
  const W = zone.w * CELL;
  const H = height * CELL;
  const walls = zone.walls !== false;

  const toCells = (e) => {
    const p = svg.current.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.current.getScreenCTM().inverse());
    return { x: q.x / CELL, y: q.y / CELL };
  };
  const round = (v) => Math.round(v / snap) * snap;

  const startDrag = (e, kind, key, x, y, w) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.({ kind, key });
    onDragStart?.();
    drag.current = { kind, key, x, y, w, from: toCells(e) };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* the pointer is already gone */ }
  };
  const moveDrag = (e) => {
    const d = drag.current;
    if (!d) return;
    const at = toCells(e);
    const x = Math.min(Math.max(0, round(d.x + at.x - d.from.x)), Math.max(0, zone.w - d.w));
    const y = Math.max(0, round(d.y + at.y - d.from.y));
    if (x !== d.lastX || y !== d.lastY) {
      d.lastX = x;
      d.lastY = y;
      onMove?.(d.kind, d.key, x, y);
    }
  };
  const endDrag = () => { drag.current = null; };
  const handlers = (kind, key, x, y, w) => (editable ? {
    onPointerDown: (e) => startDrag(e, kind, key, x, y, w),
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    style: { cursor: 'grab', touchAction: 'none' },
  } : {});
  const isSel = (kind, key) => selected && selected.kind === kind && String(selected.key) === String(key);

  const zoneItems = items.filter((i) => i.zone === zone.name);
  const drawItem = (i) => {
    const d = DECOR[i.type] || DECOR.column;
    const w = i.w || d.w;
    const h = i.h || d.h;
    const b = boxOf(w, h, i.rot);
    const sel = isSel('item', i.id);
    return (
      <g key={i.id} {...handlers('item', i.id, i.x, i.y, b.w)}>
        <g transform={placed(i.x, i.y, w, h, i.rot)}>
          <Decor i={i} W={w * CELL} H={h * CELL} />
          {editable && <rect width={w * CELL} height={h * CELL} fill="transparent" />}
          {sel && <rect x={-5} y={-5} width={w * CELL + 10} height={h * CELL + 10} rx={8} fill="none" stroke="#111" strokeWidth={2.5} strokeDasharray="6 5" />}
        </g>
      </g>
    );
  };

  return (
    <div style={{ overflowX: 'auto', borderRadius: 20, background: '#2A2724', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', width: `${zoom * 100}%`, height: 'auto' }}
        onPointerDown={() => editable && onSelect?.(null)}
        role="img"
        aria-label={`Plano de ${zone.name}`}
      >
        <Defs />
        <rect width={W} height={H} fill={`url(#fl-${zone.floor || (zone.outdoor ? 'tarima' : 'parquet')})`} />
        {editable && grid && (
          <g pointerEvents="none">
            {Array.from({ length: zone.w + 1 }, (_, k) => <line key={`v${k}`} x1={k * CELL} y1={0} x2={k * CELL} y2={H} stroke="rgba(255,255,255,0.35)" strokeWidth={0.8} />)}
            {Array.from({ length: height + 1 }, (_, k) => <line key={`h${k}`} x1={0} y1={k * CELL} x2={W} y2={k * CELL} stroke="rgba(255,255,255,0.35)" strokeWidth={0.8} />)}
          </g>
        )}
        {walls && <rect x={5} y={5} width={W - 10} height={H - 10} fill="none" stroke="#3A3632" strokeWidth={10} pointerEvents="none" />}

        {zoneItems.filter((i) => UNDER.includes(i.type)).map(drawItem)}
        {zoneItems.filter((i) => !UNDER.includes(i.type) && i.type !== 'umbrella').map(drawItem)}
        {zoneItems.filter((i) => i.type === 'umbrella').map(drawItem)}

        {tables.filter((t) => zoneOf(t) === zone.name).map((t) => {
          const { w, h, shape } = tableSize(t);
          const b = boxOf(w, h, t.rot);
          const Wt = w * CELL;
          const Ht = h * CELL;
          const sel = isSel('table', t.table_number);
          const l = look?.(t) || {};
          const chairs = chairsFor(t);
          const style = t.chairs || 'silla';
          const color = t.chairColor || '#A57A52';
          const click = !editable && onTableClick ? {
            onClick: () => onTableClick(t),
            onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTableClick(t); } },
            role: 'button',
            tabIndex: 0,
            'aria-label': `Mesa ${t.table_number}${l.badge ? `, ${l.badge}` : ''}`,
            style: { cursor: 'pointer', outline: 'none' },
          } : {};
          const ring = sel ? '#D4F25C' : l.ring;
          const cx = b.w * CELL / 2;
          const cy = b.h * CELL / 2;
          return (
            <g key={t.table_number} {...handlers('table', t.table_number, t.x, t.y, b.w)} {...click} opacity={l.dim ? 0.45 : 1}>
              <g transform={placed(t.x, t.y, w, h, t.rot)}>
                {editable && <rect width={Wt} height={Ht} fill="transparent" />}
                {ring && (shape === 'round'
                  ? <ellipse cx={Wt / 2} cy={Ht / 2} rx={Wt / 2 - 3} ry={Ht / 2 - 3} fill={ring} fillOpacity={0.22} stroke={ring} strokeWidth={4} />
                  : <rect x={3} y={3} width={Wt - 6} height={Ht - 6} rx={14} fill={ring} fillOpacity={0.22} stroke={ring} strokeWidth={4} />)}
                {style === 'banco' && shape !== 'round'
                  ? <Benches t={t} W={Wt} H={Ht} color={color} />
                  : style !== 'ninguna' && chairs.map((c, k) => <Chair key={k} c={c} style={style} color={color} />)}
                <TableTop shape={shape} W={Wt} H={Ht} material={t.material} />
                {zone.plates !== false && style !== 'ninguna' && <Plates chairs={chairs} W={Wt} H={Ht} />}
              </g>
              <g transform={`translate(${t.x * CELL + cx} ${t.y * CELL + cy})`} pointerEvents="none">
                <circle r={13} fill="rgba(255,255,255,0.94)" stroke="rgba(0,0,0,0.18)" />
                <text textAnchor="middle" dominantBaseline="central" style={{ fill: '#111', fontSize: 14, fontWeight: 800 }}>{t.table_number}</text>
                {(l.badge || t.name) && (() => {
                  const text = String(l.badge || t.name).slice(0, 14);
                  const bw = Math.max(30, text.length * 6.4 + 12);
                  return (
                    <g transform="translate(0 22)">
                      <rect x={-bw / 2} y={-8} width={bw} height={16} rx={8} fill={l.badgeBg || 'rgba(17,17,17,0.82)'} />
                      <text textAnchor="middle" dominantBaseline="central" style={{ fill: l.badgeFg || '#fff', fontSize: 10.5, fontWeight: 700 }}>{text}</text>
                    </g>
                  );
                })()}
                {t.online === false && <g transform="translate(13 -13)"><circle r={6} fill="#6B6862" /><text textAnchor="middle" dominantBaseline="central" style={{ fill: '#fff', fontSize: 8, fontWeight: 800 }}>L</text></g>}
              </g>
              {sel && <rect x={t.x * CELL - 3} y={t.y * CELL - 3} width={b.w * CELL + 6} height={b.h * CELL + 6} rx={12} fill="none" stroke="#111" strokeWidth={2.5} strokeDasharray="6 5" pointerEvents="none" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Small drawings for the "add" menus.
export function DecorPreview({ type }) {
  const d = DECOR[type];
  const s = 40 / Math.max(d.w, d.h, 1);
  const w = d.w * s;
  const h = Math.max(d.h * s, 4);
  return (
    <svg viewBox={`-4 -4 ${CELL + 8} ${CELL + 8}`} width={34} height={34} aria-hidden="true">
      <g transform={`translate(${(CELL - w) / 2} ${(CELL - h) / 2})`}><Decor i={{ type, label: type === 'text' ? 'Aa' : '' }} W={w} H={h} /></g>
    </svg>
  );
}

export function TablePreview({ t }) {
  const { w, h, shape } = tableSize(t);
  const Wt = w * CELL;
  const Ht = h * CELL;
  const chairs = chairsFor(t);
  const style = t.chairs || 'silla';
  return (
    <svg viewBox={`-4 -4 ${Math.max(Wt, Ht) + 8} ${Math.max(Wt, Ht) + 8}`} width={40} height={40} aria-hidden="true">
      <g transform={`translate(${(Math.max(Wt, Ht) - Wt) / 2} ${(Math.max(Wt, Ht) - Ht) / 2})`}>
        {style === 'banco' && shape !== 'round' ? <Benches t={t} W={Wt} H={Ht} color={t.chairColor || '#A57A52'} /> : chairs.map((c, k) => <Chair key={k} c={c} style={style} color={t.chairColor || '#A57A52'} />)}
        <TableTop shape={shape} W={Wt} H={Ht} material={t.material} />
      </g>
    </svg>
  );
}
