const CACHE_PREFIX = 'cooking-companion-shell-';
const CACHE_NAME = CACHE_PREFIX + 'development-ai-providers-1';
const VENDOR_CACHE = 'cooking-companion-vendor-10.14.1';
const AUTH_SCRIPTS = ['app', 'auth', 'firestore'].map(name => `https://www.gstatic.com/firebasejs/10.14.1/firebase-${name}-compat.js`);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch('/asset-manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Offline asset manifest unavailable');
    const { assets } = await response.json();
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(assets.map(path => new Request(path, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== CACHE_NAME && (name.startsWith(CACHE_PREFIX) || /^cooking-companion-v\d+$/.test(name))) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && AUTH_SCRIPTS.includes(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(VENDOR_CACHE);
      const existing = await cache.match(event.request);
      if (existing) return existing;
      const response = await fetch(event.request);
      if (response.ok || response.type === 'opaque') await cache.put(event.request, response.clone());
      return response;
    })());
    return;
  }
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/asset-manifest.json') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (event.request.mode === 'navigate') {
      try { return await fetch(event.request); }
      catch { return await cache.match('/index.html') || Response.error(); }
    }
    return await cache.match(event.request) || fetch(event.request).catch(() => Response.error());
  })());
});
