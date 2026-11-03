const CACHE_NAME = 'mind-nutrition-v5';
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest']);
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa/android-chrome-192x192.png',
  '/pwa/android-chrome-512x512.png',
  '/pwa/apple-touch-icon.png',
  '/pwa/favicon-32x32.png',
  '/pwa/favicon-16x16.png',
  '/pwa/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Dados privados (sessão, usuários, artigos administrativos e IA) nunca entram no cache.
  if (requestUrl.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }

  if (!STATIC_DESTINATIONS.has(event.request.destination)) return;

  event.respondWith(
    fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request))
  );
});
