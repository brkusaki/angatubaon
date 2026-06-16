const CACHE = 'angatubaon-v5';
const STATIC = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',
  '/app.js',
];
// Instala e cacheia arquivos estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
  self.skipWaiting();
});
// Remove caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
// Fetch: HTML sempre da rede, resto do cache; fallback offline.html
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Não intercepta chamadas externas (Apps Script, etc.)
  if (!e.request.url.startsWith(self.location.origin)) return;
  const isHTML = e.request.destination === 'document';
  e.respondWith(
    isHTML
      ? fetch(e.request)
          .then(r => {
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
            return r;
          })
          .catch(() => caches.match(e.request).then(r => r || caches.match('/offline.html')))
      : caches.match(e.request)
          .then(r => r || fetch(e.request))
  );
});