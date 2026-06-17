const CACHE   = 'angatubaon-v7';
const STATIC  = ['/', '/index.html', '/offline.html', '/styles.css', '/app.js'];

// Instala: cacheia arquivos estáticos e ativa imediatamente
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
  // NÃO chama skipWaiting aqui — espera o app pedir via postMessage
  // Isso dá controle ao usuário sobre quando atualizar
});

// Ativa: remove caches antigos e avisa os clientes que há update
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      // Assume controle imediato após limpar caches velhos
      return self.clients.claim();
    })
  );
});

// Mensagem do app pedindo para ativar update
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: rede primeiro para HTML e JS/CSS (sempre atualizado)
// Cache primeiro para imagens e fontes (performance)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  const url    = new URL(e.request.url);
  const isDoc  = e.request.destination === 'document';
  const isAsset = /\.(js|css)(\?.*)?$/.test(url.pathname);

  if (isDoc || isAsset) {
    // Network-first: sempre busca versão nova, atualiza cache
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          }
          return r;
        })
        .catch(() =>
          caches.match(e.request).then(r => r || caches.match('/offline.html'))
        )
    );
  } else {
    // Cache-first para imagens, ícones, fontes
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
  }
});
