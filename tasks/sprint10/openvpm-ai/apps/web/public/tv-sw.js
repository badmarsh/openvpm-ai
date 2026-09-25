// Self-cleanup: remove rogue development caches and unregister service worker
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", () => {
  // Do not intercept any fetch requests - let browser handle network directly
});
