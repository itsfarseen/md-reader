# AGENTS.md

Guidance for anyone (human or agent) touching this repo. The app is a static,
build-less PWA served from the repo root. Because it caches itself aggressively
via a service worker, the single most common way to ship a broken release is to
get the **cache/versioning** wrong. Read this before changing `sw.js`,
`version.js`, or any asset that the service worker precaches.

## The two version constants — bump them together, every change

There are **two** version strings and they are a single logical value split
across two files:

1. `APP_VERSION` in [`version.js`](./version.js) — imported by `js/app.js` and
   shown in the home-page footer.
2. `CACHE_VERSION` in [`sw.js`](./sw.js) — used to name the Cache Storage bucket
   (`md-reader-v<CACHE_VERSION>`).

**Every change that touches shipped assets must bump both, to the same value.**
Use semver (`MAJOR.MINOR.PATCH`). They are deliberately kept in lockstep; if
they drift you get the confusing failure modes below.

## Why the version bump matters (the cache model)

The service worker serves same-origin sub-resources (`js/*.js`, `version.js`,
`css/app.css`, icons) **cache-first** — once a URL is in the cache it is
returned from cache and *never revalidated against the network*
(`sw.js`, the "other same-origin assets" branch of the `fetch` handler).

The only thing that flushes those cached bytes is a **new cache name**, and the
cache name is derived from `CACHE_VERSION`. So:

- Bumping `CACHE_VERSION` → new cache name → new worker precaches a fresh copy of
  everything on `install` and deletes the old cache on `activate`.
- Not bumping it → users keep getting the old cached assets forever.

The top-level document (navigation requests) is the one exception: it's
**network-first**, so a fresh `index.html` can come down. But `index.html`
references the same `./js/app.js` URL, which is still served cache-first — so a
fresh shell will still load stale JS. **The HTML being fresh does not save you.**

## Gotcha #1 — asset changed but `sw.js` did not

If you edit `js/app.js` (or any precached asset) but forget to bump
`CACHE_VERSION`, the `sw.js` bytes are unchanged. The browser therefore sees **no
new worker**: `updatefound` never fires, no re-precache happens, the old cache is
never cleared, and **no "new version available" banner is shown**. Existing users
are silently frozen on the old build with no in-app way to recover (short of the
Force reload button, a hard reload, or clearing site data).

This is the failure the "bump on every change" rule exists to prevent.

## Gotcha #2 — `sw.js` changed, user refreshed, but the app is still old

Symptom: a new deploy went out, the update banner appeared, the user clicked
**Refresh**, the page reloaded — and the footer version (or the behavior) is
still the old one. The Refresh mechanism worked; the **new worker's precache
captured stale bytes**. Common causes:

1. **HTTP cache / CDN edge poisoned the precache.** `cache.addAll(APP_SHELL)` in
   the `install` handler issues ordinary `fetch()`es that obey normal HTTP
   caching. If the host sends a long `Cache-Control: max-age` on the JS/CSS, or a
   CDN edge hasn't purged, the new worker faithfully stores the **old** bytes in
   the **new** cache. Everything looks right; the payload is stale.
2. **Non-atomic deploy / propagation race.** `sw.js` propagated before the app
   assets did, so `install` precached the old `app.js`/`version.js`. Result: new
   worker logic + old assets.
3. **Only one constant was bumped/deployed.** If `CACHE_VERSION` moved but
   `version.js` didn't (or they deployed out of sync), the worker updates and the
   banner fires, but the footer string genuinely never changed.

### Hardening options (if #1/#2 keep biting)

- Bypass the HTTP cache when precaching: fetch with
  `cache.add(new Request(url, { cache: "reload" }))` so `install` always pulls
  fresh bytes from the network instead of the browser cache.
- Fingerprint asset filenames per build (e.g. `app.abc123.js`) so URLs change
  when contents change — this makes cache-first correct by construction. Note
  this requires a build step, which the project currently avoids on purpose.
- Ensure deploys are atomic (publish all files together) so no propagation race
  window exists.

## The update flow, end to end

- **Triggers** (`js/update.js`, `initUpdates`): `reg.update()` runs on page load
  and again on every `visibilitychange` to visible; the browser also re-checks
  `sw.js` on its own. All of these only detect a change if the **`sw.js` bytes
  differ** — hence the version bump.
- **Banner shown when**: a new worker reaches `installed` *and* there's already a
  controlling worker (`navigator.serviceWorker.controller` is set). The
  controller check is what suppresses the banner on a first-ever visit.
- **Refresh clicked**: the page posts `SKIP_WAITING` to the waiting worker →
  `sw.js` calls `skipWaiting()` → the new worker activates → `controllerchange`
  fires → the page reloads once (guarded by a `reloading` flag) onto the new
  worker's cache.

## The Force reload escape hatch

Next to the version string in the footer there's a **Force reload** button
(`forceReload` in `js/update.js`). Unlike the banner flow, it does **not** depend
on `sw.js` changing: it unregisters every service worker, deletes every Cache
Storage bucket, then reloads from the network. On the next load a fresh worker
re-registers and re-precaches from scratch. Use it (or point users to it) when
you suspect a stale cache regardless of version state. It is the manual recovery
path for both gotchas above.

## Quick checklist for a change

- [ ] Bumped `APP_VERSION` in `version.js`.
- [ ] Bumped `CACHE_VERSION` in `sw.js` to the **same** value.
- [ ] If you changed a pinned CDN library, updated it in **both** `index.html`
      and the `CDN_ASSETS` list in `sw.js`.
- [ ] If you added a new precached same-origin asset, added it to `APP_SHELL` in
      `sw.js`.
