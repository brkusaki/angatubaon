/* ── Push notifications (FCM) — preparação ───────────────────────
   importScripts roda ANTES de qualquer outra coisa no SW: se o
   Messaging falhar (offline no instante da instalação, SDK do
   gstatic bloqueado), o try/catch abaixo segura o erro e o resto
   deste arquivo — cache, install, activate, fetch — segue igual.
   Config duplicada do _fbConfig em app.js: o service worker roda num
   escopo isolado, sem import nenhum do resto do app, então os valores
   públicos do projeto (a mesma constante em dois lugares) são o preço
   de não ter um bundler. Mudou o projeto Firebase? muda nos dois. */
try {
  importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyClKx3gSCgM1O6X6SMh3VyJLthp-oYnx3k",
    authDomain: "angatubaon-cd333.firebaseapp.com",
    projectId: "angatubaon-cd333",
    storageBucket: "angatubaon-cd333.firebasestorage.app",
    messagingSenderId: "559185630365",
    appId: "1:559185630365:web:a2e7fc4cc9d26bfea67074",
    databaseURL: "https://angatubaon-cd333-default-rtdb.firebaseio.com"
  });

  const messaging = firebase.messaging();

  // Mensagem chegando com o app em SEGUNDO plano (aba fechada,
  // minimizada, ou trocada). Em primeiro plano quem trata é o
  // messaging.onMessage() em app.js (bloco PUSH NOTIFICATIONS). Sem
  // Cloud Function ainda ninguém envia payload nenhum — isto só
  // prepara a exibição pro dia em que alguém enviar.
  messaging.onBackgroundMessage(function (payload) {
    const n = (payload && payload.notification) || {};
    const d = (payload && payload.data) || {};
    self.registration.showNotification(n.title || 'AngatubaON', {
      body: n.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Convenção lida por _fcmAbrirDestino em app.js: "?abrir=lobby
      // |amigos|jogos" leva pro lugar certo; sem o parâmetro, só abre
      // o app na home (ver notificationclick logo abaixo).
      data: { url: d.url || '/' }
    });
  });
} catch (e) {
  console.warn('[SW] Firebase Messaging não iniciou:', e && e.message);
}

// Clique numa notificação em segundo plano: foca uma aba já aberta
// (e manda ela pro lugar certo por postMessage — quem escuta é o
// navigator.serviceWorker.addEventListener('message') em app.js) ou,
// se não há nenhuma aberta, abre uma nova direto na URL do payload.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      for (let i = 0; i < lista.length; i++) {
        const c = lista[i];
        if ('focus' in c) {
          try { c.postMessage({ tipo: 'FCM_CLIQUE', url: url }); } catch (e) {}
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

const CACHE = 'angatubaon-v376';
// Cache separado dos assets dos jogos (sprites, sons, músicas, vídeos
// dos minigames). Fica de fora do CACHE principal de propósito: o
// activate() abaixo NUNCA apaga o CACHE_JOGOS quando o app atualiza
// (v364, v365...) — só quando os próprios assets de um jogo mudam é
// que essa constante sobe de versão (ver Jogos/hub.js, JOGOS_ASSETS /
// _jogosCacheAssets). Assim, quem já baixou um jogo continua jogando
// offline mesmo depois de um deploy novo do app.
// v2 (P0-1 da auditoria): o v1 guardava o .js/.css dos jogos e, como o
// ramo JS/CSS do fetch usava caches.match() em TODOS os caches, a cópia
// velha do v1 ganhava do CACHE novo — quem já tinha aberto um jogo nunca
// recebia deploy. Agora o JS/CSS é lido só do CACHE atual e o
// CACHE_JOGOS vira só fallback offline (ver fetch). Subir para v2 faz o
// activate() apagar o v1 envenenado. O nome é repetido em Jogos/hub.js
// (_jogosCacheAssets) — mudou aqui, muda lá.
const CACHE_JOGOS = 'angatubaon-jogos-v2';
const STATIC = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',
  '/app_min.js',
  // Hub de jogos + som/efeitos compartilhados: sem eles no precache, o
  // hub não abria offline depois de um update até ser aberto online uma vez.
  '/Jogos/hub.min.js',
  '/Jogos/assets/som.min.js',
  '/Jogos/assets/efeitos.min.js',
  '/img/igreja-noite.jpg',
  '/img/igreja-dia.jpg',
  '/webp/owl-badge.webp',
  '/webp/owl-celebrate-gratis.webp',
  '/webp/owl-celebrate-plus.webp',
  '/webp/owl-celebrate-pro.webp',
  '/webp/owl-celebrate-flying.webp',
  '/webp/splash-anim.webm',
  '/webp/owl-search.webp',
  '/webp/owl-idea.webp',
  '/webp/owl-sleeping.webp',
  '/webp/owl-empty-wallet.webp',
  '/webp/owl-goodnight.webp',
  '/webp/owl-approved.webp',
  '/webp/owl-wave.webp',
  '/webp/owl-love.webp',
  '/webp/owl-point.webp',
  '/webp/owl-tip.webp',
  '/webp/owl-highlight.webp',
  '/webp/owl-tada.webp',
  '/webp/owl-trophy.webp',
  '/webp/owl-thumbsup.webp',
  '/webp/owl-phone.webp',
  '/webp/owl-sign.webp',
  '/webp/owl-portrait.webp',
  '/webp/owl-flying.webp',
  '/webp/owl-angry.webp',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/owl-gratis.png',
  '/icons/owl-plus.png',
  '/icons/owl-pro.png',
];

