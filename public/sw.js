/* Offline app shell for the local-first POS. Transaction data stays in this browser. */
const CACHE_NAME = "mi-tienda-pos-shell-v1";
const OFFLINE_URL = "/offline.html";
const APP_ROUTES = [
  "/login", "/dashboard", "/pos", "/inventory", "/sales", "/returns",
  "/customers", "/suppliers", "/purchase-orders", "/reports", "/operations",
  "/loyalty", "/labels", "/cash", "/users", "/settings",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.add(OFFLINE_URL);
    await cache.add("/manifest.json").catch(() => undefined);
    await Promise.all(APP_ROUTES.map(async (route) => {
      try {
        const response = await fetch(route, { cache: "reload" });
        if (response.ok) await cache.put(route, response);
      } catch {
        // A route can be cached the first time it is visited while online.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("mi-tienda-pos-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) {
          const key = `${url.pathname}${url.search}`;
          await cache.put(key, response.clone());
          if (!url.search) await cache.put(url.pathname, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(request) || await cache.match(url.pathname) || await cache.match(OFFLINE_URL);
        return cached || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    })());
  }
});
