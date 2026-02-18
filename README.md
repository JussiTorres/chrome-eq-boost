# Chrome EQ & Volume Boost 🎧

A professional-grade, privacy-focused audio suite for Chrome. Boost your volume up to **400%** and fine-tune your listening experience with a precision **HD 3-Band Equalizer**, all powered by a zero-latency modular architecture.

---

## ✨ Key Features

### 🔊 High-Fidelity Audio Engineering

* **Pro-Level Preamp:** Clean digital gain boost up to **400%** without distorting your source.
* **HD 3-Band Equalizer:** Re-tuned for audiophile transparency with a range of **+/- 15dB**.
* **Sub-Bass (80Hz):** Deep, resonant lows.
* **Vocal Clarity (2500Hz):** Enhanced presence for speech and vocals.
* **Air/Brilliance (8000Hz):** Crisp high-end definition.


* **Dynamics Processing:** Built-in **3:1 Compressor** with a soft-knee transition to prevent clipping while maintaining dynamic range.

### 🎨 Next-Gen UI & Personalization

* **Custom Theme Editor:** Create and save your own UI designs with a professional **3-color picker system**.
* **Dynamic Contrast Engine:** Intelligent UI logic that automatically adjusts text color (Black/White) based on your chosen accent colors for maximum readability.
* **Retro Marquee Mode:** A scrolling "ticker" display for song titles with **Double-Click-to-Copy** functionality.
* **Smart Dark Mode:** Persistent, high-integrity dark theme for late-night sessions.

### 🧠 Intelligent Audio Engine

* **Zero-Latency:** Instant visual and auditory reaction to play/pause events.
* **Power Efficient:** Background silence detection (30s timeout) automatically shuts down the engine to save system resources.
* **Auto-Healing:** Verifies engine health on startup to prevent "ghost" states or frozen sliders.

---

## 🌍 Global Support

The extension features **Auto-Language Detection** and is fully localized in **22 major languages**, including English, Español, Français, 日本語, 中文, and more.

---

## 🛡️ Privacy & Security

Built with **Manifest V3** and the principle of **Least Privilege**:

* **No Script Injection:** Unlike competitors, we never inject code into your webpages.
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

* **Engine:** Web Audio API (`BiquadFilterNode`, `DynamicsCompressorNode`).
* **Architecture:** Modular ES6 Javascript for high performance and maintainability.
* **Communication:** Asynchronous Service Worker orchestration.

---

## ☕ Support the Developer

This project is free and open-source. If it improves your daily browsing, consider supporting its maintenance!

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180">](https://buymeacoffee.com/jussitorres)

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.

**Copyright (c) 2025 Jussi Torres**