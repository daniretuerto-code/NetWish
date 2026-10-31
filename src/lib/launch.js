// "Muy pronto": until NetWish opens to the public, every page shows a waiting screen.
// Only devices that opened the private access link see the real app.
export const LAUNCHED = false;

// netwish.es/?acceso=CODE opens the real app on that device for good; ?acceso=salir closes it.
const ACCESS_CODE = 'netwish-dani-4827';
const KEY = 'netwish_acceso';


export function hasAccess() {
  try { if (localStorage.getItem(KEY) === '1') return true; } catch { /* storage unavailable */ }
  return document.cookie.split('; ').includes(`${KEY}=1`);
}

export function grantAccess() {
  try { localStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ }
  document.cookie = `${KEY}=1; path=/; max-age=${60 * 60 * 24 * 365 * 5}; SameSite=Lax; Secure`;
}

function revokeAccess() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  document.cookie = `${KEY}=; path=/; max-age=0; SameSite=Lax; Secure`;
}

// Reads ?acceso= once, at start, and tidies it out of the address bar.
export function readAccessParam() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('acceso');
  if (code == null) return;
  if (code === ACCESS_CODE) grantAccess();
  else if (code === 'salir') revokeAccess();
  url.searchParams.delete('acceso');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

// Pages that must work for real businesses and their customers even before launch:
// a business's own page and short link, the links in the e-mails, table QR codes,
// the customer's account and bookings, legal pages, and the business panel.
const OPEN_PATHS = /^\/(negocio|r|reserva|opinion|baja|mesa|chat|cuenta|reservas|legal|negocios|panel|admin|pagar)(\/|$)/;

export function showComingSoon(search, pathname = '/') {
  if (new URLSearchParams(search).has('muypronto')) return true;
  if (OPEN_PATHS.test(pathname)) return false;
  return !LAUNCHED && !hasAccess();
}
