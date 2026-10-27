import { normalize } from './format.js';

// Every kind of business NetWish knows. `engine` picks the panel and the public page:
//   restaurant · reservas de mesa, carta y sala
//   beauty     · citas con servicios de duración (peluquería, estética, fisio, taller…)
//   shop       · catálogo con fotos, stock y pedidos para recoger en el local
//   classes    · horario semanal de clases con plazas
//   taxi       · viajes y traslados con hora
//   music      · catálogo de beats (el antiguo de NetWish)
// `match`: words a category starts with, checked in this order, so the specific ones go first
// ("Barbería" must find the barber before "bar" finds a restaurant). The sign-up list sorts them apart.
// `shop` options: sizes/colours, units by weight, daily counter stock, orders made in advance.
export const BUSINESS_TYPES = [
  {
    key: 'mascotas', label: 'Peluquería canina o veterinario', icon: 'paw', category: 'Peluquería canina', engine: 'beauty', cat: 'salud',
    match: ['canin', 'mascot', 'veterin', 'perr'],
    pitch: 'Citas por servicio y tamaño del perro', noun: { list: 'Servicios', item: 'servicio', book: 'Pedir cita' },
  },
  {
    key: 'belleza', label: 'Peluquería o barbería', icon: 'scissors', category: 'Peluquería', engine: 'beauty', cat: 'pel',
    match: ['pelu', 'barb'],
    pitch: 'Citas online con tus servicios, horario y equipo', noun: { list: 'Servicios', item: 'servicio', book: 'Pedir cita' }, hair: true,
  },
  {
    key: 'restaurante', label: 'Restaurante, bar o cafetería', icon: 'utensils', category: 'Restaurante', engine: 'restaurant', cat: 'rest',
    match: ['restaur', 'asador', 'taberna', 'meson', 'cafeter', 'bar', 'cafe', 'gastro', 'tapas', 'pizzer', 'cervec'],
    pitch: 'Reservas de mesa, carta, sala y clientes',
  },
  {
    key: 'estetica', label: 'Estética, uñas o spa', icon: 'sparkle', category: 'Estética', engine: 'beauty', cat: 'pel',
    match: ['estet', 'belle', 'unas', 'manicur', 'spa', 'depil', 'masaj', 'cejas', 'pestan', 'tatu', 'bronce'],
    pitch: 'Citas por tratamiento, con duración y profesional', noun: { list: 'Tratamientos', item: 'tratamiento', book: 'Pedir cita' },
  },
  {
    key: 'salud', label: 'Fisioterapia, clínica o consulta', icon: 'pulse', category: 'Fisioterapia', engine: 'beauty', cat: 'salud',
    match: ['fisio', 'salud', 'clinic', 'dent', 'podolog', 'psicolog', 'nutric', 'osteo', 'logoped', 'optic', 'quiro', 'medic'],
    pitch: 'Citas por sesión y profesional, con recordatorio', noun: { list: 'Sesiones y tratamientos', item: 'sesión', book: 'Pedir cita' },
  },
  {
    key: 'clases', label: 'Gimnasio, yoga, baile o academia', icon: 'dumbbell', category: 'Gimnasio y clases', engine: 'classes', cat: 'clases',
    match: ['gimnas', 'gym', 'yoga', 'pilates', 'academ', 'clase', 'deport', 'danza', 'baile', 'crossfit', 'escuela', 'box', 'artes', 'idioma', 'musica y clases'],
    pitch: 'Horario de clases con plazas y reservas',
  },
  {
    key: 'moda', label: 'Tienda de ropa o calzado', icon: 'shirt', category: 'Tienda de ropa', engine: 'shop', cat: 'moda',
    match: ['moda', 'ropa', 'calzad', 'zapat', 'boutique', 'textil', 'lencer', 'complement', 'joyer', 'bols'],
    pitch: 'Catálogo con fotos, tallas y colores; compra y recoge en tienda',
    shop: { variants: true, prep: 60, noun: 'Catálogo', verb: 'Reservar y recoger' },
  },
  {
    key: 'panaderia', label: 'Panadería o pastelería', icon: 'croissant', category: 'Panadería', engine: 'shop', cat: 'pan',
    match: ['panad', 'pan', 'horno', 'paste', 'obrador', 'confit', 'dulce', 'bolleri', 'churrer'],
    pitch: 'Mostrador del día con fotos, encargos y hornadas',
    shop: { daily: true, batches: true, preorder: true, prep: 15, noun: 'Productos', verb: 'Encargar y recoger' },
  },
  {
    key: 'alimentacion', label: 'Carnicería, frutería o charcutería', icon: 'basket', category: 'Carnicería', engine: 'shop', cat: 'alim',
    match: ['carni', 'charcu', 'fruter', 'pescad', 'aliment', 'ultramar', 'queser', 'gourmet', 'delicat', 'super', 'tienda de barrio', 'casqueri', 'polleri', 'vinoteca', 'bodega'],
    pitch: 'Encargos para recoger, género del día y precios por kilo',
    shop: { daily: true, weight: true, preorder: true, prep: 30, noun: 'Productos', verb: 'Encargar y recoger' },
  },
  {
    key: 'floristeria', label: 'Floristería', icon: 'flower', category: 'Floristería', engine: 'shop', cat: 'shop',
    match: ['flor', 'planta', 'vivero', 'jardin'],
    pitch: 'Ramos y plantas con foto, encargos con fecha',
    shop: { preorder: true, prep: 60, noun: 'Ramos y plantas', verb: 'Encargar y recoger' },
  },
  {
    key: 'taller', label: 'Taller mecánico', icon: 'car', category: 'Taller mecánico', engine: 'beauty', cat: 'serv',
    match: ['taller', 'mecan', 'neumat', 'chapa', 'lavadero', 'itv', 'moto'],
    pitch: 'Citas para revisión, cambio de aceite, ruedas…', noun: { list: 'Servicios del taller', item: 'servicio', book: 'Pedir cita' }, car: true,
  },
  {
    key: 'taxi', label: 'Taxi o transporte', icon: 'taxi', category: 'Taxi', engine: 'taxi', cat: 'serv',
    match: ['taxi', 'vtc', 'transport', 'traslad', 'autobus', 'microbus'],
    pitch: 'Reserva de viajes y traslados con hora',
  },
  {
    key: 'musica', label: 'Discográfica o estudio de música', icon: 'music', category: 'Discográfica', engine: 'music', cat: 'music',
    match: ['disc', 'music', 'beat', 'estudio'], hidden: true,
  },
  {
    key: 'tienda', label: 'Otra tienda (regalos, librería, ferretería…)', icon: 'bag', category: 'Tienda', engine: 'shop', cat: 'shop',
    match: ['comer', 'tienda', 'libre', 'papel', 'regalo', 'ferret', 'jugue', 'bazar', 'deco', 'hogar', 'electro', 'informat', 'movil', 'telefon', 'bici', 'perfum', 'drogu', 'merceri', 'estanc'],
    pitch: 'Catálogo con fotos y stock; compra y recoge en tienda',
    shop: { prep: 30, noun: 'Catálogo', verb: 'Reservar y recoger' },
  },
  {
    key: 'servicios', label: 'Servicios y reparaciones', icon: 'wrench', category: 'Servicios', engine: 'beauty', cat: 'serv',
    match: ['serv', 'repar', 'escay', 'fontan', 'electric', 'limpiez', 'reform', 'pintor', 'cerraj', 'tintor', 'costur', 'arregl', 'foto'],
    pitch: 'Citas y presupuestos', noun: { list: 'Servicios', item: 'servicio', book: 'Pedir cita' },
  },
  { key: 'otro', label: 'Otro tipo de negocio', icon: 'store', category: 'Otro', other: true, engine: 'shop', cat: 'shop', match: [] },
];

