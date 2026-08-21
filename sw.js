// PiggyBank Service Worker — Rev 59
// Estrategia para HTML: stale-while-revalidate.
//   1. Sirve el HTML desde caché al instante (arranque inmediato, menos presión de memoria).
//   2. Al mismo tiempo descarga la versión nueva en segundo plano y la guarda.
//   3. Si hay versión nueva, avisa a la app para que ofrezca actualizar.
// Assets estáticos: cache-first con revalidación en segundo plano.
// Sin conexión: todo se sirve desde caché.

const CACHE_HTML   = 'piggybank-html-v59';
const CACHE_STATIC = 'piggybank-static-v59';

self.addEventListener('install', e => {
  // Activarse de inmediato sin esperar a que cierren las pestañas viejas
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_HTML && k !== CACHE_STATIC)
            .map(k => caches.delete(k))   // borra cachés de versiones anteriores
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function esHTML(req, url) {
  return (req.headers.get('accept') || '').includes('text/html') ||
         url.pathname.endsWith('.html') ||
         url.pathname === '/' ||
         url.pathname.endsWith('/');
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;      // no tocar peticiones externas
  if (e.request.method !== 'GET') return;          // no cachear POST

  // ── HTML: stale-while-revalidate ──
  if (esHTML(e.request, url)) {
    e.respondWith(
      caches.open(CACHE_HTML).then(cache =>
        cache.match(e.request).then(cached => {
          // Descarga en segundo plano SIEMPRE, haya caché o no
          const red = fetch(e.request).then(res => {
            if (res && res.ok) {
              cache.put(e.request, res.clone());
              // Si ya había una copia y la nueva es distinta, avisar a la app
              if (cached) {
                Promise.all([cached.clone().text(), res.clone().text()])
                  .then(([viejo, nuevo]) => {
                    if (viejo !== nuevo) {
                      self.clients.matchAll().then(cs =>
                        cs.forEach(c => c.postMessage({ type: 'NUEVA_VERSION' }))
                      );
                    }
                  }).catch(() => {});
              }
            }
            return res;
          }).catch(() => cached);   // sin conexión: usar lo cacheado

          // Devuelve el caché de inmediato si existe; si no, espera a la red
          return cached || red;
        })
      )
    );
    return;
  }

  // ── Assets estáticos: cache-first + revalidación en segundo plano ──
  e.respondWith(
    caches.open(CACHE_STATIC).then(cache =>
      cache.match(e.request).then(cached => {
        const red = fetch(e.request).then(res => {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || red;
      })
    )
  );
});
