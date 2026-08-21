// PiggyBank Service Worker — Rev 48
// Estrategia: Network-first para HTML (siempre la versión más nueva),
// Cache-first para assets estáticos (íconos, fuentes).
// Responde a SKIP_WAITING para activarse inmediatamente cuando index.html lo pide.

const CACHE_NAME = 'piggybank-v48';
const CACHE_STATIC = 'piggybank-static-v48';

const STATIC_ASSETS = [
  // Solo assets que cambian raramente — NO el index.html
  './manifest.json',
];

// Al instalar: cachear assets estáticos y activarse de inmediato
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS.filter(Boolean)))
      .catch(() => {}) // si falla, no bloquear la instalación
  );
  // Activarse inmediatamente sin esperar a que cierren las tabs viejas
  self.skipWaiting();
});

// Al activar: eliminar todos los cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== CACHE_STATIC)
            .map(k => { console.log('[SW] Eliminando caché viejo:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim()) // tomar control de todas las tabs inmediatamente
  );
});

// Mensaje SKIP_WAITING desde index.html
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch: network-first para HTML, cache-first para el resto
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Solo interceptar requests del mismo origen
  if (url.origin !== location.origin) return;

  // HTML — siempre de la red, con fallback al caché si offline
  if (e.request.headers.get('accept')?.includes('text/html') ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname.endsWith('/presupuesto-familiar/') ||
      url.pathname.endsWith('/presupuesto-familiar')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Guardar la versión nueva en caché
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request)) // offline: servir caché
    );
    return;
  }

  // Assets estáticos — cache-first, actualizar en background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE_STATIC).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
