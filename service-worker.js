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
          .catch(() => caches.match(e.request))
      : caches.match(e.request)
          .then(r => r || fetch(e.request))
  );
});
