# Roadmap

This roadmap reflects the state of the codebase after the v2.0.0 audit. See
[AUDIT.md](./AUDIT.md) for the full findings.

The ordering reflects intent, not strict commitment. Anything in **Next** is
expected to land before any **Later** item, but the **Later** items are not
ranked against each other.

---

## Shipped — v2.0.0 (this repo)

A multi-browser rebuild: three purpose-built manifests + background scripts
(chrome / edge / firefox). See [CHANGELOG](./CHANGELOG.md) for the full list.
Headline fixes vs the previously published v1.1 / v1.1.1:

- Edge service-worker no longer dies after ~30 s of inactivity.
- Every async API call now checks `chrome.runtime.lastError` instead of
  silently swallowing failures.
- Content-script ping/pong race condition resolved (longer timeouts + retries
  on Edge specifically).
- Modern `navigator.clipboard.writeText` replaces deprecated
  `document.execCommand('copy')` with a graceful fallback.
- Duplicate-injection guard prevents stacked event listeners.
- Firefox uses native `browser.*` Promises throughout the background and
  content script.

v2.0.0 has **not yet been uploaded** to the Chrome Web Store / Firefox
Add-ons stores. Users with the extension installed still have v1.1 / v1.1.1.
The first store upload will likely be v2.0.1 (see Next).

---

## Next — v2.0.1 (audit cleanup, before next store upload)

Pre-release polish based on the v2.0.0 audit. None of these are user-facing
new features — they're correctness and honesty fixes that should land before
v2.0.0 actually ships to users.

| Item | Why it ships in 2.0.1 | Complexity | New permissions | Privacy impact |
|---|---|---|---|---|
| **Fix Firefox popup tool-activation handler** | `firefox/popup/popup.js:111` passes a callback to a Promise-based `browser.runtime.sendMessage`. Response handler never fires on Firefox. Highest-impact audit finding. | S | None | None |
| **Reconcile permissions with marketing copy** | Store listing says "only accesses active tab when tools explicitly activated", but `host_permissions: ["http://*/*","https://*/*"]` + static `content_scripts` means the script loads on every page. Two paths: (a) drop `host_permissions` + static `content_scripts`, rely on dynamic `scripting.executeScript`; (b) reword the marketing copy. Decision pending. | S (rewording) or M (manifest tightening + re-test) | Removes a permission if path (a) | Positive either way |
| **Replace fixed-interval Edge retries with real exponential backoff** | README claims exponential backoff; `edge/background.js:264-282` uses fixed 200 ms. Either rename to "fixed interval" or actually backoff (200, 400, 800 ms). | XS | None | None |
| **Remove dead code: `selectedColorType`, `hasEyeDropperAPI`** | `chrome/scripts/content-script.js:346` and `:142-144` are unreachable in shipped code. Already removed from Firefox build. | XS | None | None |
| **Unify restricted-URL pattern list across builds** | Chrome/Edge list includes `chrome-extension://` and `edge://`; Firefox omits them. Behaviorally equivalent but a source of confusion when triaging. | XS | None | None |

---

## Soon — v2.1 (next minor)

Performance and small polish items where the user-visible payoff is clear and
the implementation cost is bounded.

| Item | User pain it solves | Complexity | New permissions | Privacy impact |
|---|---|---|---|---|
| **Throttle `mousemove` paths through `requestAnimationFrame`** | Picker, font, and measurement handlers all run on raw `mousemove`. The picker even allocates a fresh `<canvas>` and runs `getImageData(1,1)` per event when hovering an `<img>`/`<video>` — visible CPU cost on pages with ≥120 Hz pointer events. | S | None | None |
| **Switch `panel.innerHTML = template` to direct text-node updates** | Eliminates HTML re-parse per mouse event. Cleaner perf trace; smaller jank when WDR is active. | M | None | None |
| **Native EyeDropper opt-in on Chrome/Edge** | `window.EyeDropper` is available on Chromium; the visual fallback panel currently runs even when the native API would be faster and more accurate. Add a popup toggle to choose. | S | None | None |
| **Logging tag unification + verbosity toggle** | Each build uses a different `[WDR-*]` prefix; useful, but no way for users to silence verbose logs in production. A simple `chrome.storage.local`-backed `wdrDebug` flag would handle it. | S | None | None |

---

## Later — v2.2+ candidate features

These are user-requested or designer-workflow features. Each one would land in
its own release. Listed without strict priority — pick whichever solves your
most active workflow pain first.

### CSS export

- **Pain it solves:** After picking a color, identifying a font, and measuring
  an element, you currently still need to hand-type a CSS rule in your editor.
  The user guide already says CSS export is "in development".
