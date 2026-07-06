## Overview

The canonical Web Design Ruler source is the multi-browser v2.x tree in this repo — three per-browser unpacked extensions (`chrome/`, `edge/`, `firefox/`). All three manifests are currently at `2.0.1` (Firefox popup callback fix on top of the 2.0.0 rebuild).

**Store status as of this audit:**

- **Firefox AMO** (`web-design-ruler`) — v2.0.1, published 2026-05-23.
- **Chrome Web Store** (`cdheenjplgjmjfabnejeimmgdkajhadi`) — v2.0.0, last updated 2026-01-19. Chrome upload of 2.0.1 still pending.
- **Edge Add-ons** (`nfgkdmbklfallhofeblhfkibdcobocjl`) — v2.0.0 per the Edge `getproductdetailsbycrxid` JSON API. Edge upload of 2.0.1 still pending.

v2.0.0 was a complete multi-browser rebuild — introduced Edge support, three per-browser builds, explicit `host_permissions`, a duplicate-injection guard, modern `navigator.clipboard` with `execCommand` fallback, and a Firefox build that swaps `chrome.*` callbacks for `browser.*` Promises. v2.0.0 shipped to all three stores in January 2026. v2.0.1 followed on 2026-05-23 with the Firefox popup-handler fix described under Top-3 findings below.

The legacy single-bundle source still present in the parent directory (`WebDesignRuler/` and `lxb-design-assistant/`) is pre-v2 and superseded.

## Architecture

**Chrome** (`builds/chrome`): Manifest v3 (`manifest.json:2`), background as ES module service worker (`builds/chrome/manifest.json:32-35`), content script registered for `http://*/*` and `https://*/*` (`builds/chrome/manifest.json:36-43`) with `run_at: "document_end"` and `all_frames: false`. Tool injection uses `chrome.scripting.executeScript` with explicit `world: 'ISOLATED'` (`builds/chrome/background.js:165-169`). No alarms keep-alive — Chrome's SW termination is less aggressive.

**Edge** (`builds/edge`): Same MV3 service worker shape (`builds/edge/manifest.json:33-36`), but adds `"alarms"` to permissions (`builds/edge/manifest.json:27`) and declares `"minimum_chrome_version": "102"` (`builds/edge/manifest.json:67`). The background script schedules a wake-up alarm every 0.5 minutes under the alarm name `wdr-keep-alive` (`builds/edge/background.js:20-21, 42-55`) — Chromium clamps alarm periods to ≥30 s, so the alarm cannot prevent termination; it wakes the SW so top-level init (context menus, listeners) re-registers, and real resilience comes from the ping→inject retry path. Handler acks each fire by touching `chrome.storage.local` (`builds/edge/background.js:57-65`). Ping timeout is bumped 1000→1500 ms and injection retries 3→4 (`builds/edge/background.js:17-19`). The content script is byte-identical to the Chrome build except for the comment header (verified via `diff`).

**Firefox** (`builds/firefox`): Manifest v3 with `browser_specific_settings.gecko.id = "webdesignruler@lxb-studio.com"`, `strict_min_version: "109.0"` (`builds/firefox/manifest.json:6-11`). Background is a **non-persistent background script**, not a service worker (`builds/firefox/manifest.json:38-40`), reflecting Firefox's MV3 model. The background uses a `browserAPI = (typeof browser !== 'undefined') ? browser : chrome` shim (`builds/firefox/background.js:16-25`) and uses native Promises for every `tabs`, `storage`, `scripting`, and `contextMenus` call. Content script ships its own copy of that shim (`builds/firefox/scripts/content-script.js:18-25`). The Firefox `injectContentScript` deliberately omits the `world` parameter (`builds/firefox/background.js:151-154`) — Firefox didn't accept this parameter at the time the build was made and would reject it; the omission is correct for Firefox, not a bug.

## Permissions audit

All three manifests declare `activeTab`, `storage`, `contextMenus`, `scripting`, `clipboardWrite`. Edge additionally declares `alarms`. All three declare `host_permissions: ["http://*/*", "https://*/*"]`.

