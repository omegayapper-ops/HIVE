/* Lost & Found service worker (v4 - installable)
   - Same-origin files: network first, cached copy when offline
   - supabase-js CDN script: cached so the app shell can start offline
   - Everything else (Supabase API, photos) goes straight to the network
   - Never serves redirected responses to page navigations (breaks on hosts
     that redirect /index.html -> /, e.g. Cloudflare Pages) */
const CACHE = 'hive-own-3';
const CDN_HOSTS = ['cdn.jsdelivr.net'];
const PRECACHE = [
  './', './offline.html', './manifest.json', './icon.svg', './hive-enhancements.css', './hive-loading.css', './hive-enhancements.js', './hive-groups.js', './hive_mark.png', './hive-bg-light.svg', './hive-bg-dark.svg',
  './ecopoints.html', './eco-loading.html', './styles.css', './hive-ux.css', './hive-ux.js', './hive-icons.js', './hive.css', './app.js', './hive.js', './hive2.js', './hive3.js', './hive-ai.js', './hive-ai.css', './hive-ui.css', './hive-field.js', './hive_logo.png', './hive_mark.svg', './ops.html', './admin.html', './admin-education.html', './admin-medical.html', './admin_legacy.html', './install.js', './hive-admin.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* A response that came through a redirect cannot be handed to a navigation. */
async function clean(res) {
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function navigate(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok && !res.redirected) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const path = new URL(req.url).pathname;
    let hit = await cache.match(req);
    if (!hit && (path === '/' || path.endsWith('/index.html'))) hit = await cache.match('./');
    return clean(hit || (await cache.match('./offline.html')) || Response.error());
  }
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type === 'basic' && !res.redirected) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return clean((await cache.match(req)) || Response.error());
  }
}

/* CDN script: fetched in CORS mode so the status can be checked and only a
   successful (200) response is ever cached. */
async function staleWhileRevalidate(event) {
  const url = event.request.url;
  const cache = await caches.open(CACHE);
  const cached = await cache.match(url);
  const update = fetch(url, { mode: 'cors', credentials: 'omit' }).then((res) => {
    if (res && res.ok) cache.put(url, res.clone());
    return res;
  }).catch(() => null);
  if (cached) { event.waitUntil(update); return cached; }
  return (await update) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(req.mode === 'navigate' ? navigate(req) : networkFirst(req));
  } else if (CDN_HOSTS.indexOf(url.host) !== -1) {
    e.respondWith(staleWhileRevalidate(e));
  }
  /* any other origin: not intercepted */
});
