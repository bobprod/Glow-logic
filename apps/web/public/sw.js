const CACHE_NAME = 'glow-logic-v1';
const urlsToCache = [
  '/',
  '/smart',
  '/live',
  '/ai-lighting',
  '/patch',
  '/settings',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return new Response(JSON.stringify({ error: 'Offline' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Background sync for DMX commands
self.addEventListener('sync', (event) => {
  if (event.tag === 'dmx-sync') {
    event.waitUntil(syncDmxCommands());
  }
});

async function syncDmxCommands() {
  // Sync pending DMX commands when back online
  const pendingCommands = await getPendingDmxCommands();
  for (const command of pendingCommands) {
    try {
      await fetch(command.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command.data)
      });
      await removePendingDmxCommand(command.id);
    } catch (error) {
      console.error('Failed to sync DMX command:', error);
    }
  }
}

async function getPendingDmxCommands() {
  // Get pending commands from IndexedDB
  return [];
}

async function removePendingDmxCommand(id) {
  // Remove command from IndexedDB
}