// Instala e cacheia arquivos estáticos — best-effort:
// se um asset falhar (404, rede), o SW ainda instala com os demais.
// addAll() é atômico e abortaria tudo; allSettled() é resiliente.
// cache: 'reload' pula o cache HTTP do navegador (o GitHub Pages manda
// max-age=600): sem isso o precache do deploy novo podia gravar o
// app_min.js/styles.css de até 10 min antes. c.add() já recusa resposta
// que não seja 2xx, então erro nunca entra no cache.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(
        STATIC.map(url =>
          c.add(new Request(url, { cache: 'reload' })).catch(err =>
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

// Remove caches antigos — mas NUNCA o CACHE_JOGOS (ver comentário na
// declaração dele acima): só apaga caches 'angatubaon-*' que não são
// nem o CACHE atual nem o CACHE_JOGOS atual.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('angatubaon-') && k !== CACHE && k !== CACHE_JOGOS)
          .map(k => caches.delete(k))
      )
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
  // Assets dos jogos (sprites, sons, músicas, vídeos): /Jogos/assets/**
  // ou áudio do próprio domínio. Cacheados à parte no CACHE_JOGOS (ver
  // fetch abaixo) pra sobreviver a updates do CACHE principal.
  const isJogoAsset = !isJsCss && (
    new URL(url).pathname.startsWith('/Jogos/assets/') ||
    /\.(mp3|wav|ogg)$/i.test(url)
  );

  if (isDoc) {
    // HTML: network-first — reflete deploys imediatamente (detecta nova versão do app).
    // Fallback para cache e, por fim, offline.html.
    e.respondWith(
      fetch(e.request)
        .then(r => {
          // Só guarda resposta ok — um 404/500 no cache viraria o
          // "offline" daquela página.
          if (r && r.ok) {
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
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
    //
    // Fix: offline sem cache, o fallback NÃO pode ser o offline.html.
    // Devolver a página de offline para um .js/.css entrega HTML com status 200:
    // o <script> "carrega" (dispara onload, não onerror), o navegador tenta
    // parsear HTML como JS e o app cai num erro genérico ("módulo não expôs
    // window.X") em vez do erro tratado. Response.error() falha como erro de
    // rede de verdade, então o onerror do loader roda e a mensagem certa
    // ("Não foi possível carregar... verifique a conexão") aparece.
    //
    // P0-1: lê SÓ do CACHE atual (nunca caches.match() genérico, que
    // achava primeiro a cópia congelada no CACHE_JOGOS e servia o JS
    // antigo do jogo pra sempre). Se o arquivo não está no CACHE atual,
    // vai direto na rede — o jogo abre com o código do deploy novo.
    // O CACHE_JOGOS só entra como fallback quando a rede falha (offline).
    const req = e.request;
    e.respondWith(
      caches.open(CACHE).then(c => c.match(req)).then(cached => {
        const net = fetch(req)
          .then(r => {
            if (r && r.ok) {
              const clone = r.clone();
              caches.open(CACHE).then(c => c.put(req, clone));
              // Se o arquivo também mora no CACHE_JOGOS (js/css de jogo
              // pré-baixado pelo _jogosCacheAssets, sempre em /Jogos/),
              // atualiza lá também: senão o offline continuaria servindo
              // a versão velha.
              if (new URL(url).pathname.startsWith('/Jogos/')) {
                const cloneJogos = r.clone();
                caches.open(CACHE_JOGOS).then(cj =>
                  cj.match(req).then(tem => { if (tem) return cj.put(req, cloneJogos); })
                ).catch(() => {});
              }
            }
            return r;
          })
          .catch(() =>
            cached ||
            caches.open(CACHE_JOGOS)
              .then(cj => cj.match(req))
              .then(r => r || Response.error())
              .catch(() => Response.error())
          );
        return cached || net;
      })
    );
  } else if (isJogoAsset) {
    // Assets dos jogos: cache-first no CACHE_JOGOS (separado do CACHE
    // principal). Se não estiver no cache ainda, busca na rede e guarda
    // pra próxima. Normalmente já chega aqui pré-populado pelo
    // _jogosCacheAssets em Jogos/hub.js (cache sob demanda ao abrir um
    // jogo); isto aqui é só o reforço/fallback do próprio SW.
    e.respondWith(
      caches.open(CACHE_JOGOS).then(c =>
        c.match(e.request).then(r => {
          if (r) return r;
          return fetch(e.request).then(resp => {
            if (resp && resp.ok) c.put(e.request, resp.clone());
            return resp;
          }).catch(() => r || Response.error());
        })
      )
    );
  } else {
    // Cache-first para imagens e outros assets estáticos DO PRÓPRIO DOMÍNIO
    e.respondWith(
      caches.match(e.request)
        .then(r => r || fetch(e.request))
    );
  }
});
