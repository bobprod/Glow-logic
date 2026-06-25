// Glow Logic — Service Worker v2
// Stratégie : Network-first pour les pages, Cache-first pour les assets statiques
// Les appels API (port 3005) ne sont jamais interceptés

const CACHE = 'glow-logic-v2';
const ASSETS_CACHE = 'glow-logic-assets-v2';

const PRECACHE = [
  '/',
  '/manifest.json',
  '/glow-icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Install : précache de l'app shell ─────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(PRECACHE).catch(() => {
        // Si un asset manque (ex: first run), on ignore silencieusement
      });
    })
  );
  self.skipWaiting();
});

// ── Activate : nettoyer les anciens caches ────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== ASSETS_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie par type de requête ─────────────────────
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Ignorer les requêtes non-GET
  if (e.request.method !== 'GET') return;

  // Ignorer le backend API (port 3005 ou /api/) — toujours réseau
  if (url.port === '3005' || url.pathname.startsWith('/api/')) return;

  // Ignorer les requêtes cross-origin (Socket.IO, CDN)
  if (url.origin !== self.location.origin) return;

  // Assets statiques (images, polices, styles compilés) → Cache-first
  if (/\.(png|svg|ico|jpg|jpeg|webp|woff2?|ttf|eot)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(ASSETS_CACHE).then((c) => c.put(e.request, clone));
          }
          return resp;
        });
      })
    );
    return;
  }

  // Pages / navigation → Network-first, fallback cache
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match('/')))
  );
});

// ── Message : forcer la mise à jour depuis l'app ──────────────
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
