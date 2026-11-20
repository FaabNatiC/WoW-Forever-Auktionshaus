// Forever AH – Offline-Start: erst Netz, bei Ausfall der zuletzt gespeicherte Stand.
const CACHE = 'forever-ah-v1';
const SHELL = ['./', './index.html', './items.json', './manifest.json', './icon.svg', './icon-192.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ours = url.origin === location.origin || url.hostname === 'raw.githubusercontent.com';
  if (!ours) return;
  e.respondWith(
    fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true })).then(hit => hit || Response.error()))
  );
});
