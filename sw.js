/* Mi Reseller Program — Service Worker */
const CACHE = 'mi-reseller-v1';
const ASSETS = [
  './index.html', './dashboard.html', './admin.html', './manifest.json',
  './css/theme.css', './js/config.js', './js/sounds.js', './js/imgbb.js',
  './js/groq-ai.js', './js/location-picker.js', './js/pwa-install.js',
  './assets/logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Never cache Firebase/Groq/ImgBB/Maps API calls — always go live
  if (/googleapis|firebaseio|firebase|groq|imgbb|gstatic/.test(url.hostname)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res && res.status === 200 && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
