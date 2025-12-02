const CACHE_NAME = 'humanchat-cache-v1';
const OFFLINE_URLS = ['/', '/chat'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        event.waitUntil(updateCache(event.request));
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          );
          return response;
        })
        .catch(() => caches.match('/'));
    })
  );
});

const updateCache = async (request) => {
  const response = await fetch(request).catch(() => null);
  if (!response) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
};

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
        clientsArr.forEach((client) => client.postMessage({ type: 'SYNC_MESSAGES' }));
      })
    );
  }
});

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : { title: 'HumanChat', body: 'You have new activity.' };
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'HumanChat', {
      body: payload.body ?? 'Check the app for updates.',
      data: payload.data ?? {},
      icon: '/icon.svg',
      badge: '/icon.svg'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      const focused = clientsArr.find((client) => 'focus' in client);
      if (focused) {
        return focused.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/chat');
      }
      return undefined;
    })
  );
});
