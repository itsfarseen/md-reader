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

// Manually poll for a new deployment. Resolves to a status the caller can
// surface to the user. If a newer worker exists, the usual updatefound flow
// (above) shows the refresh banner, so callers only need to report the result.
export async function checkForUpdates() {
  if (!("serviceWorker" in navigator)) return { supported: false };

  const reg = registration || (await navigator.serviceWorker.getRegistration());
  if (!reg) return { supported: false };

  await reg.update();

  // After update() the browser starts installing any new worker, or a fresh
  // one may already be waiting — either means an update is on its way.
  return { supported: true, updateAvailable: !!(reg.installing || reg.waiting) };
}
