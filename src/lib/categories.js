import { typeOf } from './businessTypes.js';

// The directory's categories. Each business type belongs to one (businessTypes.js → cat).
export const CATEGORIES = [
  { key: 'rest', label: 'Comer', icon: 'utensils' },
  { key: 'pan', label: 'Pan y dulces', icon: 'croissant' },
  { key: 'alim', label: 'Alimentación', icon: 'basket' },
  { key: 'pel', label: 'Belleza', icon: 'scissors' },
  { key: 'moda', label: 'Moda', icon: 'shirt' },
  { key: 'shop', label: 'Tiendas', icon: 'bag' },
  { key: 'salud', label: 'Salud', icon: 'pulse' },
  { key: 'clases', label: 'Deporte y clases', icon: 'dumbbell' },
  { key: 'serv', label: 'Servicios', icon: 'wrench' },
  { key: 'music', label: 'Música', icon: 'music', hidden: true },
];

export const categoryOf = (biz) => {
  const key = typeOf(biz).cat;
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES.find((c) => c.key === 'shop');
};

// Which panel and public page a business gets. See businessTypes.js for the engines.
export const kindOf = (biz) => typeOf(biz).engine;

// One line under each business in lists, matching what you can do there.
export const taglineFor = (biz) => {
  const t = typeOf(biz);
  return ({
    restaurant: 'Carta y reserva de mesa',
    beauty: t.key === 'taller' ? 'Pide cita para tu coche' : 'Reserva tu cita online',
    classes: 'Horario de clases y reservas',
    taxi: 'Reserva tu viaje',
    music: 'Escucha sus beats',
  })[t.engine] || (t.shop?.daily ? 'Encarga y recoge en la tienda' : 'Catálogo y recogida en tienda');
};
