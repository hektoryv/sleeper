/**
 * Stale-while-revalidate.
 *
 * Every request is answered from the cache immediately (so the game opens
 * instantly and works with no network at all), while a fresh copy is fetched in
 * the background and stored for next time. Reopening the app after an update
 * therefore picks the new version up on its own - no reinstall, and no version
 * string anyone has to remember to bump.
 */

const CACHE = 'cross-sums';

const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'src/main.js',
  'src/ui.js',
  'src/game.js',
  'src/engine.js',
  'src/settings.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // `reload` skips the HTTP cache, so a fresh install never seeds itself
      // with a stale copy the browser happened to be holding.
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);

      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      // Cached copy wins the race; the network copy lands in the cache for the
      // next launch. With nothing cached yet, wait for the network.
      return cached || (await network) || Response.error();
    }),
  );
});
