const CACHE_NAME = 'piggybank-v11';
const ASSETS = ['./', './index.html', './manifest.json'];

// Al instalar: cachear assets básicos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  // Forzar activación inmediata sin esperar
  self.skipWaiting();
});

// Al activar: eliminar TODOS los cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  // Tomar control de todas las páginas abiertas inmediatamente
  self.clients.claim();
});

// Fetch: network first para HTML, cache first para el resto
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // HTML siempre desde red para tener versión fresca
  if (e.request.destination === 'document' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // Resto: cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
