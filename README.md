# Chrome EQ & Volume Boost 🎧

A powerful, privacy-focused Chrome Extension to boost volume (up to 400%) and equalize audio frequencies using the modern **Web Audio API** and **Offscreen Documents**.

![Version](https://img.shields.io/badge/version-1.5.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **🔊 Volume Booster:** Clean pre-amp gain up to 400%.
- **🎚️ 3-Band Equalizer:** Fine-tune Bass, Mid, and Treble (-12dB to +12dB).
- **📻 Retro Marquee Mode:** Scrolling song title display with interactive **Click-to-Copy** and smart visual buffering.
- **🌙 Persistent Dark Mode:** Features a dedicated theme engine with a localized moon icon and a high-integrity blue UI design.
- **🧠 Smart Audio Engine:**
  - **Zero-Latency Response:** Instant visual reaction to play/pause events with no lag.
  - **Extended Battery Life:** Intelligent background silence detection (30s timeout) to automatically save resources.
  - **Ghost Buster:** Prevents "stuck" states by verifying audio engine health on startup.
- **🌍 Global Support:** Native support for 22 major languages with **Auto-Language Detection** that matches your browser's UI on first run.
- **🛡️ Privacy First:** Built with Manifest V3 and the `tabCapture` API. No scripts injected into your pages, ensuring maximum security through the Principle of Least Privilege.

## 🚀 Installation

### 🛒 Chrome Web Store (Recommended)
The easiest way to install is directly from the official store:
👉 [**Add to Chrome**](https://chromewebstore.google.com/detail/faklnjopaahkgaeklkplejmknidfcofh?utm_source=item-share-cb)

### 👨‍💻 From Source (Developer Mode)
If you want to inspect the code or build it yourself:
1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** (top right switch).
4. Click **"Load unpacked"**.
5. Select the folder containing this project.

## 🛠️ How it Works

Unlike older extensions that inject scripts into every page (breaking privacy), **Chrome EQ Boost** uses the `tabCapture` API to process audio in a sandboxed background environment.

1. **Popup:** User controls UI (Volume/EQ) powered by a centralized state-management architecture.
2. **Service Worker:** Coordinates communication between the Popup and Audio Engine.
3. **Offscreen Document:** Hooks into the audio stream using Web Audio API nodes (`BiquadFilterNode`, `GainNode`, `DynamicsCompressorNode`) to modify sound without latency.

## ☕ Support the Developer

This project is free and open-source. If you enjoy using it, consider supporting its maintenance!

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180">](https://buymeacoffee.com/jussitorres)

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

Copyright (c) 2025 Jussi Torres
