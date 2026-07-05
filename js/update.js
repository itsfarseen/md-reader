// Service-worker registration + "new version available" prompt.
//
// When a new service worker (from a bumped APP_VERSION) finishes installing
// while an old one still controls the page, we surface a refresh banner.
// Clicking Refresh tells the waiting worker to activate, then reloads.

// Registration is stashed once initUpdates runs so the "Check for updates"
// link in the home footer can trigger a manual check on demand.
let registration = null;

export function initUpdates() {
  if (!("serviceWorker" in navigator)) return;

  const banner = document.getElementById("update-banner");
  const refreshBtn = document.getElementById("update-refresh");
  const dismissBtn = document.getElementById("update-dismiss");

  let waitingWorker = null;
  let reloading = false;

  const showBanner = (worker) => {
    waitingWorker = worker;
    if (banner) banner.hidden = false;
  };

  refreshBtn?.addEventListener("click", () => {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  });
  dismissBtn?.addEventListener("click", () => {
    if (banner) banner.hidden = true;
  });

  // When the new worker takes control, reload once to get fresh assets.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register("./sw.js")
    .then((reg) => {
      registration = reg;

      // A worker was already waiting when the page loaded.
      if (reg.waiting && navigator.serviceWorker.controller) {
        showBanner(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showBanner(newWorker);
          }
        });
      });

      // Proactively check for a new deployment on load and when the tab
      // regains focus, so redeploys are picked up without a manual reload.
      const check = () => reg.update().catch(() => {});
      check();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    })
    .catch((err) => console.warn("SW registration failed:", err));
}

// Hard "get the latest build now" escape hatch.
//
// The normal update flow (above) only reacts when the *bytes of sw.js* change,
// and even then it serves whatever the versioned cache holds — which can be
// stale if the precache captured old bytes (see AGENTS.md). This bypasses all
// of that: unregister every worker, drop every Cache Storage entry, then reload
// straight from the network. On the next load a fresh worker re-registers and
// re-precaches from scratch. This never returns — the page navigates away.
export async function forceReload() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn("Force reload cleanup failed:", err);
  }
  // With the worker unregistered nothing intercepts fetches, so a plain reload
  // revalidates every asset against the server.
  window.location.reload();
}
