const CACHE = 'kip-training-v14-workouts';
const ASSETS = [
  './', './index.html', './style.css?v=14', './app.js?v=14', './backup.js?v=14', './workouts.js?v=14',
  './manifest.json', './icon-192.png', './icon-512.png', './assets/kip-training-logo.png',
];

self.addEventListener('install', event => {
  const requests = ASSETS.map(asset => new Request(new URL(asset, self.location.href), {cache: 'reload'}));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key !== CACHE && /^(kip-training-v|gymtrack-)/.test(key))
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(request) ??
      (request.mode === 'navigate' ? await cache.match('./index.html') : undefined) ??
      Response.error();
  }));
});
