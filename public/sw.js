// NetWish service worker: notifications for businesses and an installable app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Network first; nothing is cached, so a new version is always picked up.
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'NetWish', body: event.data?.text() || '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'NetWish', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    data: { url: data.url || '/panel' },
    tag: data.tag || undefined,
    renotify: !!data.tag,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/panel';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find((c) => new URL(c.url).origin === self.location.origin);
    if (open) { await open.focus(); open.navigate(url).catch(() => {}); return; }
    await self.clients.openWindow(url);
  })());
});
