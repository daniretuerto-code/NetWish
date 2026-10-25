// Types offered at sign-up. Only the ready ones get a panel today; the rest leave
// their details so the team knows who is waiting for what.
export const BUSINESS_TYPES = [
  { key: 'restaurante', label: 'Restaurante, bar o cafetería', icon: 'utensils', category: 'Restaurante', ready: true },
  { key: 'belleza', label: 'Peluquería o estética', icon: 'scissors', category: 'Peluquería' },
  { key: 'tienda', label: 'Tienda', icon: 'bag', category: 'Tienda' },
  { key: 'panaderia', label: 'Panadería o pastelería', icon: 'croissant', category: 'Panadería' },
  { key: 'taxi', label: 'Taxi o transporte', icon: 'pin', category: 'Taxi' },
  { key: 'servicios', label: 'Servicios y reparaciones', icon: 'wrench', category: 'Servicios' },
  { key: 'otro', label: 'Otro tipo de negocio', icon: 'store', category: 'Otro', other: true },
];
