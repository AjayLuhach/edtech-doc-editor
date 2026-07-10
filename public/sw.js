// Progressive enhancement: cache the app shell + assets so visited pages reload while fully offline.
// The document data itself comes from IndexedDB; this only makes navigation/reload work without network.
const CACHE = "edtech-doc-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // server actions are POSTs — always network (auth + freshness)

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Pages and other GETs: network-first, fall back to cache when offline.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok && (req.mode === "navigate" || url.pathname.startsWith("/documents"))) {
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const hit = (await cache.match(req)) ?? (await cache.match("/documents"));
        if (hit) return hit;
        throw new Error("offline and uncached");
      }
    })(),
  );
});
