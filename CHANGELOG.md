# Changelog

All notable changes to **Web Design Ruler** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions adhere to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.0.1] — 2026-05-23

### Fixed
- **Firefox popup tool buttons.** `firefox/popup/popup.js` was passing a
  callback to `browser.runtime.sendMessage`, which Firefox's WebExtensions
  API treats as `options`, not a callback. The response handler never ran on
  Firefox — clicking *Activate Color Picker* / *Font* / *Measure* in the
  popup either silently closed or did nothing depending on the run. The
  handler is now `async` and awaits the Promise with try/catch error
  surfacing.

## [2.0.0] — 2026-01-13

A complete multi-browser rebuild. Previous releases were Chrome-only, with
known instability on Edge and rough Firefox parity. v2.0.0 ships purpose-built
manifests and background scripts for each browser.

### Added
- Native Microsoft Edge build with service-worker keep-alive (`chrome.alarms`,
  ~24-second interval) to survive Edge's aggressive ~30-second SW termination.
- Native Firefox build that uses the `browser.*` namespace + Promise APIs
  directly, instead of the previous shim approach.
- Explicit `world: "ISOLATED"` on every `chrome.scripting.executeScript` call
  for deterministic cross-browser behavior.
- Modern `navigator.clipboard.writeText` with a graceful `document.execCommand`
  fallback for older Firefox contexts.
- Context-menu recreation on `chrome.runtime.onStartup` so menus survive
  service-worker restarts mid-session.
- Duplicate-injection guard (`window.__WDR_CONTENT_SCRIPT_LOADED__`) so
  repeated tool activations don't pile up event listeners.

### Changed
- All Chrome extension API callbacks now check `chrome.runtime.lastError`
  before resolving, instead of silently swallowing failures.
- Ping/pong content-script-detection timeout raised on Edge (1500 ms + 4
  retries) to accommodate slower message routing after SW wake-up.
- Manifest version pinned to 3 for Chrome and Edge; Firefox uses MV3 with
  `background.scripts` rather than a service worker.

### Fixed
- Edge: tool activation silently failing after ~30 seconds of inactivity.
- Edge: context menus disappearing after the service worker restarted.
- All browsers: race condition where a slow first ping incorrectly concluded
  the content script wasn't loaded.

## [1.1.1] — 2025-06-10 — Firefox only

### Added
- Firefox MV2 build (`browser_action`, Promise-based APIs) for the Firefox
  Add-ons store listing.
- Optional `notifications` permission for error surfacing on restricted pages.

## [1.1] — 2025-06-10 — Chrome only

Initial public release on the Chrome Web Store
(`cdheenjplgjmjfabnejeimmgdkajhadi`).

### Added
- Color picker, font detector, and measurement tool.
- Five default palettes including the LXB Studio brand palette.
- `Ctrl+Shift+R` to open the popup and `Ctrl+Shift+P` to activate the color
  picker.
- Context-menu integration on pages, selections, and images.

[Unreleased]: https://github.com/LXBStudioLLC/web-design-ruler/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/LXBStudioLLC/web-design-ruler/releases/tag/v2.0.0
[1.1.1]: https://github.com/LXBStudioLLC/web-design-ruler/releases/tag/v1.1.1
[1.1]: https://github.com/LXBStudioLLC/web-design-ruler/releases/tag/v1.1
