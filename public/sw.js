// Kill switch: the offline cache (v1) could leave some phones hanging on open.
// Phones that still have that worker installed fetch this file on their next
// visit; it wipes every cache, unregisters itself and reloads open tabs.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    clients.forEach((c) => c.navigate(c.url))
  })())
})
