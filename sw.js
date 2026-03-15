
const CACHE_NAME = 'kumanya-stok-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/api.js',
  '/app.js',
  '/ui.js',
  '/utils.js',
  '/config.js',
  '/inventory.js',
  '/alias.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