- **What it does:** A "Copy as CSS" button in the popup that emits a snippet
  using the last picked color, last detected font, and last measurement
  (e.g., `color: #2563eb; font: 16px/24px "Inter"; width: 240px;`).
- **Complexity:** S
- **Permissions:** None
- **Privacy:** None

### Spacing inspector

- **Pain it solves:** Designers constantly need the gap, padding, or margin
  between two specific elements. DevTools surfaces this only when you
  hand-click into the Computed panel.
- **What it does:** Activate "Spacing" tool, click element A, click element B
  — overlay shows horizontal + vertical gap, plus a breakdown of margin /
  border / padding contributions from each side.
- **Complexity:** M
- **Permissions:** None (already injects into the page)
- **Privacy:** None

### WCAG color contrast checker

- **Pain it solves:** Picking a color is half the job; verifying it meets
  WCAG AA / AAA against the intended background is the other half. Currently
  requires a separate tool.
- **What it does:** Pick two colors (foreground + background) and see the
  contrast ratio + AA / AAA pass/fail for both normal and large text.
- **Complexity:** S
- **Permissions:** None
- **Privacy:** None

### Box-shadow extractor

- **Pain it solves:** `getComputedStyle(el).boxShadow` returns the raw value,
  but designers need it broken into its `x y blur spread color` components,
  ideally with the original values not the normalized form.
- **What it does:** Right-click → "Inspect box-shadow" → popup shows the
  parsed components and a one-click copy.
- **Complexity:** S
- **Permissions:** None
- **Privacy:** None

### Gradient extractor

- **Pain it solves:** Same as box-shadow but for `background-image:
  linear-gradient(...)` / `radial-gradient(...)`. The computed-style form is
  hard to read.
- **What it does:** Hover an element with a gradient background → popup shows
  the gradient definition with one-click copy.
- **Complexity:** S
- **Permissions:** None
- **Privacy:** None

### Annotated screenshot export

- **Pain it solves:** Once you've measured several elements, sharing those
  measurements requires manually annotating a screenshot.
- **What it does:** "Export screenshot" button bakes the current measurement
  overlay into a PNG.
- **Complexity:** M (requires `chrome.tabs.captureVisibleTab` + canvas
  compositing).
- **Permissions:** **Adds `tabs` permission for `captureVisibleTab`.** This
  is a real expansion of the permission set and worth scrutinizing
  separately.
- **Privacy:** Captured PNG is generated locally; never uploaded. But the
  new permission widens the surface area.

### Per-site palettes

- **Pain it solves:** Designers who work on the same client site every day
  rebuild their working palette each session.
- **What it does:** When you save a palette while on `example.com`, tag it
  to that origin. Next visit, the popup auto-selects that palette.
- **Complexity:** S (extends existing `chrome.storage.local` palette
  storage, no new permissions)
- **Permissions:** None new
- **Privacy:** None — origin is already accessible via `tabs.query`.

### Keyboard-only operation mode

- **Pain it solves:** Power users and accessibility-conscious users want the
  whole flow without touching the mouse.
- **What it does:** Document an existing + new set of keyboard shortcuts
  that drive the picker arrow-key crosshair, font hover lock, and
  measurement.
- **Complexity:** M
- **Permissions:** None new (existing `commands`)
- **Privacy:** None

### "Inspect at breakpoints"

- **Pain it solves:** Quickly previewing a site at mobile / tablet / desktop
  widths without opening DevTools.
- **What it does:** Popup buttons for 375 / 768 / 1280 viewport widths;
  resizes the current tab's content area accordingly.
- **Complexity:** M (uses `chrome.windows.update` + custom CSS overlay; some
  layout breakage risk on sites that lock viewport via meta)
- **Permissions:** **Adds `windows` permission.** Same scrutiny as the
  screenshot capture above.
- **Privacy:** None

---

## Out-of-scope (not planned)

- **Cloud-sync palettes** — would require a server, account creation, and
  network calls. Breaks the offline / no-data positioning that is the
  product's main differentiator.
- **AI font suggestions** — same reason. Local-only ML would be too large
  for the bundle.
- **Browser-wide overlays not tied to a specific tab** — would require
  `tabs` + `host_permissions` expansion without enough payoff to justify the
  store-review risk.

---

## How to influence this roadmap

Open a [feature request issue](https://github.com/LXBStudioLLC/web-design-ruler/issues/new?template=feature_request.md)
with a concrete workflow pain. The "Soon" and "Later" sections move based on
what users actually ask for in issues, not on what we imagine they want.
