// Service-worker registration + "new version available" prompt.
//
// When a new service worker (from a bumped APP_VERSION) finishes installing
// while an old one still controls the page, we surface a refresh banner.
// Clicking Refresh tells the waiting worker to activate, then reloads.

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
