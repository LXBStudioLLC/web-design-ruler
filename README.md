<div align="center">

<img src="docs/assets/icon128.png" alt="Web Design Ruler" width="128" height="128">

# Web Design Ruler 📏 🎨 🔠

*The ultimate browser extension for web designers.*

**Measure  ·  Identify  ·  Pick — with precision.**
Free. Offline. Open source.

[![Install on Chrome](https://img.shields.io/badge/Install%20on-Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore/detail/cdheenjplgjmjfabnejeimmgdkajhadi)
[![Install on Firefox](https://img.shields.io/badge/Install%20on-Firefox-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/firefox/addon/web-design-ruler/)
[![Download ZIP](https://img.shields.io/badge/Download-ZIP-00E5FF?style=for-the-badge&logo=download&logoColor=white)](https://github.com/LXBStudioLLC/web-design-ruler/releases/latest)

<br>

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/cdheenjplgjmjfabnejeimmgdkajhadi?style=for-the-badge&label=Chrome%20Web%20Store&color=4285F4)](https://chrome.google.com/webstore/detail/cdheenjplgjmjfabnejeimmgdkajhadi)
[![Chrome users](https://img.shields.io/chrome-web-store/users/cdheenjplgjmjfabnejeimmgdkajhadi?style=for-the-badge&label=users&color=4285F4)](https://chrome.google.com/webstore/detail/cdheenjplgjmjfabnejeimmgdkajhadi)
[![Chrome rating](https://img.shields.io/chrome-web-store/rating/cdheenjplgjmjfabnejeimmgdkajhadi?style=for-the-badge&label=rating&color=4285F4)](https://chrome.google.com/webstore/detail/cdheenjplgjmjfabnejeimmgdkajhadi)
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
Pixel-perfect ruler that snaps to elements. Get width, height, padding, margin, and border in one drag. No more squinting at DevTools' computed panel.

</td>
<td align="center" width="33%">

### 🔠 Identify Font
Hover any text on any site. See font family, weight, size, line-height, letter-spacing, and color — instantly. Click to lock the panel for copy-paste.

</td>
<td align="center" width="33%">

### 🎨 Pick Color
Eyedropper-style color picker with HEX/RGB/HSL output, recent colors history, and saved palettes. Native EyeDropper API where supported, visual fallback elsewhere.

</td>
</tr>
</table>

---

## Install

### Chrome / Brave / Arc / any Chromium browser

[**Web Design Ruler on the Chrome Web Store**](https://chrome.google.com/webstore/detail/cdheenjplgjmjfabnejeimmgdkajhadi) → click *Add to Chrome*.

### Microsoft Edge

The Chrome Web Store version works in Edge. Visit the link above in Edge and choose *Allow extensions from other stores*, then *Add to Chrome*. A native Edge listing is coming.

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
> shipped this in roughly 60 KB of JavaScript per build.

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
Highlights:

- **v2.0.1** — audit-driven polish (Firefox popup callback fix, permissions
  reconciliation) before the v2.0.0 store upload.
- **v2.1** — performance work on the mousemove paths and a popup toggle for
  the native EyeDropper API.
- **v2.2+** — CSS export, spacing inspector, WCAG contrast checker,
  box-shadow / gradient extractor, annotated screenshot export, per-site
  palettes.

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
