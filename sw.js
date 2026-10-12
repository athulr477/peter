// Beach Penalty Shootout — Service Worker
// Instant auto-refresh on updates + full offline play

const CACHE_NAME = "beach-penalty-v4";

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

// Install: precache core game files & skipWaiting immediately
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

// Activate: clean up older cache versions & claim clients
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

// Fetch handler:
// Network-first for JavaScript, CSS, and HTML navigation (ensures instant Vercel updates!)
// Cache-first for large media images
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

  // Code files (.js, .css, HTML): NETWORK-FIRST for instant deployment refresh
  const isCode = req.mode === "navigate" ||
                 url.pathname.endsWith(".js") ||
                 url.pathname.endsWith(".css") ||
                 url.pathname.endsWith(".html") ||
                 url.pathname === "/";

  if (isCode) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            if (cached) return cached;
            if (req.mode === "navigate") {
              return caches.match("./index.html") || caches.match("/");
            }
            return null;
          });
        })
    );
    return;
  }

  // Static media assets (/assets/ images, audio): Cache-first with network fallback
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(req)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, cloned);
          });
          return networkResponse;
        })
        .catch(() => {
          return caches.match(req);
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
