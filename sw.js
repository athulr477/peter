// Beach Penalty Shootout — Service Worker
// Provides full offline play, instant loading, and asset caching

const CACHE_NAME = "beach-penalty-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/main.js",
  "./js/game.js",
  "./js/renderer.js",
  "./js/physics.js",
  "./js/goalkeeper.js",
  "./js/input.js",
  "./js/audio.js",
  "./js/particles.js",
  "./assets/beach-goal-bg.webp",
  "./assets/soccer-ball.webp",
  "./assets/goalkeeper-guard-cutout.webp",
  "./assets/goalkeeper-ready-cutout.webp",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/favicon.png"
];

// Install: precache core game files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn("Some assets failed to precache:", err);
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate: delete outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch: cache-first for assets & audio; network-first for navigation
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET and cross-origin tracking requests
  if (req.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // Google Fonts & external CDNs: stale-while-revalidate
  if (url.origin.includes("fonts.googleapis.com") || url.origin.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(req).then((cachedResponse) => {
          const fetchPromise = fetch(req).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(req, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // HTML navigation: network-first, fallback to cached index.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
          return networkResponse;
        })
        .catch(() => {
          return caches.match("./index.html") || caches.match("/");
        })
    );
    return;
  }

  // Local static game assets: Cache-first, fallback to network
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const cloned = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, cloned);
        });
        return networkResponse;
      });
    })
  );
});

// Allow client to trigger instant skipWaiting on update
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
