'use strict';

const CACHE   = 'angatubaon-v1';
const ASSETS  = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Instala e pré-cacheia os assets estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Limpa caches antigos ao ativar nova versão
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first para o index.html, cache-first para o resto
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  
  const isHTML = e.request.destination === 'document';
  
  e.respondWith(
    isHTML
      ? fetch(e.request)
          .then(r => { // atualiza o cache em background
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
            return r;
          })
          .catch(() => caches.match(e.request))
      : caches.match(e.request)
          .then(r => r || fetch(e.request))
  );
});