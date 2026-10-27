// "Muy pronto": until NetWish opens to the public, the customer app shows a waiting screen.
// Links that belong to a business (its page, QR tables, booking e-mails) and the business
// side keep working, so restaurants already using NetWish are not affected.
export const LAUNCHED = false;

// netwish.es/?acceso=CODE opens the real app on that device for good; ?acceso=salir closes it.
const ACCESS_CODE = 'netwish-dani-4827';
const KEY = 'netwish_acceso';

const OPEN_PATHS = ['/cuenta', '/reservas', '/negocio/', '/mesa/', '/r/', '/reserva/', '/opinion/', '/pagar/', '/chat/', '/baja', '/negocios', '/admin', '/panel'];

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

export function showComingSoon(pathname, search) {
  if (new URLSearchParams(search).has('muypronto')) return true;
  if (LAUNCHED || hasAccess()) return false;
  // Old printed QR codes: /?biz=NAME&table=N.
  if (new URLSearchParams(search).has('biz')) return false;
  return !OPEN_PATHS.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p));
}
