const CACHE = 'angatubaon-v6';
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

// Fetch: HTML sempre da rede (garante versão nova),
// JS/CSS: rede primeiro, fallback cache (stale-while-revalidate)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  const url = new URL(e.request.url);
  const isHTML = e.request.destination === 'document';
  const isAsset = /\.(js|css)$/.test(url.pathname);

  if (isHTML || isAsset) {
    // Sempre tenta a rede primeiro; atualiza o cache em background
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.status === 200) {
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return r;
        })
        .catch(() =>
          caches.match(e.request).then(r => r || caches.match('/offline.html'))
        )
    );
  } else {
    // Outros recursos: cache primeiro, fallback rede
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
  }
});
