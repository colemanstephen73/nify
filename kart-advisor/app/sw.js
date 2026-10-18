// Offline support: cache the app shell, engine and knowledge base on first load.
// App files: network first (so edits show up), cache fallback. Weather API: network only.
const CACHE = 'kart-advisor-v1';
const SHELL = [
  './', 'index.html', 'app.js', 'db.js', 'ui.js', 'styles.css', 'data.json', 'manifest.webmanifest', 'icon.svg',
  '../engine/index.js', '../engine/air.js', '../engine/geometry.js', '../engine/feel.js', '../engine/legality.js',
  '../engine/learn.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