| Permission | Used at | Justification |
|---|---|---|
| `activeTab` | `chrome.tabs.query({active: true, currentWindow: true})` in `activateTool` (`builds/chrome/background.js:228`, edge/firefox equivalents) | Needed to identify the user's current tab on toolbar click. |
| `storage` | 35+ calls to `chrome.storage.local.{get,set}` across background, popup, palette, content-script | Needed for palettes, recent colors, last picked color/font/measurement. Local only — no `sync`. |
| `contextMenus` | `chrome.contextMenus.create/removeAll/onClicked` (`builds/chrome/background.js:42-55, 276-282`) | Needed for the three right-click items declared in `MENU_ITEMS`. |
| `scripting` | `chrome.scripting.executeScript` (`builds/chrome/background.js:165-169`) | Needed for fallback content-script injection when the static `content_scripts` entry hasn't run (e.g., script reloaded after a SW restart in a tab opened pre-install). |
| `clipboardWrite` | `navigator.clipboard.writeText` and `document.execCommand('copy')` fallback (`builds/chrome/scripts/content-script.js:77-102`, `builds/chrome/popup/popup.js:471-495`) | Needed so that picked color / detected CSS is automatically placed on the clipboard. |
| `alarms` (Edge only) | `chrome.alarms.create/onAlarm` keep-alive (`builds/edge/background.js:49-65`) | Needed to defeat Edge's aggressive SW termination. |
| `host_permissions: <all_urls>` | Required because the static `content_scripts.matches` is `http://*/*, https://*/*` and the dynamic `scripting.executeScript` target is arbitrary tabs | Without this the static registration wouldn't run and the dynamic fallback would fail. |

**Flag — host_permissions vs marketing claim.** The store listing says "only accesses active tab when tools explicitly activated." With `activeTab` alone, that claim is accurate. With `host_permissions: ["http://*/*", "https://*/*"]` plus a `content_scripts` block that matches the same set, WDR injects its content script into **every HTTP(S) page the user visits, at `document_end`, whether or not the user has clicked the toolbar icon**. The injected script does nothing visible until activated — it only registers a message listener (`builds/chrome/scripts/content-script.js:1007-1033`) — but it *is* loaded universally. Strictly speaking the marketing copy and the manifest are inconsistent. Two options for honest alignment exist: (a) drop `host_permissions` and the static `content_scripts` entry and rely on `activeTab` + `scripting.executeScript` for one-shot injection (this is what the listing already implies), or (b) tighten the marketing copy to "content script runs on every web page but performs no work until you activate a tool." This is descriptive; the fix decision belongs in the roadmap.

## Network/privacy verification

The privacy claim "completely offline, no data collection" was verified by grep across the entire `builds/` tree:

- `fetch(` — **0 matches**
- `XMLHttpRequest` — **0 matches**
- `new Image(` — **0 matches**
- `gtag` / `google-analytics` / `mixpanel` / `plausible` / `posthog` / `sentry` / `amplitude` / `segment` — **0 matches**
- `eval(` / `new Function(` — **0 matches**
- `setTimeout('...')` string-arg form — **0 matches**

The only HTTP(S) URLs in any shipped file are three static footer anchors in `popup.html`: `https://webdesignruler.com` (line 149), `https://lxb-studio.com` (line 151), `https://lxb-studio.com/contact/` (line 153). All three have `target="_blank"` and fire only on user click — they generate no automatic network traffic. The `host_permissions` entries declare HTTP/HTTPS match scope but do not themselves issue requests. **The "completely offline, no data collection" claim is honest at the code level.**

## Polyfill-onClicked bug attribution

`browser-polyfill.js` / `webextension-polyfill` — **0 files in `builds/**`**. WDR v2.0.0 does not bundle the Mozilla webextension-polyfill. The reported `Cannot read properties of undefined (reading 'onClicked')` at `browser-polyfill.js:294:33` / `:417:3` cannot originate from WDR.

For comparison, the SHOTKO extension at `C:/Users/stunt/OneDrive/Desktop/LXBStudio/-=SHOTKO=-/shotko-extension/` does bundle `browser-polyfill.js` (confirmed via directory listing), and so does `shotko-extension-firefox/`. SHOTKO is almost certainly the source of the polyfill error observed on `webdesignruler.com`. To confirm, open DevTools on `webdesignruler.com`, expand the error stack frame, and inspect the URL prefix — Chrome formats it as `chrome-extension://<32-char-extension-id>/browser-polyfill.js`. If that ID matches the SHOTKO unpacked-extension ID (visible at `chrome://extensions/`), SHOTKO is responsible. Disable SHOTKO and reload `webdesignruler.com`; if the error disappears, attribution is confirmed. Either way, **no WDR version bump is warranted** — there is no defect in this repo.

## Performance review

Bundle sizes: `chrome/ = 125 KB`, `edge/ = 129 KB`, `firefox/ = 117 KB` uncompressed (the bulk is icons; JS+HTML+CSS is roughly 60-70 KB per build). LOC: chrome content-script 1036, firefox content-script 876, chrome background 340, edge background 436, firefox background 308, popup.css 553.

