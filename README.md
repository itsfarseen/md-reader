# Markdown Reader

An installable, offline-capable PWA for reading Markdown files in the browser —
styled like GitHub, with LaTeX math and code syntax highlighting. Pure vanilla
JavaScript, no build step.

## Features

- **Upload markdown to browser storage** — files are stored locally in IndexedDB.
- **File library** — uploaded files are listed on the home page (name, size, date).
- **Reader view** — tap a file to open a scrollable reader.
- **GitHub rendering style** — via [`github-markdown-css`](https://github.com/sindresorhus/github-markdown-css)
  (same fonts, line-height and spacing as GitHub).
- **LaTeX math** — rendered with [KaTeX](https://katex.org/), the same renderer used
  by claude.ai. Supports `$…$` / `\(…\)` (inline) and `$$…$$` / `\[…\]` (display).
- **Code syntax highlighting** — via [highlight.js](https://highlightjs.org/).
- **Center-tap font toolbar** — tap the middle of the reader to reveal a bottom
  toolbar (A− / A+ / Reset). Font size is stored **globally** and applied to every file.
- **Light / dark theme** — manual toggle, persisted globally.
- **Installable PWA** — add to home screen; works **fully offline** after the first
  load (the service worker caches the app shell *and* the pinned CDN libraries).
- **Automatic update detection** — when a new version is deployed, existing users are
  prompted to refresh.

## Running locally

The app is fully static, but service workers and PWA installation require an
`http(s)` origin (not `file://`). Serve the directory with any static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tech / dependencies

Rendering libraries are loaded from [jsDelivr](https://www.jsdelivr.com/) at pinned
versions (declared in `index.html` and precached in `sw.js`):

| Library | Version | Purpose |
| --- | --- | --- |
| marked | 18.0.5 | Markdown → HTML |
| KaTeX | 0.17.0 | LaTeX math rendering |
| highlight.js | 11.11.1 | Code syntax highlighting |
| github-markdown-css | 5.9.0 | GitHub markdown styling |

There is no bundler and no runtime `npm install`; the app's own code is plain ES
modules under `js/`.

### Project layout

```
index.html            App shell; loads pinned CDN libs + app modules
manifest.webmanifest  PWA manifest
sw.js                 Service worker (offline cache + update flow)
version.js            APP_VERSION — single source of truth
css/app.css           App chrome (not markdown styling)
js/app.js             Router, home view, upload, version display
js/storage.js         IndexedDB wrapper
js/reader.js          Markdown/math/code rendering + font toolbar
js/theme.js           Light/dark toggle
js/update.js          Service-worker registration + refresh prompt
icons/                PWA icons (placeholder — replace as desired)
```

## Development

**Every PR must increment the version string.** Two constants must be bumped
**together** and kept in sync:

1. `APP_VERSION` in [`version.js`](./version.js) — shown in the app footer and used
   by the update check.
2. `CACHE_VERSION` in [`sw.js`](./sw.js) — the service-worker cache key.

Bumping the version is what changes the service worker, which is how existing users
detect the update: the new worker installs in the background and the app shows a
**"A new version is available — Refresh"** banner. The current version is displayed
in the footer on the home page.

Use [semantic versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`). If you add or
change the pinned CDN library versions, update them in **both** `index.html` and the
`CDN_ASSETS` list in `sw.js`.
