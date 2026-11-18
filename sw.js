/* Service worker Portal Tryout TKA
 * - File milik sendiri : network-first (selalu ambil versi terbaru, cache hanya cadangan offline)
 * - CDN (font, Tailwind, FontAwesome): stale-while-revalidate
 * - Google Apps Script / request non-GET: TIDAK disentuh sama sekali (data selalu live)
 * Naikkan CACHE_VERSION setiap kali Anda mengubah daftar PRECACHE.
 */
const CACHE_VERSION = 'v1';
const CACHE_SHELL = 'tka-shell-' + CACHE_VERSION;
const CACHE_CDN = 'tka-cdn-' + CACHE_VERSION;

const PRECACHE = [
  './',
  './index.html',
  './admin.html',
  './style.css',
  './config.js',
  './app.js',
  './admin.js',
  './pwa.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      // satu file gagal tidak boleh menggagalkan seluruh instalasi
      .then((cache) => Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_SHELL && k !== CACHE_CDN).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Backend Google Apps Script & domain Google lain: langsung ke jaringan
  if (url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) {
    if (!CDN_HOSTS.includes(url.hostname)) return;
  }

  // CDN: stale-while-revalidate
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, CACHE_CDN));
    return;
  }

  // File milik sendiri: network-first
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_SHELL);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}
