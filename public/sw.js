const CACHE_NAME = 'preset-forge-v1';

// Activate immediately — don't wait for old tabs to close
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/auth/')) return;

  // Cache-first for static assets
  if (url.pathname.match(/\.(js|css|woff2?|png|svg|ico)$/)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }))
    );
    return;
  }

  // Network-first for pages (editor, playlists)
  if (url.pathname.match(/^\/(de|en)\/(editor|playlists)(\/|$)/) || url.pathname.match(/^\/(de|en)$/)) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Claim all open tabs immediately
      self.clients.claim(),
      // Clean old caches
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
    ])
  );
});
