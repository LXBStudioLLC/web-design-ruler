# Handoff for Deep Check

**Branch:** `feat/v2.2-parity` (final phase)
**Date:** 2026-07-06
**Baseline:** v2.0.1 @ `4fe5983` on `main`
**Final version:** v2.2.0 across all three builds

---

## 1. Status Table

### Phase 1 — v2.0.2 Bug Fixes (branch `fix/v2.0.2`)

| Item | Status | Commit | Note |
|---|---|---|---|
| Fix 1.1 — Tool stacking | DONE | `5fbaef3` | `activeToolCleanup` slot; all 3 builds |
| Fix 1.2 — Palette overwrite | DONE | `95284b5` | `{ overwrite }` option; import auto-rename; validation |
| Fix 1.3 — Shortcut collision | DONE | `5900fd2` | `Alt+Shift+R/P/F/M`; 4 commands; handlers in all 3 backgrounds |
| Fix 1.4 — prompt/confirm | DONE | `70d8815` | Inline UI: create/rename input, delete two-step, remove-color chip |
| Fix 1.5 — Double-writer race | DONE | `267730d` | Content scripts only `safeSend`; background is single writer |
| Fix 1.6 — Context invalidated | DONE | `0c03991` | `extAlive()`/`safeSend()` helpers; all 3 builds |
| Fix 1.7 — Font panel self-inspect | DONE | `eaf852d` | `panel.contains(element)` + `highlightBox.contains(element)` |
| Fix 1.8 — Saved Fonts UI | DONE | `ed85ba5` | Collapsible list, up to 10, clickable + remove |
| Fix 1.9 — Edge alarm | DONE | `82efd2a` | `WAKE_UP_INTERVAL_MINUTES = 0.5`; AUDIT.md corrected |
| Fix 1.10 — innerHTML security | DONE | `66d1267` | All panel updates rebuilt with createElement/textContent |
| Fix 1.11 — Edge-case batch | DONE | `dc3dcf9` | All 10 items: coords, colors, tab, version, labels, drag, CSS, font, return, dead code |
| Phase 1 packaging | DONE | `6f4473d` | Version 2.0.2; CHANGELOG; ROADMAP |

### Phase 2 — v2.1.0 Features (branch `feat/v2.1`)

| Item | Status | Commit | Note |
|---|---|---|---|
| Feature 2.1 — rAF throttle | DONE | `81f6b59` | All 3 tools; canvas cache per media element |
| Feature 2.2 — Cached text nodes | DONE | `81f6b59` | Panel skeletons once; update textContent/style on move |
| Feature 2.3 — Options page | DONE | `5126b5c` | `options/` in all builds; EyeDropper opt-in (Chrome/Edge); `log()` helper |
| Feature 2.4 — Contrast checker | DONE | `81f6b59` | WCAG math; FG/BG slots; pass/fail badges; `#767676`→4.5, `#000`→21.0 |
| Feature 2.5 — Copy as CSS | DONE | `02a21f3` | Assembles snippet from stored data; disabled when empty |
| Feature 2.6 — Measurement copy | DONE | `02a21f3` | Copy buttons for W/H/D (`240px`) |
| Feature 2.7 — Dark mode + a11y | DONE | `48899ae` | `prefers-color-scheme`; focus-visible; roving tabindex; aria |
| Feature 2.8 — Recent colors mgmt | DONE | `02a21f3` | Clear (two-step); right-click swatch copies hex |
| Phase 2 packaging | DONE | `4ef358f` | Version 2.1.0; CHANGELOG; ROADMAP |

### Phase 3 — v2.2.0 Feature Parity (branch `feat/v2.2-parity`)

| Item | Status | Commit | Note |
|---|---|---|---|
| Feature 3.1 — Copy All Colors | DONE | `938973d` | Context menu; walks DOM; dedupes; CSS custom props; auto-palette |
| Feature 3.2 — Measure area + Shift | DONE | `938973d` | 10px snap; area readout; popup display; stored |
| Feature 3.3 — Font history (full) | DONE | `938973d` | Live preview; Web Font badge; copy-CSS; show-all |
| Feature 3.4 — Right-click text color | DONE | `938973d` | `contextmenu` in picker selects text color |
| Feature 3.5 — Welcome + badge | DONE | `938973d` | `welcome/` page on install; badge `●`/`✓` lifecycle |
| Feature 3.6 — Firefox palette seed | DONE | `938973d` | `"Firefox"` palette in firefox/background.js |
| Phase 3 packaging | DONE | `55bd8f1` | Version 2.2.0; CHANGELOG |

