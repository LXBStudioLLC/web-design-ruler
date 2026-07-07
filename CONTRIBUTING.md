# Contributing to Web Design Ruler

Thanks for considering a contribution. Web Design Ruler is a small free tool
maintained by **LXB Studio LLC** — contributions of any size are welcome.

## Quick links

- **Bug?** Open an [issue](https://github.com/LXBStudioLLC/web-design-ruler/issues/new?template=bug_report.md).
- **Idea?** Open a [feature request](https://github.com/LXBStudioLLC/web-design-ruler/issues/new?template=feature_request.md) — check the [Roadmap](./ROADMAP.md) first to avoid duplicates.
- **Code change?** Fork, branch, PR. See below.

## Repository layout

The repo holds three browser-specific builds, each loadable directly with
**Load unpacked**:

```
chrome/    # Chrome / Chromium (MV3, service worker)
edge/      # Microsoft Edge (MV3 + alarms keep-alive)
firefox/   # Firefox (MV3, background script, browser.* APIs)
```

The three builds intentionally diverge where the underlying browser APIs
differ. When fixing a bug, ask first: does this need to change in one build,
or all three? Most logic bugs need to land in all three.

## Local development

1. Pick a browser and load the matching folder unpacked:
   - Chrome — `chrome://extensions/` → enable Developer mode → **Load unpacked** → select `chrome/`.
   - Edge — `edge://extensions/` → enable Developer mode → **Load unpacked** → select `edge/`.
   - Firefox — `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `firefox/manifest.json`.
2. Edit files in place; reload the extension from the browser's extensions
   page after each change.
3. Test manually on real sites. Follow the smoke matrix in [HANDOFF.md](./HANDOFF.md) (Section 3.8) — at minimum exercise the color picker, font detector, measurement tool, palettes, and the right-click context menu on a few real sites.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `fix:` — bug fix
- `feat:` — user-visible new behavior
- `chore:` — tooling, repo housekeeping
- `docs:` — documentation only
- `ci:` — GitHub Actions / build pipeline

Scope the subject line to the smallest meaningful change. Squash large
exploratory commits before opening the PR.

## Pull request checklist

- [ ] The change works in **all three** target browsers (or you've explained
      why it's browser-specific in the PR description).
- [ ] No new network calls, analytics, or telemetry — WDR's privacy guarantee
      ("entirely on your device, no data transmitted") is load-bearing.
- [ ] No new permissions requested in any `manifest.json` unless explicitly
      discussed and approved in the issue thread first.
- [ ] `CHANGELOG.md` updated under `[Unreleased]`.
- [ ] If you added user-facing UI text, it makes sense without product
      knowledge.

## Releasing (maintainers)

1. Bump `version` in `chrome/manifest.json`, `edge/manifest.json`,
   `firefox/manifest.json`.
2. Move `[Unreleased]` entries into a new dated section in `CHANGELOG.md`.
3. Build the store-ready zips locally:
   ```bash
   # Example for v2.2.0 — run from the repo root
   cd chrome && zip -r ../dist/web-design-ruler-2.2.0-chrome.zip . -x "*.DS_Store" "*.swp"
   cd ../edge && zip -r ../dist/web-design-ruler-2.2.0-edge.zip . -x "*.DS_Store" "*.swp"
   cd ../firefox && zip -r ../dist/web-design-ruler-2.2.0-firefox.zip . -x "*.DS_Store" "*.swp"
   ```
   These `dist/` zips are what gets uploaded to the stores. On Windows,
   build them with a small Python `zipfile` walk instead: entry names must
   use forward slashes (AMO rejects backslash paths), and Git Bash doesn't
   ship the `zip` CLI by default.
4. Tag: `git tag vX.Y.Z && git push --tags`.
5. The [`.github/workflows/build.yml`](./.github/workflows/build.yml) workflow
   runs on tag pushes, packages each browser build into a zip, uploads them as
   workflow artifacts, and attaches them to the GitHub Release. This is a
   parity/checksum build; the store uploads still use the locally built `dist/`
   zips from step 3.
6. Upload the `dist/` zips manually to the [Chrome Web Store dashboard](https://chrome.google.com/webstore/devconsole), [Microsoft Edge Partner Center](https://partner.microsoft.com/en-us/dashboard/microsoftedge/), and [Firefox Add-on developer hub](https://addons.mozilla.org/developers/).

## Code of conduct

By participating, you agree to the [Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

By contributing you agree your work is released under the [MIT License](./LICENSE).