**Hot paths.** Three `mousemove` listeners exist per build, one each for the color-picker fallback, the font-detector, and the measurement-tool overlay:

| Build | Picker | Font | Measure |
|---|---|---|---|
| chrome | `content-script.js:542` | `content-script.js:791` | `content-script.js:998` |
| edge | `content-script.js:542` | `content-script.js:791` | `content-script.js:998` |
| firefox | `content-script.js:416` | `content-script.js:643` | `content-script.js:838` |

None of the three `mousemove` handlers is wrapped in `requestAnimationFrame`, throttled, or debounced — grep for `requestAnimationFrame|throttle|debounce` across `builds/` returns zero hits. The picker handler does an `elementFromPoint` lookup, a `getBoundingClientRect`, up to 20 `getComputedStyle` parent walks via `getBackgroundColor` (`builds/chrome/scripts/content-script.js:109-126`), and a `panel.innerHTML = template-string` rewrite on every mouse move (`builds/chrome/scripts/content-script.js:410-440`). On a slow page with high mouse-event rate this will burn measurable CPU and trigger style recalcs each frame. For media elements (IMG/CANVAS/VIDEO) the handler additionally allocates a fresh `<canvas>` and runs `getImageData(1,1)` per mousemove (`builds/chrome/scripts/content-script.js:153-241`) — this is the most expensive path, especially for VIDEO (creates a canvas, draws current frame, then reads).

**Storage in hot paths.** Verified `chrome.storage.local.{get,set}` is **not** called inside any `mousemove` handler. All storage writes happen in terminal handlers — `selectColor` (`builds/chrome/scripts/content-script.js:446, 449`), font click (`:751`), and measurement `onMouseUp` (`:956`). That is the correct shape.

**innerHTML reads/writes.** 50 total `innerHTML = ...` assignments across the codebase (`chrome/scripts/content-script.js:11`, similar counts elsewhere). Inside the picker `onMouseMove` (`builds/chrome/scripts/content-script.js:410-440`) and measurement `updateMeasurement` (`:911-922`), the panel is fully re-parsed on every event. Switching to direct text-node updates would let the browser skip HTML parsing entirely. Descriptive only; not proposing a fix here.

**Other.** All three tools store original `body.style.cursor` / `userSelect` and restore them in `cleanup()` — no permanent style leak. All three correctly remove event listeners with the same capture flag they were registered with (`true` in chrome/edge; mixed in firefox — see Cross-build inconsistencies).

## Code quality

- Zero TODO/FIXME/XXX/HACK/DEPRECATED comments in any build file (grep returned no hits).
- The `selectedColorType` variable at `builds/chrome/scripts/content-script.js:346` (and `builds/edge/scripts/content-script.js:346`) is declared but never read or assigned beyond its initializer — dead code. Firefox build removed it.
- `hasEyeDropperAPI` is defined at `builds/chrome/scripts/content-script.js:142-144` and `builds/edge/scripts/content-script.js:142-144` but never called. `activateColorPicker` at `:552-556` explicitly comments that the EyeDropper path is "available via `activateColorPickerEyeDropper()` if needed" — i.e. the function is reachable via name but no UI calls it. Either drop the `hasEyeDropperAPI` helper or wire it into the activation path.
- The Firefox popup `activateTool` at `builds/firefox/popup/popup.js:111` uses **callback-style** `browserAPI.runtime.sendMessage({action}, (response) => {...})`. Firefox's `browser.runtime.sendMessage` is Promise-based; passing a callback as the second argument will not work in Firefox MV3 — Firefox treats the second argument to `runtime.sendMessage` as `options`, not a callback. The response handling block below it (lines 112-127) will never run on Firefox proper, only when the `browserAPI === chrome` fallback fires (e.g. if Firefox ever ships chrome-aliased APIs). This contradicts the README's claim of "Converted to async/await pattern (Firefox)" for popups — see Verification section §1 below.
- `builds/firefox/popup/palette.js:17-21` defines a stub `browserAPI` with no-op functions if neither `browser` nor `chrome` is found. This is defensive but the calling code will then silently fail without surfacing the error to the user — `loadPalettes` resolves with `{}` and the popup just shows no palettes.
- Restricted-URL patterns in the three backgrounds are inconsistent: chrome/edge include `/^edge:\/\//` and `/^chrome-extension:\/\//`; firefox omits both (`builds/firefox/background.js:34-39`). On Firefox this means a user could theoretically activate the tool on a `chrome-extension://` URL — Firefox does not actually use that scheme, so the omission has no observable effect, but the chrome/edge sets should be unified for clarity.
- All three content-script `ping` handlers do `sendResponse({pong: true}); return true;` (`builds/chrome/scripts/content-script.js:1011-1013`). Chrome MV3 documents `return true` as the signal that `sendResponse` will fire **asynchronously**. Here it fires synchronously; returning `true` is harmless but slightly misleading. The same pattern is used for the three activation responses, which is correct.

