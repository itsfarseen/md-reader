// PWA install affordance: a header button that installs the app.
//
// The button is shown whenever the app is NOT already running standalone.
// On Chromium (Chrome/Edge, desktop + Android) the browser fires
// `beforeinstallprompt`; we stash that event and replay it from a click to get
// the native one-tap install. Every other engine (iOS Safari, Firefox, desktop
// Safari) has no JS install API, so the same button opens platform-specific
// "Add to Home Screen" instructions instead. When the app runs standalone the
// button hides itself, since there's nothing left to install.

// The captured beforeinstallprompt event, or null until/unless one fires.
let deferredPrompt = null;

// Live install buttons in the DOM. renderHome() rebuilds the header on every
// navigation, so we track buttons here and refresh their visibility on state
// changes rather than assuming a single, long-lived element.
const buttons = new Set();

// True when the page is running as an installed PWA (standalone / fullscreen).
// matchMedia covers Chromium/Android/desktop; navigator.standalone covers iOS.
export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

function refreshButtons() {
  const hidden = isStandalone();
  for (const btn of buttons) btn.hidden = hidden;
}

// Register the global listeners once, mirroring initUpdates() in update.js.
export function initInstall() {
  // Chromium: capture the install prompt so we can trigger it from our button.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    refreshButtons();
  });

  // Once installed, drop the prompt and hide the button.
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    refreshButtons();
  });

  // Hide/show if the display mode flips (e.g. launched into standalone).
  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", refreshButtons);
}

// Returns a header button that installs the app (or shows instructions).
// Mirrors themeButton() in app.js.
export function createInstallButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "install-btn";
  btn.textContent = "⬇️ Install";
  btn.hidden = isStandalone();
  buttons.add(btn);

  btn.addEventListener("click", async () => {
    if (deferredPrompt) {
      // Native Chromium prompt. It can only be used once, so clear it after.
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } finally {
        deferredPrompt = null;
        refreshButtons();
      }
      return;
    }
    // No native prompt on this engine: show manual instructions.
    showInstructions();
  });

  return btn;
}

// Platform sniff, only to pick which manual instructions to show.
function platformInstructions() {
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as desktop Safari but exposes touch.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // On iOS every browser is WebKit; only Safari can Add to Home Screen.
  const isIOSSafari =
    isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  if (isIOSSafari) {
    return "Tap the Share icon, then choose <strong>Add to Home Screen</strong>.";
  }
  if (isIOS) {
    return "Open this page in <strong>Safari</strong>, then tap Share → <strong>Add to Home Screen</strong>.";
  }
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
  if (isSafari) {
    return "In the menu bar choose <strong>File → Add to Dock</strong> to install this app.";
  }
  if (/Firefox/.test(ua)) {
    return "Firefox installs web apps from its menu on some platforms; otherwise your browser may not support installing this app.";
  }
  return "Use your browser's menu and look for <strong>Install</strong> or <strong>Add to Home Screen</strong>.";
}

// Lightweight, framework-free modal. Dismisses on close button, overlay click,
// or Escape.
function showInstructions() {
  const overlay = document.createElement("div");
  overlay.className = "install-modal";

  const dialog = document.createElement("div");
  dialog.className = "install-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Install Markdown Reader");

  const title = document.createElement("h2");
  title.textContent = "Install Markdown Reader";

  const body = document.createElement("p");
  body.innerHTML = platformInstructions();

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Got it";

  const dismiss = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") dismiss();
  };

  close.addEventListener("click", dismiss);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismiss();
  });
  document.addEventListener("keydown", onKey);

  dialog.append(title, body, close);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  close.focus();
}
