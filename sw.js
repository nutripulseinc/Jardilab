// Jardilab : application installable, usage hors ligne limité
const C = 'jardilab-v4';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(['/', '/index.html', '/icon-192.png', '/badge-96.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    // le site : réseau d'abord, copie locale si hors ligne
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); return res; })
      .catch(() => caches.match(r).then(m => m || caches.match('/'))));
    return;
  }
  if (/jsdelivr|geo\.admin|fonts\.g/.test(u.host)) {
    // bibliothèques, cartes, polices : copie locale d'abord
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); return res; })));
  }
  // Supabase, Open-Meteo et l'IA ne sont jamais mis en cache
});

// Notifications push : le message du jour est récupéré chez Jardilab (le push lui-même est vide)
const FN = 'https://cxpdbndlgfrqnyndtsam.supabase.co/functions/v1/reminders';
async function sha(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let t = 'Jardilab', b = 'Des soins sont à faire au jardin aujourd\'hui.';
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const r = await fetch(FN + '?m=' + await sha(sub.endpoint));
        if (r.ok) { const j = await r.json(); if (j.t) t = j.t; if (j.b) b = j.b; }
      }
    } catch (_) {}
    await self.registration.showNotification(t, { body: b, icon: '/icon-192.png', badge: '/badge-96.png', tag: 'jardilab-rappel' });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) if ('focus' in c) return c.focus();
    return self.clients.openWindow('/');
  }));
});
