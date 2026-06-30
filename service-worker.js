const CACHE = 'angatubaon-v64';
const STATIC = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',
  '/app.js',
  '/img/igreja-noite.jpg',
  '/webp/owl-badge.webp',
  '/webp/owl-celebrate-gratis.webp',
  '/webp/owl-celebrate-plus.webp',
  '/webp/owl-celebrate-pro.webp',
  '/webp/owl-celebrate-flying.webp',
  '/webp/splash-anim.webp',
  '/webp/owl-search.webp',
  '/webp/owl-idea.webp',
  '/webp/owl-sleeping.webp',
  '/webp/owl-empty-wallet.webp',
  '/webp/owl-goodnight.webp',
  '/webp/owl-approved.webp',
  '/webp/owl-wave.webp',
  '/webp/owl-tip.webp',
  '/webp/owl-highlight.webp',
  '/webp/owl-tada.webp',
  '/webp/owl-trophy.webp',
  '/webp/owl-thumbsup.webp',
  '/webp/owl-phone.webp',
  '/webp/owl-sign.webp',
  '/webp/owl-portrait.webp',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/owl-gratis.png',
  '/icons/owl-plus.png',
  '/icons/owl-pro.png',
];

// Instala e cacheia arquivos estáticos — best-effort:
// se um asset falhar (404, rede), o SW ainda instala com os demais.
// addAll() é atômico e abortaria tudo; allSettled() é resiliente.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(
        STATIC.map(url =>
          c.add(url).catch(err =>
            console.warn('[SW] cache ignorado:', url, err.message)
          )
        )
      )
    )
  );
  // Fix #2: NÃO chama skipWaiting() aqui — isso ativava o SW novo na hora
  // e recarregava a página sozinha no meio da sessão. Agora o SW novo fica
  // "waiting" até o usuário clicar no banner de atualização (ver listener message abaixo).
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

// Fix #3: ativa o SW novo SOMENTE quando o app pede (clique no banner de update).
// O app chama swWaiting.postMessage('SKIP_WAITING') — sem isto, o botão não fazia nada.
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch: network-first para HTML/JS/CSS — garante arquivos atualizados
// Fallback para cache se offline; fallback final para offline.html
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // Fix #21: não cacheia recursos externos (ImgBB, CDNs, Google Fonts, etc.)
  // Imagens de lojas trocam com frequência — cachear indefinidamente exibiria fotos antigas
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Fix #9: nunca intercepta o próprio service-worker.js — deixa o navegador buscar
  // direto da rede (com no-store via _headers), garantindo detecção de versão nova.
  if (e.request.url.includes('/service-worker.js')) return;

  const url = e.request.url;
  const isDoc = e.request.destination === 'document';
  const isJsCss = url.endsWith('.js') || url.endsWith('.css');

  if (isDoc) {
    // HTML: network-first — reflete deploys imediatamente (detecta nova versão do app).
    // Fallback para cache e, por fim, offline.html.
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
  } else if (isJsCss) {
    // JS/CSS: stale-while-revalidate — serve do cache na hora (boot instantâneo),
    // revalida em background e atualiza o cache. Como o app versiona via CACHE name
    // e o HTML vem network-first, a próxima carga já pega o bundle novo.
    e.respondWith(
      caches.match(e.request).then(cached => {
        const net = fetch(e.request)
          .then(r => {
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
            return r;
          })
          .catch(() => cached || caches.match('/offline.html'));
        return cached || net;
      })
    );
  } else {
    // Cache-first para imagens e outros assets estáticos DO PRÓPRIO DOMÍNIO
    e.respondWith(
      caches.match(e.request)
        .then(r => r || fetch(e.request))
    );
  }
});