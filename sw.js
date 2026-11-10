const CACHE_NAME = "gain-tracker-pwa-v34-compact-plan-editor-20261110";
const MEDIA_CACHE_NAME = "gain-exercise-media-v1";
const CORE_ASSETS = [
  "./index.html",
  "./training-core.js?v=20261110-sets1",
  "./training-ui.js?v=20261110-plan2",
  "./exercise-media.js?v=20261110-media2",
  "./exercise-media.css?v=20261110-media2",
  "./训练动作库/media-manifest.json",
  "./plan-editor-ui.js?v=20261110-plan2",
  "./plan-editor.css?v=20261110-plan2",
  "./training-enhancements.css?v=20261110-sets1",
  "./训练动作库/muscle-regions.json",
  "./训练动作库/actions.json",
  "./manifest.webmanifest",
  "./icons/app-icon.svg"
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
    (async () => {
      const mediaCache = await caches.open(MEDIA_CACHE_NAME).catch(() => null);
      for(const name of await caches.keys()){
        if(name === CACHE_NAME || name === MEDIA_CACHE_NAME) continue;
        if(!mediaCache) continue;
        let preservePrevious = false;
        try {
        const previous = await caches.open(name);
        for(const request of await previous.keys()){
          if(!new URL(request.url).pathname.includes('/gifs/')) continue;
          if(await mediaCache.match(request)) continue;
          const response = await previous.match(request);
          if(response?.ok){try{await mediaCache.put(request,response);}catch(error){preservePrevious=true;}}
        }
        if(!preservePrevious) await caches.delete(name);
        } catch(error) { /* Retain a cache that could not be inspected; optional media migration must not block activation. */ }
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isMediaRequest =
    url.pathname.includes("/gifs/") ||
    event.request.destination === "image";

  if(url.pathname.includes('/gifs/')){
    event.respondWith((async () => {
      const cache = await caches.open(MEDIA_CACHE_NAME).catch(() => null);
      const cached = (cache && await cache.match(event.request)) || await caches.match(event.request).catch(() => null);
      if(cached) return cached;
      try{
        const response = await fetch(event.request);
        if(response.ok&&cache){try{await cache.put(event.request,response.clone());}catch(error){/* Cache quota must not prevent viewing a downloaded image. */}}
        return response;
      }catch(error){
        return new Response('动图尚未缓存，请联网后重试。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }

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
