# Chrome EQ & Volume Boost 🎧

A powerful, privacy-focused Chrome Extension to boost volume (up to 400%) and equalize audio frequencies using the modern **Web Audio API** and **Offscreen Documents**.

![Version](https://img.shields.io/badge/version-1.2.7-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **🔊 Volume Booster:** Clean pre-amp gain up to 400%.
- **🎚️ 3-Band Equalizer:** Fine-tune Bass, Mid, and Treble (-12dB to +12dB).
- **🧠 Smart Audio Engine:**
  - **Silence Detection:** Automatically detects if audio is playing or waiting.
  - **Auto-Shutdown:** Saves resources by turning off when the tab is closed or silent.
  - **Ghost Buster:** Prevents "stuck" states if Chrome kills the background process.
- **🌍 Global Support:** Native support for 15 major languages across the Americas, Europe, and Asia.
- **🛡️ Privacy First:** Built with Manifest V3 and the `tabCapture` API. No scripts injected into your pages, ensuring maximum security.

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

1. **Popup:** User controls UI (Volume/EQ).
2. **Service Worker:** Coordinates communication between Popup and Audio Engine.
3. **Offscreen Document:** Hooks into the audio stream using Web Audio API nodes (`BiquadFilterNode`, `GainNode`, `DynamicsCompressorNode`) to modify sound without latency.

## ☕ Support the Developer

This project is free and open-source. If you enjoy using it, consider supporting its maintenance!

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180">](https://buymeacoffee.com/jussitorres)

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

Copyright (c) 2025 Jussi Torres