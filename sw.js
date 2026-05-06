const CACHE_NAME = "gain-tracker-pwa-v4-real-exercise-gifs";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/app-icon.svg",
  "./gifs/0259.gif",
  "./gifs/0274.gif",
  "./gifs/0276.gif",
  "./gifs/0279.gif",
  "./gifs/0289.gif",
  "./gifs/0293.gif",
  "./gifs/0308.gif",
  "./gifs/0310.gif",
  "./gifs/0313.gif",
  "./gifs/0334.gif",
  "./gifs/0383.gif",
  "./gifs/0405.gif",
  "./gifs/0430.gif",
  "./gifs/0620.gif",
  "./gifs/0652.gif",
  "./gifs/0662.gif",
  "./gifs/0687.gif",
  "./gifs/0705.gif",
  "./gifs/0872.gif",
  "./gifs/0983.gif",
  "./gifs/0988.gif",
  "./gifs/1022.gif",
  "./gifs/1311.gif",
  "./gifs/1330.gif",
  "./gifs/1459.gif",
  "./gifs/1677.gif",
  "./gifs/1760.gif",
  "./gifs/2135.gif",
  "./gifs/3211.gif",
  "./gifs/adductor_stretch.webp",
  "./gifs/bird_dog.gif",
  "./gifs/custom_band_straight_arm_pulldown.gif",
  "./gifs/custom_bulgarian_split_squat.gif",
  "./gifs/custom_dumbbell_calf_raise.gif",
  "./gifs/custom_scapular_pull.gif",
  "./gifs/marching_on_spot.webp",
  "./gifs/pike_push_up.webp",
  "./gifs/standing_back_rotation_stretch.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
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

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
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
