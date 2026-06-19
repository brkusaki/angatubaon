const CACHE = 'angatubaon-v14';
const STATIC = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',
  '/app.js',
  '/webp/owl-badge.webp',
  '/webp/owl-celebrate-gratis.webp',
  '/webp/owl-celebrate-plus.webp',
  '/webp/owl-celebrate-pro.webp',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/owl-gratis.png',
  '/icons/owl-plus.png',
  '/icons/owl-pro.png',
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

// Fetch: network-first para HTML/JS/CSS — garante arquivos atualizados
// Fallback para cache se offline; fallback final para offline.html
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  const url = e.request.url;
  const isAsset = url.endsWith('.js') || url.endsWith('.css') || 
                  e.request.destination === 'document';

  if (isAsset) {
    // Network-first: tenta rede, atualiza cache, fallback para cache/offline
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => 
          caches.match(e.request)
            .then(r => r || caches.match('/offline.html'))
        )
    );
  } else {
    // Cache-first para imagens e outros assets estáticos
    e.respondWith(
      caches.match(e.request)
        .then(r => r || fetch(e.request))
    );
  }
});