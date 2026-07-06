# Roadmap

This roadmap reflects the state of the codebase after the v2.0.0 audit. See
[AUDIT.md](./AUDIT.md) for the full findings.

The ordering reflects intent, not strict commitment. Anything in **Next** is
expected to land before any **Later** item, but the **Later** items are not
ranked against each other.

---

## Shipped — v2.0.0 (2026-01)

A multi-browser rebuild: three purpose-built manifests + background scripts
(chrome / edge / firefox). See [CHANGELOG](./CHANGELOG.md) for the full list.
Headline fixes vs v1.1 / v1.1.1:

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

**Store dates:** Firefox AMO 2026-01-13, Chrome Web Store 2026-01-19, Edge
Add-ons concurrent. v2.0.0 was the first appearance of WDR on Edge.

---

## Shipped — v2.0.1 (2026-05-23)

The highest-impact audit finding shipped as a point release:

- **Firefox popup tool-activation handler** — converted to async/await on
  `browser.runtime.sendMessage`. Tool buttons in the Firefox popup actually
  do something now. See [CHANGELOG](./CHANGELOG.md#201--2026-05-23).

## Shipped — v2.0.2 (2026-07-06)

Phase 1 audit cleanup: 11 bug fixes across all three builds. See
[CHANGELOG](./CHANGELOG.md#202--2026-07-06) for the full list. Headline:

- Tool stacking no longer corrupts page cursor/text-selection (mutual
  exclusion via `activeToolCleanup`).
- Palette create/import no longer overwrites existing palettes; import
  validates and auto-renames.
- Keyboard shortcuts changed to `Alt+Shift+R/P/F/M` (were `Ctrl+Shift+R/P`,
  which collided with browser built-ins). Two new commands added.
- All `prompt()`/`confirm()` replaced with inline UI (create, rename,
  delete, remove-color).
- Background is the single storage writer; content scripts only `sendMessage`.
- `safeSend()` guards against invalidated extension context.
- Font detector no longer inspects its own panel.
- Saved Fonts list added to Font tab.
- Edge alarm corrected (wake-up, not keep-alive).
- All `innerHTML` with page-controlled strings rebuilt with
  `createElement`/`textContent`.
- 10-item correctness batch (pixel coords, modern colors, tab passthrough,
  version badge, label clamping, drag-outside-window, notification CSS,
  font preview family, return-true sync, dead code removal).

**`hasEyeDropperAPI`/`activateColorPickerEyeDropper`/`showColorPickedToast`
intentionally retained** — Phase 2 (Feature 2.3) wires them up via an
options-page toggle.

## Next — pre-v2.1 (remaining audit cleanup)

| Item | Why it's deferred | Complexity |
|---|---|---|
| **Reconcile permissions with marketing copy** | Reserved owner decision (Section 13 of the implementation brief). Two paths: drop `host_permissions` + static `content_scripts`, or reword the store listing. | S or M |
| **Replace fixed-interval Edge retries with real exponential backoff** | README claims exponential backoff; code uses fixed 200 ms. Not in Phase 1 scope. | XS |
| **Unify restricted-URL pattern list across builds** | Chrome/Edge list includes `chrome-extension://` and `edge://`; Firefox omits them. Behaviorally equivalent. | XS |

---

## Shipped — v2.1.0 (2026-07-06)

Performance, accessibility, and new tools. See
[CHANGELOG](./CHANGELOG.md#210--2026-07-06). Headline:

- rAF-throttled mousemove + per-element canvas cache (Feature 2.1).
- Panel updates via cached text nodes — zero DOM allocation per move (2.2).
- Options page with native EyeDropper opt-in + debug logging toggle (2.3).
- WCAG contrast checker in Color tab (2.4).
- Copy as CSS export from stored picks/detections/measurements (2.5).
- Copy buttons for W/H/D measurements (2.6).
- Popup dark mode + a11y pass: focus-visible, roving tabindex, aria (2.7).
- Recent colors management: clear button + right-click copy (2.8).

## Next — pre-v2.2 (Firefox feature parity restoration)

Firefox v1.1.1 shipped with several Firefox-exclusive features that were
removed in the v2.0.0 cross-browser rebuild to achieve parity. Restore the
ones that don't compromise privacy or cost new permissions. The deep
[CHANGELOG](./CHANGELOG.md) documents what existed; this is the plan to
bring it back.

| Item | What it was in 1.1.1 | Complexity | New permissions | Privacy impact |
|---|---|---|---|---|
| **First-run welcome page** | `welcome/welcome.html` opened on `runtime.onInstalled` with hero badge, feature grid, shortcut cheat-sheet. A real onboarding moment that the current install flow lacks. | S | None | None |
| **Toolbar badge state animation** | Green `●` while a tool is active, `✓` after a successful pick/detect/measure, cleared after 2 s. Visual confirmation without opening the popup. | S | None | None |
| **Nested "Web Design Ruler" right-click submenu** | Parent menu with emoji-prefixed children (`🎨 Pick Color`, `🔤 Identify Font`, `📐 Measure Element`) and a separator. v2.0.0 flattened these into three siblings. | XS | None | None |
| **"Copy All Colors on Page" context-menu action** | Walks the DOM, dedupes computed colors, builds an auto-named palette, copies as CSS custom properties to the clipboard. A workflow win that designers reach for often. | M | None | None |
| **Theme awareness** | `browser.theme.onUpdated` listener + `getThemeColors` message handler — designed to drive theme-aware palette suggestions on Firefox. Currently registered nowhere in 2.0.x. | S | None (Firefox only API) | None |
| **Firefox-themed default palette** | v1.1.1 seeded a "Firefox Theme" palette (`#FF9500`, `#002147`, `#00FEFF`, `#B1B1B3`, `#FFFFFF`) alongside LXB Studio / Material Design / Neutrals. v2.0.0 reduced defaults to two generic palettes. Worth restoring as a per-build seed. | XS | None | None |
| **Resurrect the sidebar UI** | An unreleased `sidebar/panel.html` exists in the pre-1.1.1 Firefox dev build (cut before AMO submission). Firefox supports `sidebar_action` natively; could be a docked panel for picked colors + recent measurements. | L | `sidebar_action` (Firefox-only manifest key) | None |

---

## Later — v2.3+ candidate features

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
