const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export const money = (n) => euro.format(Number(n) || 0);

export const normalize = (s) =>
  String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const sameName = (a, b) => normalize(a) === normalize(b);

export const initials = (name) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'NW';
  if (/^\d/.test(words[0])) return words[0].slice(0, 2);
  return (words[0][0] + (words[1]?.[0] || words[0][1] || '')).toUpperCase();
};

const TONES = ['#B5482E', '#2F5D46', '#1E2A4A', '#8E2B2B', '#4B3FD1', '#C26A1B', '#3E5C76', '#6B4E9B'];
export const toneFor = (name) => {
  let h = 0;
  for (const ch of normalize(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
};

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const nowTime = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

export const longDate = (d = new Date()) =>
  d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

export const timeAgo = (iso) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 14) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
};

export const duration = (min) => {
  const m = Math.round(Number(min) || 0);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
};

export const timeToMinutes = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const minutesToTime = (m) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
