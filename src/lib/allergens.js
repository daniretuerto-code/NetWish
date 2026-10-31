// The 14 allergens a menu must declare (EU Regulation 1169/2011, RD 126/2015).
export const ALLERGENS = [
  ['gluten', 'Gluten', '🌾'],
  ['crustaceos', 'Crustáceos', '🦐'],
  ['huevo', 'Huevo', '🥚'],
  ['pescado', 'Pescado', '🐟'],
  ['cacahuetes', 'Cacahuetes', '🥜'],
  ['soja', 'Soja', '🫘'],
  ['lacteos', 'Lácteos', '🥛'],
  ['frutos_cascara', 'Frutos de cáscara', '🌰'],
  ['apio', 'Apio', '🥬'],
  ['mostaza', 'Mostaza', '🟡'],
  ['sesamo', 'Sésamo', '⚪'],
  ['sulfitos', 'Sulfitos', '🍷'],
  ['altramuces', 'Altramuces', '🫛'],
  ['moluscos', 'Moluscos', '🦪'],
];
const BY_KEY = Object.fromEntries(ALLERGENS.map(([k, label, icon]) => [k, { label, icon }]));
export const allergenInfo = (k) => BY_KEY[k] || { label: k, icon: '•' };