### Phase 4 — Build Unification (optional)

| Item | Status | Reason |
|---|---|---|
| Phase 4 — Single-source build | SKIPPED | Optional; not attempted. Byte-parity gate not reachable without significant additional work. |

### Promo Video (OneDrive `promo/source/`)

| Item | Status | Note |
|---|---|---|
| P1 — S5 CountUp delays | DONE | Aligned each CountUp delay with its row's reveal |
| P2 — S4 toast fade-out | DONE | Rescaled tail timeline (toast f110-118, fade f130-140) |
| P3 — Typewriter caret | DONE | Caret rendered inside last emitted line |
| P4 — S1 kicker cut | DONE | Reduced delay 54→48; last wipe ≤f70 |
| P5 — FlySwatch hang | DONE | Flight+fade finish by local f138 |
| Shortcut text | DONE | S4: `Alt+Shift+P`; S8/S9: `Alt+Shift+R` |
| minHeight pops | DONE | S5: 130px; S7: 170px |
| S7 export reorder | DONE | Raised JSON cpf 2.4→4.5 (completes before export press) |
| Pin versions | DONE | Removed `^` from remotion/@remotion/cli/@remotion/google-fonts |
| SVG id dedup | DONE | `useId()` suffix in Logo.tsx |
| BrandBadge frames | DONE | Derived from SCENES table |
| Inter 400 | DONE | Added to fonts.ts |
| Full render | DONE | 900 frames, no errors, ~11.8 MB MP4 |

### Packaging (Section 10)

| Step | Status | Note |
|---|---|---|
| Version bump (all 3 manifests) | DONE | 2.0.2 → 2.1.0 → 2.2.0 |
| Build zips | DONE | `dist/web-design-ruler-2.2.0-{chrome,edge,firefox}.zip` |
| Zip parity proof | DONE | All 3: IDENTICAL (zero diff) |
| web-ext lint | DONE | 0 errors, 1 warning (data_collection_permissions) |
| Sanity greps | DONE | All clean (see Evidence below) |
| Branch push | DONE | All 3 branches pushed to origin; hashes match |
| Manual smoke matrix | NOT TESTED | Requires manual browser testing (see Known Risks) |

---

## 2. Deviation Log

1. **S7 export reorder (promo)**: Instead of moving the export press later (no room in the 108-frame scene), sped up JSON typing (cpf 2.4→4.5) so it completes before the export press at f88. Ordering goal met.

