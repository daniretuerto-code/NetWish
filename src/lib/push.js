import { supabase } from './supabase.js';

// Public half of the VAPID pair; the private half lives only in Vercel (VAPID_PRIVATE_KEY).
export const VAPID_PUBLIC_KEY = 'BK6MkFPi7pRYF4mGzNKWtQC3LEkkxfoyzu_s_-TTf30dymfo0Y7Nd1_5tjjn62ooV7-x79itE-Jv8lHGgPmYOMk';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

const toKey = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

// Asks once for permission and saves this device for the business's notices.
export async function enablePush(businessName) {
  if (!pushSupported()) throw new Error('Este navegador no permite avisos. En iPhone, primero añade NetWish a la pantalla de inicio.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Has dicho que no a los avisos. Puedes cambiarlo en los ajustes del navegador.');
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: json.endpoint, business_name: businessName, keys: json.keys }, { onConflict: 'endpoint' });
  if (error) throw new Error('No se pudo guardar este dispositivo. Inténtalo otra vez.');
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

// "Instalar NetWish": Chrome/Android offer it once the page qualifies; we keep the offer for a button.
let installEvent = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; window.dispatchEvent(new Event('netwish-installable')); });
}
export const canInstall = () => !!installEvent;
export const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export async function promptInstall() {
  if (!installEvent) return false;
  installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  return outcome === 'accepted';
}
