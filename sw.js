// Service worker: offline caching for the app shell + pinned CDN libraries.
//
// CACHE_VERSION MUST match APP_VERSION in version.js. Bumping it on every PR
// invalidates old caches and drives the "new version — refresh" prompt.
const CACHE_VERSION = "0.1.0";
const CACHE_NAME = `md-reader-v${CACHE_VERSION}`;

// App shell (same-origin) precached on install.
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./version.js",
  "./css/app.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/reader.js",
  "./js/theme.js",
  "./js/update.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
];

// Pinned CDN assets precached so the reader renders fully offline.
const CDN_ASSETS = [
  "https://cdn.jsdelivr.net/npm/marked@18.0.5/lib/marked.umd.js",
  "https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css",
  "https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.js",
  "https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/contrib/auto-render.min.js",
  "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/highlight.min.js",
  "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/styles/github.min.css",
  "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/styles/github-dark.min.css",
  "https://cdn.jsdelivr.net/npm/github-markdown-css@5.9.0/github-markdown-light.css",
  "https://cdn.jsdelivr.net/npm/github-markdown-css@5.9.0/github-markdown-dark.css",
];

const CDN_ORIGIN = "https://cdn.jsdelivr.net";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // App shell must all succeed; CDN assets are best-effort (network may
      // hiccup) and will be filled in on demand by the fetch handler.
      await cache.addAll(APP_SHELL);
      await Promise.allSettled(
        CDN_ASSETS.map((url) =>
          cache.add(new Request(url, { mode: "cors" })).catch(() => {})
        )
      );
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isCDN = url.origin === CDN_ORIGIN;
  if (!sameOrigin && !isCDN) return; // don't intercept anything else

  // CDN (versioned, immutable): cache-first, fill on demand.
  if (isCDN) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((resp) => {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
            return resp;
          })
      )
    );
    return;
  }

  // Same-origin navigations: network-first, fall back to cached shell so the
  // app opens offline; deep links resolve to the SPA entry point.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        return (
          (await caches.match(request)) ||
          (await caches.match("./index.html")) ||
          (await caches.match("./"))
        );
      })
    );
    return;
  }

  // Other same-origin assets: cache-first, then network.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return resp;
        })
    )
  );
});
