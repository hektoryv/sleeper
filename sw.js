/**
 * Cache-first service worker. The whole game is a handful of static files with
 * no backend, so once it is installed it runs offline forever.
 *
 * Bump CACHE when you change any file, or the old copy keeps being served.
 */

const CACHE = 'cross-sums-v1';

const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'src/main.js',
  'src/ui.js',
  'src/game.js',
  'src/engine.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request)),
  );
});