## Cross-build inconsistencies

1. **Listener capture flag inside the measurement tool.** Chrome/Edge register the three overlay handlers without the capture flag (`builds/chrome/scripts/content-script.js:997-999`) — `overlay.addEventListener('mousedown', onMouseDown);`. Firefox is identical here (`builds/firefox/scripts/content-script.js:837-839`). Picker and font-detector listeners all three builds register with capture `true`. Consistent — flagging only because it's worth noting the asymmetry between the overlay-based measurement tool and the document-bound picker/font tools.
2. **Restricted URL list.** Chrome/Edge include `chrome-extension://` and `edge://`; Firefox lists `about:`, `moz-extension://`, `chrome://`, `file://` and omits the chrome-specific schemes. Behaviorally equivalent per-browser, but the three lists could be combined into a superset for code-share.
3. **Context-menu items.** All three builds declare the same three items (`Pick Color`, `Identify Font`, `Measure`) with identical IDs (`wdr-eyedropper`, `wdr-font-detector`, `wdr-measure-tool`) — consistent.
4. **Keyboard shortcuts.** All three manifests declare `_execute_action: Ctrl+Shift+R` and `activate_eyedropper: Ctrl+Shift+P`, identical Mac variants — consistent.
5. **Default palettes.** All three backgrounds seed identical palettes named `Web Design Ruler` (5 colors starting `#2563EB`) and `Neutrals` (5 grays) — consistent (`builds/chrome/background.js:62-72`, `builds/edge/background.js:122-130`, `builds/firefox/background.js:81-89`).
6. **Color picker entry point.** Chrome/Edge include both `activateColorPickerEyeDropper()` (uses `new EyeDropper()`) and the visual fallback panel, but the public `activateColorPicker` (`builds/chrome/scripts/content-script.js:552-556`) hardwires the fallback path. Firefox ships only the fallback (the EyeDropper code is removed from the Firefox content script). This is sensible — Firefox doesn't have `window.EyeDropper` — but it means Chrome users **never** experience the native EyeDropper API even though it's available. If that's a deliberate UX choice (the visual panel shows both bg + text + pixel previews, which the native API doesn't), it's worth documenting that decision in `builds/README.md`.
7. **Logging tag.** Chrome uses `[WDR]`, Edge uses `[WDR-Edge]`, Firefox uses `[WDR-Firefox]`. Helpful when triaging which build produced a log.
8. **Popup async pattern.** Chrome/Edge popup uses callback storage; Firefox popup uses `await` for storage but **callback** for `runtime.sendMessage` (see Code quality §4) — the conversion is half-done in Firefox.

## Top-3 findings

1. **Firefox popup tool-activation handler was broken in 2.0.0.** `firefox/popup/popup.js:111` passed a callback to `browser.runtime.sendMessage`, which Firefox's WebExtensions Promise-based API does not support. The response handler never executed on Firefox. Symptom: clicking `Activate Color Picker` (or Font / Measure) in the Firefox popup would close the popup only if the synchronous code path happened to receive `undefined` and fall through; otherwise it showed no notification and the user got no feedback. v2.0.0 shipped to AMO on 2026-01-13 with this bug intact and active in production for ~4 months. **Fixed in v2.0.1** (2026-05-23) by converting `activateTool` to `async` and awaiting the Promise with try/catch.

2. **Marketing copy contradicts host_permissions.** The store description states "only accesses active tab when tools explicitly activated", but the manifests declare `host_permissions: ["http://*/*","https://*/*"]` plus a `content_scripts` block that statically loads `content-script.js` into every HTTP(S) page at `document_end`. The script is benign (only registers a message listener until activated) but it does load universally. Either the manifest needs to be narrowed to `activeTab`-only with dynamic injection, or the marketing copy needs to be reworded.

3. **No throttling on `mousemove` paths that allocate canvases.** The fallback color picker's `onMouseMove` (`builds/chrome/scripts/content-script.js:371-440`, equivalents in edge/firefox) creates a `<canvas>`, draws the current image/canvas/video frame, and calls `getImageData(1,1)` on **every** mouse move event when the cursor is over an IMG/CANVAS/VIDEO element. On a video element this is the worst case (full-frame draw per event). Pages with high pointer event rates (≥120 Hz mice on supporting browsers) will see real CPU cost. No `requestAnimationFrame`, throttle, or debounce anywhere in `builds/`.

