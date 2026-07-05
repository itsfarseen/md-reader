// Single source of truth for the app version.
//
// IMPORTANT: Every PR must increment this string (see README "Development").
// The service worker (sw.js) keeps its own copy of this constant in
// CACHE_VERSION — bump both together. Changing the version is what triggers
// the "New version available — Refresh" prompt for existing users.
export const APP_VERSION = "0.3.4";
