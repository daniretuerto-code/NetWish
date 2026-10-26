// Tags a restaurant puts on its customers. Allergies and intolerances show in red on every booking.
export const CUSTOMER_TAGS = ['VIP', 'Habitual', 'Alergia', 'Celíaco', 'Vegetariano', 'Vegano', 'Sin lactosa', 'Cumpleaños', 'Trona / carrito', 'Movilidad reducida', 'Prefiere terraza', 'Prefiere tranquilo', 'Mascota', 'Prensa', 'Amigo de la casa', 'No admitir'];

const ALLERGY = ['alergia', 'alergico', 'celiaco', 'sin gluten', 'sin lactosa', 'intoleran'];
export const isAllergyTag = (t) => ALLERGY.some((w) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(w));
