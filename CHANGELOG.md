# Changelog

A source-of-truth history for **Web Design Ruler** by LXB Studio LLC,
reconstructed from on-disk source, Firefox AMO version history, the Chrome
Web Store listing, the Microsoft Edge Add-ons JSON API, and zip-archive
timestamps. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions adhere to [Semantic Versioning](https://semver.org/).

Five released versions to date, plus an unreleased prototype (`1.0` as
**LXB Studio Design Assistant**) and an unreleased Firefox dev build with
a sidebar UI cut before AMO submission. Newest first.

## [Unreleased]

## [2.0.2] — 2026-07-06

Phase 1 audit cleanup: 11 bug fixes across all three builds. No new
permissions, no new dependencies, no telemetry. Offline-by-design preserved.

### Fixed

- **Tool stacking corrupts page styles** (Fix 1.1). No mutual exclusion
  between tools — activating a second tool captured the first tool's
  modified cursor/userSelect as "original," leaving the page stuck with a
  crosshair cursor and no text selection. Added module-scoped
  `activeToolCleanup`; activating a new tool runs the previous cleanup
  *before* snapshotting body styles.
- **"+ New Palette" silently overwrites existing** (Fix 1.2).
  `createPalette` assigned unconditionally; typing an existing name erased
  its colors. Now accepts `{ overwrite }` option and returns `false` with
  `'exists'` reason. Import auto-renames to `Name (2)`, `Name (3)`, … and
  validates colors (≤ 200 hex strings, 3-digit normalized to 6).
- **Keyboard shortcuts collide with browser built-ins** (Fix 1.3).
  `Ctrl+Shift+R` (hard reload) and `Ctrl+Shift+P` (Private/InPrivate)
  never bound. Switched to `Alt+Shift+R/P` for popup and color picker.
  Added `activate_font_detector` (`Alt+Shift+F`) and
  `activate_measure_tool` (`Alt+Shift+M`) — 4 commands total, the Chrome
  maximum.
- **Palette CRUD used `prompt()`/`confirm()`** (Fix 1.4). Native dialogs
  are unreliable in extension popups. Replaced with inline UI: create/rename
  use inline input rows (Enter/Esc), delete uses a two-step confirm button
  (3 s window), remove-color uses a floating confirm chip (click-away/Esc
  cancel). Keyboard accessible with real `<button>`s and `aria-label`s.
- **`recentColors` double-writer race** (Fix 1.5). Content script and
  background both did read-modify-write on `recentColors` with different
  dedupe semantics. Content script no longer writes storage — it only
  `sendMessage`s. Background remains the single writer with move-to-front
  dedupe and 20-item cap.
- **Content script throws after extension reload** (Fix 1.6).
  `chrome.runtime.sendMessage` throws "Extension context invalidated"
  synchronously after update/reload, killing the confirmation UI and
  cleanup timer. Added `extAlive()`/`safeSend()` helpers; all
  `sendMessage` calls route through them. Tool still completes local UX.
- **Font detector inspects its own panel** (Fix 1.7). `onMouseMove`
  checked `element === panel` but missed descendants. Changed to
  `panel.contains(element)` and `highlightBox.contains(element)`.
- **"Save Font" writes data no UI shows** (Fix 1.8). Added a collapsible
  "Saved Fonts" list in the Font tab (up to 10 entries, clickable to
  re-display, ✕ remove). Built with `createElement`/`textContent`.
- **Edge keep-alive alarm below platform minimum** (Fix 1.9).
  `KEEP_ALIVE_INTERVAL_MINUTES = 0.4` (24 s) was below Chromium's ≥ 30 s
  clamp. Renamed to `WAKE_UP_INTERVAL_MINUTES`, set to 0.5. Comments and
  AUDIT.md corrected: the alarm is a wake-up, not a keep-alive.
- **`innerHTML` with page-controlled strings** (Fix 1.10). Font stack
  strings from inspected pages flowed into `innerHTML`, enabling markup
  injection. Rebuilt all panel updates and `displayFontDetails` with
  `createElement`/`textContent`; font-family stacks applied via
  `style.fontFamily` property. Zero `innerHTML` in content scripts.
- **Correctness edge-case batch** (Fix 1.11): image/canvas/video pixel
  coords subtract border+padding before scaling (divide-by-zero guards);
  `rgbToHex` canvas fallback for `color(srgb)`/`lab()`; context-menu
  passes `tab` through to `activateTool`; popup version badge from
  manifest; measure labels clamped to viewport; measure `mouseup` on
  `window` + `mouseleave` on `documentElement`; `.notification.info` CSS;
  font preview uses `fontFamilyStack` (guarded); `fontWeight.split`
  guarded with `String()`; `onMessage` cases return `false`; removed
  dead `selectedColorType`.

### Changed
- All three manifests bumped `2.0.1` → `2.0.2`.
- Keyboard shortcuts changed from `Ctrl+Shift+R/P` to `Alt+Shift+R/P/F/M`.
- Edge alarm constant renamed `KEEP_ALIVE_INTERVAL_MINUTES` →
  `WAKE_UP_INTERVAL_MINUTES` (alarm name `wdr-keep-alive` unchanged).

### Store status
- **Firefox AMO** — pending upload.
- **Chrome Web Store** — pending upload.
- **Edge Add-ons** — pending upload.
- **GitHub** — branch `fix/v2.0.2` pushed; no tag (deep check first).

## [2.0.1] — 2026-05-23

Firefox popup-handler fix. One file, one function, real user impact.

### Fixed
- **Firefox popup tool buttons.** `firefox/popup/popup.js` passed a callback
  as the second argument to `browser.runtime.sendMessage`. Firefox's
  WebExtensions API treats that argument as `options`, not a callback, so
  the response handler at the call site never executed. Clicking
  *Activate Color Picker / Font Detector / Measurement Tool* in the popup
  would either silently close the popup or do nothing. v2.0.0 shipped to
  AMO on 2026-01-13 with the bug intact for ~4 months. `activateTool` is
  now `async` and awaits the Promise with `try/catch` error surfacing.
- Clearer error notifications when a tool can't run (browser-internal
  pages, `file://` URLs, restricted tabs).

