const CACHE_NAME = "gain-tracker-pwa-v33-individual-centered-icons-20260721";
const CORE_ASSETS = [
  "./index.html",
  "./ai-companion.css",
  "./ai-companion.js",
  "./plan-modules.css",
  "./ui-icons.css",
  "./icons/module/push.png",
  "./icons/module/pull.png",
  "./icons/module/shoulders.png",
  "./icons/module/legs_core.png",
  "./icons/module/hiit.png",
  "./icons/module/arms_grip.png",
  "./icons/module/mobility.png",
  "./icons/module/rest.png",
  "./icons/module/drag.png",
  "./icons/module/link.png",
  "./icons/ui/plan.png",
  "./icons/ui/record.png",
  "./icons/ui/history.png",
  "./icons/ui/tools.png",
  "./icons/ui/complete.png",
  "./icons/app-icon-192.png",
  "./icons/app-icon-512.png",
  "./训练动作库/actions.json",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isMediaRequest =
    url.pathname.includes("/gifs/") ||
    event.request.destination === "image";

  if (isMediaRequest) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkUpdate = fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              const cloned = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
            }
            return response;
          })
          .catch(() => null);

        return cached || networkUpdate.then((response) => {
          if (response) return response;
          return new Response("离线中，且该图片尚未缓存。", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.mode === "navigate") {
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
        }

        return new Response("离线中，且该资源尚未缓存。", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      })
  );
});
