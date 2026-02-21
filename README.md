# Chrome EQ & Volume Boost 🎧

A professional-grade, privacy-focused audio suite for Chrome. Boost your volume up to **400%** and fine-tune your listening experience with a precision **HD 3-Band Equalizer**, all powered by a zero-latency modular architecture.

---

## ✨ Key Features

### 🔊 High-Fidelity Audio Engineering

* **Pro-Level Preamp:** Clean digital gain boost up to **400%** without distorting your source.
* **HD 3-Band Equalizer:** Re-tuned for audiophile transparency with a range of **+/- 15dB**.
* **Sub-Bass (80Hz):** Deep, resonant lows with a musical 0.7 Q-factor.
* **Vocal Clarity (2500Hz):** Enhanced presence and intelligibility for speech and vocals.
* **Air/Brilliance (8000Hz):** Crisp high-end definition for an airy, open soundstage.
* **Dynamics Processing:** Built-in **3:1 Compressor** with a -24dB threshold and soft-knee transition to prevent clipping while preserving dynamic range.

### 🎨 Next-Gen UI & Personalization

* **"Void" Design (New):** A premium, high-contrast midnight aesthetic using a deep blue-black base (`#020617`) and midnight slate cards (`#0F172A`) for reduced eye strain.
* **Custom Theme Editor:** Create and save your own UI designs with a professional **3-color picker system**.
* **Dynamic Contrast Engine:** Intelligent UI logic that automatically adjusts text color (Black/White) and makes the Reset button a chameleon that adapts to your chosen accent colors.
* **Unified "Light-Up" Logic:** Smart state management via CSS `:has()` that applies a subtle opacity fade when disabled and a high-luminance **Electric Orange** (`#FF7A00`) glow when active.
* **Retro Marquee Mode:** A scrolling "ticker" display for song titles with **Double-Click-to-Copy** functionality.
* **Smart Dark Mode:** Persistent, high-integrity dark theme for late-night sessions.

### 🧠 Intelligent Audio Engine

* **Zero-Latency:** Instant visual and auditory reaction to play/pause events with a 500ms UI polling rate.
* **Power Efficient:** Background silence detection (30s timeout) automatically shuts down the engine to save system resources.
* **Auto-Healing:** Verifies engine health on startup to prevent "ghost" states or frozen sliders.

---

## 🌍 Global Support

The extension features **Auto-Language Detection** and is fully localized in **22 major languages**, including English, Español, Français, 日本語, 中文, and more.

---

## 🛡️ Privacy & Security

Built with **Manifest V3** and the principle of **Least Privilege**:

* **No Script Injection:** Unlike competitors, we never inject code into your webpages, keeping your data safe.
* **Sandboxed Processing:** Audio is processed in a secure, isolated **Offscreen Document** using the `tabCapture` API.
* **Minimal Permissions:** We only ask for the permissions required to process your audio—nothing more.

---

## 🚀 Installation

### 🛒 Chrome Web Store

The most secure and easiest method:
👉 [**Add to Chrome**](https://chromewebstore.google.com/detail/faklnjopaahkgaeklkplejmknidfcofh?utm_source=item-share-cb)

### 👨‍💻 Developer Mode (Source)

1. Clone this repository.
2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project folder.

---

## 🛠️ Technical Stack

* **Engine:** Web Audio API (`BiquadFilterNode`, `DynamicsCompressorNode`, `AnalyserNode`).
* **Architecture:** Modular ES6 Javascript (`themeEngine.js`, `uiStatus.js`, `storageHelpers.js`) for high performance and maintainability.
* **Communication:** Asynchronous Service Worker orchestration and offscreen messaging.

---

## ☕ Support the Developer

**Chrome EQ Boost** is a **Zyntra Labs** project. It is free and open-source. If it improves your daily browsing, consider supporting its maintenance!.

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180">](https://buymeacoffee.com/jussitorres)

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.

**Copyright (c) 2026 Jussi Torres**

---
