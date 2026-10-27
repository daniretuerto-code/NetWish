// What a customer without an account typed last time, kept on this device only.
// Same keys as the restaurant booking sheet, so one form fills the others.
const GUEST_KEY = 'netwish.guest';
const PICKUPS_KEY = 'netwish.pickups';

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode: nothing to remember.
  }
}

export const readGuest = () => ({ name: '', email: '', phone: '', ...(readJSON(GUEST_KEY, {}) || {}) });
export const saveGuest = (g) => writeJSON(GUEST_KEY, { ...readGuest(), ...g });

// Pickup orders placed from this device, for "Reservas" when there is no account.
export const myPickups = () => (readJSON(PICKUPS_KEY, []) || []).filter((p) => p && p.id);
export const rememberPickup = (p) => writeJSON(PICKUPS_KEY, [p, ...myPickups().filter((x) => x.id !== p.id)].slice(0, 20));
