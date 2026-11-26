const CACHE = 'araadi-v5';
const FILES = ['./', './index.html', './css/style.css', './js/geo.js', './js/data.js', './js/app.js', './js/tools.js', './lib/leaflet.js', './lib/leaflet.css', './lib/proj4.js', './lib/pdf.min.js', './lib/pdf.worker.min.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
  './lib/images/marker-icon.png', './lib/images/layers.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('araadi-v') && k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return res; }).catch(() => caches.match(e.request)));
  } else {
    // بلاطات الخريطة: تخزين ما تمت زيارته للاستعمال دون إنترنت
    e.respondWith(caches.open('araadi-tiles').then(c => fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => c.match(e.request))));
  }
});
