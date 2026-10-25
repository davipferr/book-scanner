// Service worker template. The build (build/pwa.ts) fills in the double-underscore placeholders below.

const VERSION = __VERSION__;
/** App files, relative to this script: cached on install so the app opens offline. */
const PRECACHE = __PRECACHE__;
/** Path prefixes of the self-hosted text reader in this release. */
const OCR_PATHS = __OCR_PATHS__;

const SHELL = `shell-${VERSION}`;
/** Text reader engine and language data: cached the first time they are used. */
const RUNTIME = 'runtime';
const LANGUAGE_DATA = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/';

const scoped = (path) => new URL(path, self.registration.scope).href;
// Servers send Vary headers (e.g. Vary: Origin), and module scripts and stylesheets are
// requested with an Origin header the install-time requests didn't have. Files here are
// fixed per URL, so match on the URL alone.
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE.map(scoped))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('shell-') && name !== SHELL) await caches.delete(name);
      }
      // Drop text reader files from older releases.
      const runtime = await caches.open(RUNTIME);
      const current = OCR_PATHS.map(scoped);
      for (const request of await runtime.keys()) {
        const own = request.url.startsWith(self.registration.scope);
        if (own && !current.some((prefix) => request.url.startsWith(prefix))) await runtime.delete(request);
      }
      await self.clients.claim();
    })(),
  );
});

// The page asks for this when the user accepts the update.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = request.url;

  if (request.mode === 'navigate' && url.startsWith(self.registration.scope)) {
    // Any page in scope is the app: serve the cached shell.
    event.respondWith(
      caches.match(scoped('index.html'), { ...MATCH, cacheName: SHELL }).then((hit) => hit ?? fetch(request)),
    );
    return;
  }

  if (OCR_PATHS.some((p) => url.startsWith(scoped(p))) || url.startsWith(LANGUAGE_DATA)) {
    event.respondWith(cacheFirst(request, RUNTIME));
    return;
  }

  if (url.startsWith(self.registration.scope)) {
    event.respondWith(caches.match(request, { ...MATCH, cacheName: SHELL }).then((hit) => hit ?? fetch(request)));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, MATCH);
  if (hit) return hit;
  const response = await fetch(request);
  // These URLs are versioned, so a good response never goes stale.
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
