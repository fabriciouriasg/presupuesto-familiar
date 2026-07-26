const CACHE_NAME = 'piggybank-v12';
const ASSETS = ['./', './index.html', './manifest.json'];

// Install: cachear assets de forma TOLERANTE a fallos.
// Con addAll(), si un solo asset falla (404), toda la instalacion se rechaza
// y el service worker nunca activa -> app rota.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(ASSETS.map(url => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

// Activate: borrar todos los caches viejos y tomar control
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  // HTML -> network first (siempre version fresca), cache como respaldo offline
  if (req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Resto -> cache first
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(() => cached))
  );
});