### Changed
- All three manifests bumped `2.0.0` → `2.0.1`. No source changes to
  chrome/edge builds beyond version sync.

### Store status
- **Firefox AMO** — published 2026-05-23.
- **Chrome Web Store** — pending upload, listing still on `2.0.0`.
- **Edge Add-ons** — pending upload, listing still on `2.0.0`.
- **GitHub** — tagged `v2.0.1` with CI-built artifacts attached to the
  Release.

## [2.0.0] — 2026-01-13

Complete multi-browser rebuild. Three purpose-built unpacked extensions
under `chrome/`, `edge/`, `firefox/`. First appearance of WDR on
Microsoft Edge.

### Added
- **Native Microsoft Edge support.** Edge aggressively terminates service
  workers after ~30 seconds of idle. The Edge build now keeps the SW alive
  with `chrome.alarms.create('wdr-keep-alive', {periodInMinutes: 0.4})`
  firing every ~24 s, plus a `chrome.storage.local` touch on each alarm
  fire so the runtime knows the SW is alive.
- **Explicit `host_permissions`** (`http://*/*`, `https://*/*`) across all
  three manifests; previously implicit via `content_scripts.matches` on
  Chrome and via the MV2 `<all_urls>` permission on Firefox.
- **Modern `navigator.clipboard.writeText`** with `document.execCommand`
  fallback only on rejection. Replaces the deprecated execCommand-first
  pattern in v1.x.
- **Duplicate-injection guard** — `window.__WDR_CONTENT_SCRIPT_LOADED__`
  wraps the entire content script, so repeated activations don't pile up
  event listeners or panels.
- **Context-menu recreation on `onStartup` + immediate script-load.**
  Menus survive a mid-session SW restart on Edge.
