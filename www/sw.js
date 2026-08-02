const CACHE = 'quiz-thales-v5.40';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'update-check.js', 'autobackup.js',
  'firebase-config.js',
  'firebase-challenge.js',
  'manifest.webmanifest',
  'data/secu_concepts.json',
  'data/cissp_concepts.json',
  'data/ignite_concepts.json',
  'data/isc2_concepts.json',
  'data/ceh_concepts.json',
  'data/scenarios.json',
  'data/cissp_defs.json',
  'data/branch_videos.json',
  'data/category_videos.json',
  'data/prog_concepts.json',
  'data/iso27001_concepts.json',
  'data/iso42001_concepts.json',
  'data/ebiosrm_concepts.json',
  'img/icon-192.png',
  'img/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  // Ne toucher qu'aux assets de l'app : intercepter le cross-origin (api.github.com)
  // servait une réponse en cache — ou, hors ligne, index.html à la place du JSON,
  // ce qui cassait silencieusement la vérification de mise à jour.
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
