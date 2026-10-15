// Offline support: network-first for everything same-origin, falling back to
// the cache when the network is down or slow. Network-first (not cache-first)
// because the build ships fixed file names (index.js, index.css) — cache-first
// would keep serving an old version after a deploy. Firebase/API calls are
// cross-origin and never touched here; app data has its own offline cache
// (Firestore persistentLocalCache, see src/firebase.js).
const CACHE = 'arkad-v1'
const SHELL = ['./', 'index.js', 'index.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.svg']
const NETWORK_TIMEOUT_MS = 4000

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false
    const fromCache = () => caches.match(request, { ignoreSearch: true })
    const timer = setTimeout(() => {
      fromCache().then((hit) => { if (hit && !settled) { settled = true; resolve(hit) } })
    }, NETWORK_TIMEOUT_MS)
    fetch(request)
      .then((response) => {
        clearTimeout(timer)
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        if (!settled) { settled = true; resolve(response) }
      })
      .catch(async () => {
        clearTimeout(timer)
        if (settled) return
        const hit = (await fromCache()) || (request.mode === 'navigate' ? await caches.match('./') : null)
        settled = true
        resolve(hit || Response.error())
      })
  })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return
  // Audio/video use Range requests (206) which the Cache API can't store.
  if (request.headers.has('range')) return
  event.respondWith(networkFirst(request))
})