2. **Badge timeout (Feature 3.5)**: Used `setTimeout` for the 2s clear (per the brief's acceptable option). A single shared `badgeClearTimer` is cancelled-and-reset on each new completion event, preventing flicker on rapid successive picks.

3. **web-ext lint warning**: `MISSING_DATA_COLLECTION_PERMISSIONS` — Firefox requires a `data_collection_permissions` field in `browser_specific_settings.gecko`. This is a listing policy notice, not a code defect. The owner should add `"data_collection": { "techdata": false, "interactiondata": false }` to the Firefox manifest before AMO upload.

4. **Phase 4 skipped**: The optional build-unification phase was not attempted. The byte-parity gate (script output must match committed trees) requires significant additional work and was deemed lower priority than completing all features.

5. **Manual smoke matrix**: No browser was available in this environment for manual testing. All verification was done via syntax checks (`node --check`), grep assertions, zip parity diffs, and `web-ext lint`. The owner should perform the manual smoke matrix (Section 10.7) before publishing.

---

## 3. Evidence

### 3.1 Sanity Greps (Section 10.5)

```
--- prompt/confirm/alert in extension JS ---
ZERO HITS (clean)

--- fetch/XMLHttpRequest/http:// in extension JS ---
ZERO HITS (clean)

--- Ctrl+Shift+R / Ctrl+Shift+P ---
ZERO HITS (clean)
```

### 3.2 innerHTML in Content Scripts

```
chrome/scripts/content-script.js: 0 hits
edge/scripts/content-script.js: 0 hits
firefox/scripts/content-script.js: 0 hits
```

Remaining `innerHTML` in popup.js (all safe — clearing with `''` or static `<option>` template):
```
grid.innerHTML = '';
fontProperties.innerHTML = '';
list.innerHTML = '';
visual.innerHTML = '';
selector.innerHTML = '<option value="">Select a palette...</option>';
colorsEl.innerHTML = '';
```

### 3.3 Zip Parity

```
chrome: IDENTICAL
edge: IDENTICAL
firefox: IDENTICAL
```

### 3.4 web-ext Lint

```
errors: 0
notices: 0
warnings: 1 (MISSING_DATA_COLLECTION_PERMISSIONS)
```

### 3.5 Syntax Checks

All JS files across all three builds pass `node --check` (exit 0).

### 3.6 rAF / cancelAnimationFrame

```
chrome: rAF=3, cancel=3
edge: rAF=3, cancel=3
firefox: rAF=3, cancel=3
```

### 3.7 Build Parity (chrome ↔ edge)

- Content script: header comment only (1 line)
- popup.html: byte-identical
- popup.css: byte-identical
- popup.js: byte-identical

### 3.8 Manual Smoke Matrix

Not performed — requires manual browser testing. The owner should test:
- [ ] Chrome: pick element color / pick image pixel / Esc cancel
- [ ] Chrome: detect + save font
- [ ] Chrome: measure + shift-snap
- [ ] Chrome: create/rename/delete/import/export palette
- [ ] Chrome: all four shortcuts (Alt+Shift+R/P/F/M)
- [ ] Chrome: context menu items (Pick Color, Identify Font, Measure, Copy All Colors)
- [ ] Chrome: popup shows data after each action
- [ ] Chrome: options page (EyeDropper toggle, debug logging)
- [ ] Chrome: dark mode
- [ ] Edge: same matrix as Chrome
- [ ] Firefox: same matrix (no EyeDropper toggle)
- [ ] Firefox: "Firefox" palette appears on fresh install

---

## 4. Store-Listing Drafts (Shortcut Wording)

### Chrome Web Store / Edge Add-ons

Replace any mention of keyboard shortcuts with:

> **Keyboard shortcuts:** Open the popup with `Alt+Shift+R`, pick colors
> with `Alt+Shift+P`, identify fonts with `Alt+Shift+F`, and measure
> elements with `Alt+Shift+M`. (On Mac, use `Option+Shift+R/P/F/M`.)
> Customize or reassign any shortcut in your browser's extension
> shortcuts settings.

### Firefox AMO

> **Keyboard shortcuts:** Open the popup with `Alt+Shift+R`, pick colors
> with `Alt+Shift+P`, identify fonts with `Alt+Shift+F`, and measure
> elements with `Alt+Shift+M`. Manage or reassign shortcuts in Firefox's
> "Manage Extension Shortcuts" page.

---

## 5. Known Risks / Follow-ups

1. **`host_permissions` reconciliation** (reserved owner decision, Section 13): The store listing says "only accesses active tab" but the manifest has `host_permissions: ["http://*/*","https://*/*"]` + static `content_scripts`. The owner must decide: tighten the manifest or reword the listing.

2. **Fixed-interval Edge retries**: README claims exponential backoff; code uses fixed 200 ms. Not in scope for this brief.

3. **Restricted-URL pattern unification**: Chrome/Edge list includes `chrome-extension://` and `edge://`; Firefox omits them. Behaviorally equivalent.

4. **`data_collection_permissions`**: Firefox manifest needs `"data_collection": { "techdata": false, "interactiondata": false }` in `browser_specific_settings.gecko` before AMO upload (web-ext lint warning).

5. **Manual testing**: All verification was automated (syntax, grep, zip parity, lint). The owner must perform the manual smoke matrix before publishing.

6. **Phase 4 (build unification)**: Not attempted. The three builds remain hand-maintained near-copies. A future build script could generate them from shared sources.

7. **Badge `setTimeout` reliability**: The 2s badge clear uses `setTimeout` in the background script. On Chrome/Edge (service worker), this may be unreliable if the SW terminates within 2s. The brief accepted this as best-effort. An `alarms.create` alternative was considered but not implemented to avoid adding complexity.

8. **Promo video stills**: Located at `promo\source\out\f{70,71,380,400,407,466,470,520,730,745}.png` and `promo\source\out\WDRPromo.mp4` in the OneDrive folder.

---

## 6. Branch Summary

| Branch | Base | Tip | Version |
|---|---|---|---|
| `fix/v2.0.2` | `main` (4fe5983) | `6f4473d` | 2.0.2 |
| `feat/v2.1` | `fix/v2.0.2` (6f4473d) | `4ef358f` | 2.1.0 |
| `feat/v2.2-parity` | `feat/v2.1` (4ef358f) | `0f2b3a3` (final-pass code tip; docs commits follow — origin HEAD is authoritative) | 2.2.0 |

All branches pushed to `origin`. No tags created. No merges to `main`.

---

# Deep-Check Addendum (2026-07-06)

Independent adversarial verification of everything above: line-by-line
review of the chrome build, byte-level parity diffs, re-run sanity greps,
zip↔tree re-proof, plus three parallel verification passes (Firefox
parity, Edge + docs + packaging, promo source).

## Verdict summary

- **Confirmed working as claimed:** branch/commit structure, all Phase 1
  fixes 1.1–1.11 (except regressions below), Phase 2 features 2.1–2.8,
  Phase 3 features 3.1–3.6 (except regressions below), promo fixes 12/12
  (fresh stills + MP4 re-rendered), manifests (4 Alt+Shift commands,
  permissions unchanged), popup.html/css byte-identical across builds,
  no dialogs / no network / no old shortcuts anywhere.

## Regressions found and fixed (commits `8d0cec0`, `457a482`)

1. **CRITICAL — Edge tool activation completely broken.**
   `edge/background.js` `activateTool` was missing the `tab` parameter its
   body dereferenced (`tab is not defined` on every popup button, keyboard
   shortcut, and context-menu item). Introduced in Phase 1; survived all
   three phases. Fixed in `8d0cec0`.
2. Picker media canvas cache keyed by tag+size, not element identity —
   two same-size images shared one cached bitmap (wrong colors in any
   thumbnail grid); animated canvases sampled stale frames. Fixed.
3. "Web Font" badge computed in the popup's FontFaceSet (meaningless);
   detection moved into the content script's page context. Fixed.
4. Toolbar `●` badge never cleared on Esc-cancel; added `toolCancelled`
   message + badge-timer hygiene. Fixed.
5. Copy All Colors scanned only the first 500 DOM nodes in document
   order (head/script junk burned the budget). Now body-only, skips
   non-rendered nodes, budget 5000. Fixed.
6. Result broadcast → popup raced the storage write (popup re-read could
   show stale recents); broadcast now follows the write and the popup
   dedupes direct content-script copies. Fixed.
7. Palette import couldn't re-import the same file (input never reset).
   Fixed.
8. Dead `getColorFromImage/Canvas/Video` helpers removed (×3 builds).
9. Docs: ROADMAP was never updated for v2.2.0 (now marked Shipped); PR
   template still suggested Ctrl+Shift+P (now Alt+Shift+P); CHANGELOG
   2.2.0 gained a Fixed section covering this addendum.

## Still open (owner action)

- **Manual smoke matrix** (Section 3.8 above) — still not run in a real
  browser; required before store upload.
- **AMO `data_collection_permissions`** — add
  `"data_collection": { "techdata": false, "interactiondata": false }`
  under `browser_specific_settings.gecko` before AMO upload.
- **`host_permissions` vs store copy** — reserved owner decision.
- dist zips are rebuilt post-fix with forward-slash entries (AMO is
  picky about backslash paths in Windows-built zips).

---

# Deep-Check Addendum v2 (2026-07-07)

Second adversarial pass over the staged v2.2.0: a 12-territory exhaustive
audit (20 confirmed / 65 advisory findings; full JSON archived outside the
repo as `FINAL-PASS-FINDINGS.json`), followed by a fix pass of 25 commits
(`744b517`..`0f2b3a3`) on `feat/v2.2-parity`. The v1 addendum's tip
references are historical.

## Fixed in this pass (by area)

- **Picker media sampling** rewritten: object-fit/object-position mapping,
  padding-aware content box, out-of-bounds/letterbox → null instead of a
  false `#000000`, IMG/VIDEO readiness guards (no clientWidth fallback),
  clearRect before CANVAS/VIDEO redraws, cross-origin taint memo (`744b517`).
- **Native EyeDropper** runs tool cleanup on entry, reports cancel so the
  ● badge clears, and falls back to the in-page picker on failure
  (`2a02a44`).
- **Measure tool** is left-button-only and suppresses the context menu
  while active (`90a3ec9`). **Copy All Colors** seeds html/body back into
  the scan (457a482 regression) and drops url()-hex false positives
  (`4d0b47b`).
- **All tools** ignore input during the 1–1.5 s confirmation window
  (`abb4c29`) and report the actual clipboard outcome (`de40c5f`); the
  web-font badge matches case-insensitively (`ea1213c`); picker/font
  re-resolve the hovered element on scroll (`e4cf473`).
- **Backgrounds ×3**: the ● badge tracks its owning tab (storage.session)
  and clears on tab close/navigation; a stale toolCancelled can no longer
  clear a newer tool's badge (`fef889b`); context-menu/keyboard activation
  failures flash a red `!` badge + tooltip (`e317f2b`); chrome's injection
  retry waits like edge's (`ed4d68d`); firefox chains log storage errors,
  still forward to the popup, and contextMenus.create failures are
  actually observed (`d3041fe`).
- **Popup ×3**: delete-confirm can't fire cross-palette and saved-font
  removal is by identity (`f361639`); legacy-record guards in the three
  copy paths (`c96efc2`); Copy-as-CSS re-enables on live data, one toast
  at a time, Show-all follows the collapse state (`af794ab`); contrast
  readout shows two decimals + aria-pressed/aria-expanded (`20bd3c5`);
  import validates names and honors createPalette's result (`9b4f81f`);
  firefox storage failures now surface (`d3d633d`); dead getPalette
  removed ×3 (`3fa0515`).
- **CSS ×3**: dark-mode contrast repairs (confirm chip, font-preview
  checkerboard, small controls, info toast, welcome tagline), options
  page gains its missing dark theme (closing the Feature 2.7 gap), and
  disabled buttons look disabled (`766ac0b`).
- **Manifests/CI**: web_accessible_resources dropped ×3; chrome declares
  minimum_chrome_version 102 (`f554c5b`); edge's sub-minute alarm clamp
  documented (`73b19af`); CI gains a tag==manifest guard and a single
  de-raced release job (`1059109`).
- **Docs/cosmetics**: welcome-page context-menu wording matches the real
  flat menu ×3 (`5e23116`); stale 2.0.0 file headers and the popup v2.0
  fallback badge bumped to 2.2 (`0f2b3a3`).

## Gates re-run after the pass (all green)

- `node --check` on all 15 runtime JS files.
- chrome↔edge parity: content-script diff = header line only; popup.js /
  popup.css / palette.js / options.css / welcome assets byte-identical.
- Greps: `prompt(|confirm(|alert(` = 0, `Ctrl+Shift` = 0,
  `fetch(|XMLHttpRequest` = 0.
- dist zips rebuilt (forward-slash arcnames), extracted, `diff -rq` vs
  tree: IDENTICAL ×3.
- `web-ext lint` (firefox): 0 errors, 1 warning (accepted:
  MISSING_DATA_COLLECTION_PERMISSIONS — owner action below).

## Documented as accepted (not fixed, by design)

- **`palettes` read-modify-write races** — background pageColorsCollected
  vs popup palette.js mutators (recentColors similarly two-writer). In
  practice the popup is closed during collection; a single-writer
  refactor is a v2.3 candidate, not a 2.2.0 blocker.
- **chrome/edge palette.js ignores `runtime.lastError`** in its storage
  callbacks (false-success toasts possible on storage failure) — same
  risk class as the RMW race; belongs to the same v2.3 storage refactor.
- **getRenderedFont canvas heuristics** — oblique-angle fonts defeat the
  shorthand parser and the first-font fallback can over-claim; detector
  is best-effort by design (advisory).
- **options.js settings RMW** — two toggles racing is theoretical.

## Still open (owner action)

- Manual smoke matrix (Section 3.8) in real browsers before upload.
- AMO `data_collection_permissions` manifest field before AMO upload.
- `host_permissions` vs store copy — reserved owner decision.
- **Store screenshots — RESOLVED 2026-07-07**: a designed asset set
  (5 screenshots at 1280×800 + 440×280 and 1400×560 promo tiles, 24-bit
  PNG no-alpha) now lives in the parent folder's `store-assets/`
  (source: `promo/source/src/store/StoreAssets.tsx`, rendered via
  Remotion stills). The old `screenshots/` + `IMAGES/` sets are
  superseded.
- `docs/assets/social-preview.png` artwork freshness unverified against
  current branding.
- CoC contact `LXBStudioLLC@gmail.com` (deliberate correction in
  `2ac5b81`) — confirm that mailbox exists before pointing contributors
  at it.
