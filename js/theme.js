// Manual light/dark theme, persisted globally.
// Toggles the GitHub-markdown and highlight.js stylesheet variants by
// enabling/disabling the corresponding <link> elements, and sets
// data-theme on <html> for app chrome.

const KEY = "mdreader.theme";

function systemTheme() {
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function getTheme() {
  return localStorage.getItem(KEY) || systemTheme();
}

function apply(theme) {
  const dark = theme === "dark";
  document.documentElement.setAttribute("data-theme", theme);

  const set = (id, enabled) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  };
  set("md-theme-light", !dark);
  set("md-theme-dark", dark);
  set("hl-theme-light", !dark);
  set("hl-theme-dark", dark);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0d1117" : "#ffffff");
}

export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  apply(theme);
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

// Apply immediately on import to avoid a flash of the wrong theme.
apply(getTheme());
