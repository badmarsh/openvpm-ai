// TV čakáreň – offline cache pre výpadky wifi (cache-first, sieťové obnovenie na pozadí).
const CACHE = "tv-cache-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin === location.origin || url.hostname.includes("pexels.com") || url.hostname.includes("images.pexels.com")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        const network = fetch(e.request)
          .then((res) => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
