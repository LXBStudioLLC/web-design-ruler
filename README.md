<div align="center">

<img src="docs/assets/icon128.png" alt="Web Design Ruler" width="128" height="128">

# Web Design Ruler 📏 🎨 🔠

*The ultimate browser extension for web designers.*

**Measure  ·  Identify  ·  Pick — with precision.**
Free. Offline. Open source.

[![Install on Chrome](https://img.shields.io/badge/Install%20on-Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore/detail/cdheenjplgjmjfabnejeimmgdkajhadi)
[![Install on Edge](https://img.shields.io/badge/Install%20on-Edge-0078D7?style=for-the-badge&logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/nfgkdmbklfallhofeblhfkibdcobocjl)
[![Install on Firefox](https://img.shields.io/badge/Install%20on-Firefox-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/firefox/addon/web-design-ruler/)
[![Download ZIP](https://img.shields.io/badge/Download-ZIP-00E5FF?style=for-the-badge&logo=download&logoColor=white)](https://github.com/LXBStudioLLC/web-design-ruler/releases/latest)

<br>

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/cdheenjplgjmjfabnejeimmgdkajhadi?style=for-the-badge&label=Chrome%20Web%20Store&color=4285F4)](https://chrome.google.com/webstore/detail/cdheenjplgjmjfabnejeimmgdkajhadi)
[![Chrome users](https://img.shields.io/chrome-web-store/users/cdheenjplgjmjfabnejeimmgdkajhadi?style=for-the-badge&label=users&color=4285F4)](https://chrome.google.com/webstore/detail/cdheenjplgjmjfabnejeimmgdkajhadi)
[![Edge Add-ons](https://img.shields.io/badge/dynamic/json?label=Edge%20Add-ons&prefix=v&query=%24.version&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Fnfgkdmbklfallhofeblhfkibdcobocjl&style=for-the-badge&color=0078D7&logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/nfgkdmbklfallhofeblhfkibdcobocjl)
[![Edge users](https://img.shields.io/badge/dynamic/json?label=users&query=%24.activeInstallCount&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Fnfgkdmbklfallhofeblhfkibdcobocjl&style=for-the-badge&color=0078D7)](https://microsoftedge.microsoft.com/addons/detail/nfgkdmbklfallhofeblhfkibdcobocjl)
[![Firefox version](https://img.shields.io/amo/v/web-design-ruler?style=for-the-badge&label=Firefox%20Add-ons&color=FF7139)](https://addons.mozilla.org/firefox/addon/web-design-ruler/)
[![Firefox users](https://img.shields.io/amo/users/web-design-ruler?style=for-the-badge&label=users&color=FF7139)](https://addons.mozilla.org/firefox/addon/web-design-ruler/)
[![License: MIT](https://img.shields.io/github/license/LXBStudioLLC/web-design-ruler?style=for-the-badge&color=00E5FF)](./LICENSE)

[![GitHub stars](https://img.shields.io/github/stars/LXBStudioLLC/web-design-ruler?style=social)](https://github.com/LXBStudioLLC/web-design-ruler/stargazers)

</div>

---

## Demo

<div align="center">

[![Web Design Ruler — 60-second demo](https://img.youtube.com/vi/JBxUcxeUltI/maxresdefault.jpg)](https://www.youtube.com/watch?v=JBxUcxeUltI)

*Click to watch the 60-second walkthrough on YouTube.*

</div>

---

## What it does

Three precision tools, available from one toolbar button or the right-click menu.

<table>
<tr>
<td align="center" width="33%">

### 📏 Measure
Pixel-perfect ruler that snaps to elements. Get width, height, padding, margin, border, and area in one drag; hold Shift to snap to a 10 px grid. Copy any value as CSS with one click.

</td>
<td align="center" width="33%">

### 🔠 Identify Font
Hover any text on any site. See font family, weight, size, line-height, letter-spacing, and color — instantly. Save detected fonts to a rolling history, copy any entry as CSS, or lock the panel for copy-paste.

</td>
<td align="center" width="33%">

### 🎨 Pick Color
Eyedropper-style color picker with HEX/RGB/HSL output, recent colors history, saved palettes, and a built-in WCAG contrast checker. Right-click any swatch to copy its hex. Optional native EyeDropper (enable it in Options on Chrome/Edge); visual in-page picker by default everywhere.

</td>
</tr>
</table>

---

## Keyboard shortcuts

- **Open the popup:** `Alt+Shift+R`
- **Activate the color picker:** `Alt+Shift+P`
- **Activate the font detector:** `Alt+Shift+F`
- **Activate the measurement tool:** `Alt+Shift+M`

On Mac, use `Option+Shift+R/P/F/M`. Customize or reassign any shortcut in your
browser's extension shortcuts settings.

---

## Install

### Chrome / Brave / Arc / any Chromium browser

[**Web Design Ruler on the Chrome Web Store**](https://chrome.google.com/webstore/detail/cdheenjplgjmjfabnejeimmgdkajhadi) → click *Add to Chrome*.

### Microsoft Edge

[**Web Design Ruler on Edge Add-ons**](https://microsoftedge.microsoft.com/addons/detail/nfgkdmbklfallhofeblhfkibdcobocjl) → click *Get*.

### Firefox

[**Web Design Ruler on Firefox Add-ons**](https://addons.mozilla.org/firefox/addon/web-design-ruler/) → click *Add to Firefox*.

### Manual (unpacked from this repo)

Useful if you want the absolute latest source or you're hacking on the code.

```bash
git clone https://github.com/LXBStudioLLC/web-design-ruler.git
```

Then, in your browser:

| Browser | Steps |
|---|---|
| **Chrome / Edge** | Open `chrome://extensions/` (or `edge://extensions/`) → toggle **Developer mode** → click **Load unpacked** → select the `chrome/` (or `edge/`) folder. |
| **Firefox** | Open `about:debugging#/runtime/this-firefox` → click **Load Temporary Add-on** → select `firefox/manifest.json`. Note: Firefox temporary add-ons unload when the browser closes. |

The `chrome/`, `edge/`, and `firefox/` folders at the repo root are each a complete, ready-to-load unpacked extension. There is no build step.

---

## Privacy

The four guarantees that shape every line of code in this repo:

> **Operates entirely on your device.** We don't collect, store, or transmit
> any of your data or browsing history to our servers or third parties.

> **Minimum permissions.** The extension only requests the permissions needed
> to function. See [each manifest](./chrome/manifest.json) for the exact list.

> **No ads, no trackers, no bloat.** Every dependency adds weight and risk. We
> shipped this in roughly 100 KB of JavaScript per build.

> **Works offline.** No internet connection is required for the tools to
> operate after installation.

This is auditable. See [AUDIT.md](./AUDIT.md) for a verified grep of every
network-related call in the codebase — `fetch`, `XMLHttpRequest`, analytics
SDK names, `eval`, the lot. They are all zero.

---

## Why we built this

> As web designers and developers at LXB Studio, we often found ourselves
> switching between multiple tools to measure elements, identify fonts, and
> pick colors from websites. This workflow was inefficient and interrupted
> our creative process. We built Web Design Ruler to solve these pain
> points and create a streamlined workflow for ourselves and the design
> community.

If it saves you ten clicks a day, it's done its job.

---

## What's next

The [Roadmap](./ROADMAP.md) is the source of truth for upcoming work.
Recent releases:

- **v2.0.2** — Phase 1 audit cleanup: tool mutual exclusion, inline palette
  CRUD, `Alt+Shift+R/P/F/M` shortcuts, `safeSend()` context-invalidation
  guards, saved fonts list, and security hardening.
- **v2.1.0** — rAF-throttled mousemove, cached panel text nodes, options page
  with native EyeDropper opt-in, WCAG contrast checker, Copy as CSS,
  measurement copy buttons, recent-colors management, dark mode, and
  accessibility pass.
- **v2.2.0** — Firefox parity restoration: Copy All Colors on Page, measure
  area + Shift-snap, full saved-fonts history, right-click text-color picking,
  first-run welcome page, toolbar badge, and a Firefox-themed default palette.

Future candidates are in ROADMAP's **Later — v2.3+** section: spacing
inspector, box-shadow / gradient extractor, annotated screenshot export,
per-site palettes, and more.

Open an [issue](https://github.com/LXBStudioLLC/web-design-ruler/issues) to
push something up the list.

---

## Contributing

PRs welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) first — it's short.
The TL;DR: keep changes browser-aware (we ship three builds), don't add
network calls, and don't add permissions without an issue thread.

---

## License

[MIT](./LICENSE) © 2026 LXB Studio LLC. Use it, fork it, sell a variant,
whatever. The license is permissive.

---

<div align="center">

### Built by LXB Studio LLC

[![Website](https://img.shields.io/badge/lxb--studio.com-0a0a0a?style=for-the-badge&logo=googlechrome&logoColor=00E5FF)](https://lxb-studio.com)
[![Email](https://img.shields.io/badge/email-LXBStudioLLC@gmail.com-EC4899?style=for-the-badge&logo=gmail&logoColor=white)](mailto:LXBStudioLLC@gmail.com)
[![GitHub](https://img.shields.io/badge/GitHub-LXBStudioLLC-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/LXBStudioLLC)

*Other LXB Studio extensions and apps: [github.com/LXBStudioLLC](https://github.com/LXBStudioLLC)*

</div>
