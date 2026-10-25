import { normalize } from './format.js';

export const CATEGORIES = [
  { key: 'rest', label: 'Comer', match: ['rest', 'bar', 'cafe'], icon: 'utensils' },
  { key: 'pan', label: 'Panaderías', match: ['pan', 'horno', 'paste'], icon: 'croissant' },
  { key: 'pel', label: 'Belleza', match: ['pelu', 'barb', 'estet', 'belle'], icon: 'scissors' },
  { key: 'music', label: 'Música', match: ['disc', 'music', 'beat', 'estudio'], icon: 'music' },
  { key: 'serv', label: 'Servicios', match: ['serv', 'repar', 'escay'], icon: 'wrench' },
  { key: 'shop', label: 'Tiendas', match: ['comer', 'tienda', 'moda'], icon: 'bag' },
];

export const categoryOf = (biz) => {
  const c = normalize(biz?.category);
  return CATEGORIES.find((cat) => cat.match.some((m) => c.includes(m))) || CATEGORIES[CATEGORIES.length - 1];
};

export const kindOf = (biz) => {
  const key = categoryOf(biz).key;
  if (key === 'rest') return 'restaurant';
  if (key === 'music') return 'music';
  if (key === 'pel') return 'beauty';
  return 'shop';
};

// One line under each business in lists, matching what you can do there.
export const taglineFor = (biz) => ({
  restaurant: 'Carta y reserva de mesa',
  beauty: 'Reserva tu cita online',
  music: 'Escucha sus beats',
}[kindOf(biz)] || 'Catálogo y contacto');