// Before this list existed every unknown business showed its catalogue and a contact button.
const FALLBACK = { key: 'general', label: 'Comercio', icon: 'store', category: '', engine: 'shop', cat: 'shop', match: [], shop: { prep: 30, noun: 'Catálogo', verb: 'Reservar y recoger' } };

const words = (s) => normalize(s).split(/[^a-z0-9ñ]+/).filter(Boolean);

export function typeOf(biz) {
  const cat = normalize(biz?.category);
  if (!cat) return FALLBACK;
  const w = words(cat);
  for (const t of BUSINESS_TYPES) {
    if (t.match.some((m) => (m.includes(' ') ? cat.includes(m) : w.some((x) => x.startsWith(m))))) return t;
  }
  return FALLBACK;
}

export const typeByKey = (key) => BUSINESS_TYPES.find((t) => t.key === key) || FALLBACK;

// What a business calls the things it offers, for titles and buttons.
export const nounsOf = (biz) => {
  const t = typeOf(biz);
  if (t.engine === 'restaurant') return { list: 'Carta', item: 'plato' };
  if (t.engine === 'shop') return { list: t.shop?.noun || 'Catálogo', item: 'producto' };
  if (t.engine === 'classes') return { list: 'Clases', item: 'clase' };
  if (t.engine === 'taxi') return { list: 'Tarifas', item: 'tarifa' };
  if (t.engine === 'music') return { list: 'Catálogo', item: 'beat' };
  return t.noun || { list: 'Servicios', item: 'servicio', book: 'Pedir cita' };
};