- **`world: 'ISOLATED'`** explicit on every `chrome.scripting.executeScript`
  in chrome/edge builds. Firefox deliberately omits this parameter
  (Firefox didn't support it at build time).
- **Per-browser logging tags** — `[WDR]`, `[WDR-Edge]`, `[WDR-Firefox]`
  — to make triage clearer when a user reports an issue across browsers.

### Changed
- **Firefox migrates to native `browser.*` Promise APIs** throughout the
  background and content script (via a `browserAPI = browser ?? chrome`
  shim). The XSS hardening from 1.1.1 is preserved — the Firefox content
  script still uses `createElement` + `textContent` everywhere.
- **Every `chrome.*` callback API now checks `chrome.runtime.lastError`**
  instead of swallowing failures. Edge background covers ~11 sites;
  Chrome covers critical paths.
- **Ping timeout** raised 500 → 1000 ms (Chrome / Firefox), 500 → 1500 ms
  (Edge). **Retries** raised 1 → 3 (Chrome / Firefox), 1 → 4 (Edge).
  *Note:* the README claims "exponential backoff" but the actual
  implementation is a fixed 200 ms gap with a 1.5× post-inject wait — a
  documented but minor discrepancy.
- **Default palettes** reduced to two cross-browser seeds: `Web Design
  Ruler` (5 colors starting `#2563EB`, the new brand blue) and
  `Neutrals`. The LXB Studio / Material Design / Firefox Theme palettes
  from v1.x are gone.
- **Firefox `strict_min_version`** raised `78.0` → `109.0` for MV3.

### Removed
- The `notifications` permission (Firefox 1.1.1 only).
- The MV2 `<all_urls>` permission (replaced by `host_permissions`).
- The three extra keyboard shortcuts `activate_font_detector`
  (Ctrl+Shift+F) and `activate_measure_tool` (Ctrl+Shift+M) — only the
  popup-open (Ctrl+Shift+R) and color-picker (Ctrl+Shift+P) shortcuts
  remain across all builds.
- Firefox-exclusive features that landed in 1.1.1 and were dropped here
  for cross-browser parity: welcome page, badge state animations, nested
  context-menu submenu, "Copy All Colors on Page" action, Firefox sync
  hooks, theme awareness, Firefox-themed palette. Restoration planned
  for v2.2 — see [ROADMAP.md](./ROADMAP.md).

### Fixed
- **Edge:** tool activation silently failing after ~30 s of idle.
- **Edge:** right-click menus disappearing after the SW restarted
  mid-session.
- **All browsers:** a slow first ping no longer falsely concludes that
  the content script isn't loaded (longer timeout + retries).
- **All browsers:** clipboard reliably populated on modern Firefox
  contexts (`navigator.clipboard` preferred, execCommand fallback only).

### Store status
- **Firefox AMO** — published 2026-01-13.
- **Chrome Web Store** — published 2026-01-19 (~6-day store review).
- **Edge Add-ons** — published concurrent with Firefox; this was the
  first time WDR appeared on Edge.

### Architecture notes
- Background per browser: Chrome **module service worker**, Edge
  **module service worker**, Firefox **non-persistent background
  script** (Firefox's MV3 model does not use a service worker).
- Restricted-URL lists differ per build but behaviorally equivalent
  per-platform.
- Bundle sizes uncompressed: Chrome ~125 KB, Edge ~129 KB, Firefox
  ~117 KB. JS+HTML+CSS is roughly 60–70 KB per build; the rest is icons.

## [1.1.1] — 2025-06-10

Firefox-only release. XSS hardening plus a stack of Firefox-exclusive
features that wouldn't return until the v2.2 plan.

### Added
- **First-run welcome page** at `welcome/welcome.html` opens automatically
  on `runtime.onInstalled` (reason `install`). Hero badge, animated icon,
  feature grid, shortcut cheat-sheet — a real onboarding moment.
- **Toolbar badge state animation** — green `●` while a tool is active,
  `✓` after a successful pick/detect/measure, clears after 2 s.
- **Nested right-click "Web Design Ruler" submenu** with emoji-prefixed
  children (`🎨 Pick Color`, `🔤 Identify Font`, `📐 Measure Element`)
  and a separator. v1.1 Chrome had three flat sibling items.
- **"📋 Copy All Colors on Page" quick-action** — walks the page, dedupes
  computed colors, builds an auto-named `Page Colors - <date>` palette,
  and copies the colors as CSS custom properties to the clipboard.
- **Notification surfacing** when a tool can't activate on a restricted
  URL — uses the `notifications` permission.
- **Firefox-themed default palette** (`#FF9500`, `#002147`, `#00FEFF`,
  `#B1B1B3`, `#FFFFFF`) added to LXB Studio / Material Design /
  Neutrals.
- **Two new keyboard shortcuts** beyond what Chrome 1.1 had:
  `activate_font_detector` (Ctrl+Shift+F) and `activate_measure_tool`
  (Ctrl+Shift+M).
- **Firefox sync hooks** — `browser.storage.sync` wired up behind a
  `syncEnabled` flag, intended for cross-device palette sync via
  Firefox Account.
- **Theme awareness** — `browser.theme.onUpdated` listener registered
  and `getThemeColors` is a supported message (designed to drive
  theme-aware palette generation; not yet exposed in UI).
- **`notifications`** and **`clipboardWrite`** permissions.
- **`web_accessible_resources`** — `assets/icons/*.png`,
  `welcome/welcome.html`.

### Changed
- **Background converted to `browser.*` Promises** with `async/await`
  throughout. Chrome 1.1 used callback-style `chrome.*` APIs.
- **MV2** (`browser_action`, non-persistent event page) — Firefox didn't
  support full MV3 at the time of submission.
- **`strict_min_version: "78.0"`**.

### Fixed
- **XSS hardening.** Per AMO release notes: "Replaced all `innerHTML`
  assignments with safe DOM manipulation methods using `createElement()`
  and `appendChild()` to prevent XSS vulnerabilities." Verified by grep:
  shipped `content-script-firefox.js` contains only **one** `innerHTML`
  reference (a comment header reading "Clean - No innerHTML") versus
  **9** `innerHTML` writes in the Chrome 1.1 `content-script.js`.

### Store status
- **Firefox AMO** — published 2025-06-10. This version never went to
  Chrome — the Chrome Web Store was carrying v1.1.

> **Unreleased dev artifact.** A `web-design-ruler-firefox.zip` archived
> alongside this version contains a Firefox v1.1 dev build with an
> extra `sidebar/panel.html` (CSS-only sidebar stub, never wired into
> the manifest). It was cut before AMO submission. mtimes cluster at
> 2025-06-10 morning Pacific time; the final shipped zip is the
> afternoon repackage with `sidebar/` dropped. The sidebar idea is on
> the [v2.2 roadmap](./ROADMAP.md) for revival.

## [1.1] — 2025-06-10

First public release on the Chrome Web Store. Rename + UI redesign.

### Added
- **Rebrand:** "LXB Studio Design Assistant" → **"Web Design Ruler"**
  (manifest name, popup title, console-log prefix, context-menu IDs
  `lxb-*` → `wdr-*`, welcome links, footer attribution, product website
  link to `webdesignruler.com`).
- **Tabbed popup UI** — four tabs (Color, Font, Measure, Palettes), each
  with its own activation button, result panel, and (for Color) a recent
  colors grid. SVG icons on each primary button.
- **Real palette management.** v1.0 stubbed this as an
  `alert("Palette management will be implemented in the next version!")`.
  v1.1 ships create, rename, delete, import (.json file picker), and
  export.
- **Recent colors history** — last 20 unique picks, persisted to
  `chrome.storage.local`, rendered as a color grid.
- **Two more default palettes** — Material Design and Neutrals join the
  original LXB Studio palette.

### Changed
- **Popup-open shortcut:** `Ctrl+Shift+E` → `Ctrl+Shift+R` (the "Ruler"
  letter).
- **Content scripts consolidated.** v1.0 shipped four scripts
  (`content-script.js`, `eyedropper.js`, `font-detector.js`, `palette.js`).
  v1.1 collapses everything into a single ~28 KB `content-script.js`. The
  standalone `eyedropper.js` (which used an 8× magnification
  screenshot-canvas approach) is gone.
- **`popup.css`** roughly doubled (6.6 KB → 11.2 KB) to support the
  tabbed layout and result panels.

### Store status
- **Chrome Web Store** — published 2025-06-10 as `cdheenjplgjmjfabnejeimmgdkajhadi`,
  developer Lance Berkebile / LXB Studio LLC.

## [1.0] — approx. 2025-05-09 — **LXB Studio Design Assistant**, unreleased

Earliest extant build. Never submitted to any store. Pre-rebrand.

### What was there
- Three tools — color picker, font detector, measurement tool —
  accessible from a single-pane popup or from three flat right-click
  items ("Pick Color with LXB Design Assistant", etc.).
- One default palette (`LXB Studio`: `#256EFF`, `#34314C`, `#47E5BC`,
  `#F8F9FA`, `#212529`).
- Stub palette management — a button that opened an
  `alert("Palette management will be implemented in the next version!")`.
- Keyboard shortcuts: `Ctrl+Shift+E` (popup), `Ctrl+Shift+P` (color
  picker).
- Popup header read "LXB Studio Design Assistant" with a "Visit LXB
  Studio" link to `lxb-studio.com`.

### Permissions
- `activeTab`, `storage`, `contextMenus`, `scripting`. Identical set to
  what v1.1 would ship with.

### Files
- `Background.js` (capital B — fixed to lowercase by v1.1),
  `manifest.json`, `popup/{popup.html,popup.js,popup.css}`,
  `scripts/{content-script.js,eyedropper.js,font-detector.js,palette.js}`,
  ICON16/32/48/128 PNGs.

---

## Cross-version reference

### Permissions

| Permission         | 1.0 | 1.1 | 1.1.1 (FF) | 2.0.0 / 2.0.1 |
|--------------------|-----|-----|------------|---------------|
| `activeTab`        | ✓   | ✓   | ✓          | ✓             |
| `storage`          | ✓   | ✓   | ✓          | ✓             |
| `contextMenus`     | ✓   | ✓   | ✓          | ✓             |
| `scripting` (MV3)  | ✓   | ✓   | —          | ✓             |
| `clipboardWrite`   | —   | —   | ✓          | ✓             |
| `notifications`    | —   | —   | ✓          | —             |
| `<all_urls>`       | —   | —   | ✓ (MV2)    | — (replaced)  |
| `host_permissions` | —   | —   | —          | http + https  |
| `alarms`           | —   | —   | —          | Edge only     |

### Stores

| Version | Chrome Web Store | Firefox AMO | Edge Add-ons          |
|---------|------------------|-------------|-----------------------|
| 1.0     | —                | —           | —                     |
| 1.1     | 2025-06-10       | —           | —                     |
| 1.1.1   | —                | 2025-06-10  | —                     |
| 2.0.0   | 2026-01-19       | 2026-01-13  | 2026-01 (concurrent)  |
| 2.0.1   | pending          | 2026-05-23  | pending               |

### Background-script model

| Version | Chrome              | Firefox                   | Edge                  |
|---------|---------------------|---------------------------|-----------------------|
| 1.0     | MV3 SW              | —                         | —                     |
| 1.1     | MV3 SW              | —                         | —                     |
| 1.1.1   | —                   | MV2 non-persistent page   | —                     |
| 2.0.0+  | MV3 module SW       | MV3 background script     | MV3 module SW + alarms |

---

## Provenance

- Manifests cross-checked at `chrome/manifest.json`, `edge/manifest.json`,
  `firefox/manifest.json` plus the pre-v2 trees in the OneDrive workspace.
- AMO version history: <https://addons.mozilla.org/firefox/addon/web-design-ruler/versions/>
  confirms three published Firefox versions: 1.1.1 (2025-06-10), 2.0.0
  (2026-01-13), 2.0.1 (2026-05-23).
- Chrome Web Store listing `cdheenjplgjmjfabnejeimmgdkajhadi`: current
  published version `2.0.0`, last updated 2026-01-19.
- Edge Add-ons API
  (`getproductdetailsbycrxid/nfgkdmbklfallhofeblhfkibdcobocjl`): current
  published version `2.0.0`, ProductId `0RDCKDS326NT`, publisher
  `LXB Studio LLC`.
- Pre-rebrand dates inferred from `lxb-design-assistant/` file mtimes
  and `lxb-design-assistant.zip` metadata; labelled "approx." where
  there's no explicit release record.

[Unreleased]: https://github.com/LXBStudioLLC/web-design-ruler/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/LXBStudioLLC/web-design-ruler/releases/tag/v2.0.1
[2.0.0]: https://github.com/LXBStudioLLC/web-design-ruler/releases/tag/v2.0.0
[1.1.1]: https://addons.mozilla.org/firefox/addon/web-design-ruler/versions/
[1.1]: https://chromewebstore.google.com/detail/cdheenjplgjmjfabnejeimmgdkajhadi
[1.0]: #10--approx-2025-05-09--lxb-studio-design-assistant-unreleased