## Verification of v2.0.0 README claims

The `builds/README.md` lists 8 issues fixed in the v2.0.0 rebuild. Confirmed status against source:

1. **Service Worker Termination (Edge wake-up alarm)** — **Confirmed.** `chrome.alarms.create(KEEP_ALIVE_ALARM_NAME, {periodInMinutes: WAKE_UP_INTERVAL_MINUTES})` at `builds/edge/background.js:42-55`, handler at `:57-65`, `"alarms"` permission in `builds/edge/manifest.json:27`. The alarm is a wake-up (not a keep-alive) — Chromium clamps periods to ≥30 s. Chrome and Firefox manifests do not declare alarms — correct per platform.

2. **Missing `chrome.runtime.lastError` checks** — **Confirmed.** The Edge background.js checks `chrome.runtime.lastError` after every callback-style API (`builds/edge/background.js:85, 98, 134, 148, 214, 300, 329, 381, 387, 405, 416`). The Chrome background.js checks it on the critical paths (`builds/chrome/background.js:49, 142, 251`) though less exhaustively than Edge. Firefox uses Promises and try/catch, which is the equivalent pattern (`builds/firefox/background.js:67-69, 76-77, 95-97`, etc.). Claim supported.

3. **Ping/Pong Race Condition (Edge: longer timeouts, more retries)** — **Confirmed.** `PING_TIMEOUT_MS = 1000` chrome (`builds/chrome/background.js:14`), `1500` edge (`builds/edge/background.js:17`), `1000` firefox (`builds/firefox/background.js:30`); `MAX_INJECTION_RETRIES = 3` chrome (`:16`) and firefox (`:32`), `4` edge (`:19`). The README says Edge uses "exponential backoff between retries" — the actual code (`builds/edge/background.js:264-282`) uses a **constant** 200 ms delay followed by a `1.5x` post-inject wait, not true exponential backoff. The retry pattern is fixed-interval. Minor discrepancy; not a functional defect.

4. **Missing `world` parameter in executeScript** — **Confirmed for chrome/edge.** `world: 'ISOLATED'` is set explicitly at `builds/chrome/background.js:168` and `builds/edge/background.js:241`. Firefox omits it at `builds/firefox/background.js:151-154` — correct for Firefox, which did not support the `world` parameter in `scripting.executeScript` at the time the build was made. Adding it would have rejected the call.

5. **No Duplicate Injection Protection** — **Confirmed.** `window.__WDR_CONTENT_SCRIPT_LOADED__` guard wrapping the entire content-script body at `builds/chrome/scripts/content-script.js:11-14`, `builds/edge/scripts/content-script.js:11-14`, `builds/firefox/scripts/content-script.js:10-13`.

6. **Deprecated Clipboard API** — **Confirmed.** All three content scripts try `navigator.clipboard.writeText` first and fall back to `document.execCommand('copy')` only on rejection (`builds/chrome/scripts/content-script.js:77-102`, etc.). The popup.js files do the same (`builds/chrome/popup/popup.js:471-495`). `execCommand` is retained only as a fallback, which is the appropriate pattern.

7. **Context Menus Not Recreating** — **Confirmed.** All three backgrounds call `createContextMenus()` (i) in the `onInstalled` listener, (ii) in `onStartup` (chrome/edge), and (iii) **immediately at script load** so that an SW restart triggers recreation (`builds/chrome/background.js:91-106`, `builds/edge/background.js:163-183`, `builds/firefox/background.js:101-110`). Edge additionally tracks a `menusCreated` flag to suppress duplicate-ID warnings on rapid restart (`builds/edge/background.js:39, 76-78, 104-105`).

8. **Firefox Namespace Incompatibility** — **Partially confirmed.** Firefox background.js uses the `browserAPI = browser ?? chrome` shim with Promise-based calls throughout (`builds/firefox/background.js:16-25`). Firefox content-script.js does the same (`builds/firefox/scripts/content-script.js:18-25`). Firefox palette.js does the same (`builds/firefox/popup/palette.js:11-21`). **However**, Firefox popup.js's `activateTool` at line 111 still uses the chrome callback pattern, so the "Converted to async/await pattern (Firefox)" claim under "Popup Changes" in the README is inaccurate for this one critical path. The data-loading path (`loadStoredData` at `:134-155`) and message listener (`:488-505`) are correctly Promise-based; only the tool-activation send is not. This is finding §1 in the Top-3 list above.

**Summary of README accuracy:** 7 of 8 fixes are fully implemented as documented; one (exponential backoff in retries) is implemented as fixed-interval, not exponential; one (Firefox async/await popup conversion) is incomplete in the tool-activation path.
