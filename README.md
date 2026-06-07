# Chrome EQ & Volume Boost 🎧

*One world in perfect harmony.*

A professional-grade, privacy-focused audio suite for Chrome. Boost your volume up to **400%** and fine-tune your listening experience with a precision **HD 3-Band Equalizer**, all powered by a robust, auto-healing modular architecture.

---

## ✨ Key Features

### 🔊 High-Fidelity Audio Engineering

* **Pro-Level Preamp:** Clean digital gain boost up to **400%** without distorting your source.
* **HD 3-Band Equalizer:** Re-tuned for audiophile transparency with a range of **+/- 15dB**.
* **Sub-Bass (80Hz):** Deep, resonant lows with a musical 0.7 Q-factor.
* **Vocal Clarity (2500Hz):** Enhanced presence and intelligibility for speech and vocals.
* **Air/Brilliance (8000Hz):** Crisp high-end definition for an airy, open soundstage.
* **Linear Signal Path:** Optimized architecture routing the visualizer and watchdog post-compression for high-fidelity signal analysis.
* **Dynamics Processing:** Built-in **3:1 Compressor** with a -24dB threshold and soft-knee transition acting as a master limiter to prevent digital clipping while preserving dynamic range.

### 🎨 Next-Gen UI & Personalization

* **Custom Theme Editor:** Create and save your own UI designs with a professional **3-color picker system**.
* **Dynamic Contrast Engine:** Intelligent UI logic that automatically adjusts text color (Black/White) and makes the Reset button a chameleon that adapts to your chosen accent colors.
* **Unified "Light-Up" Logic:** Smart state management via CSS `:has()` that applies a subtle opacity fade when disabled and a high-luminance glow when active.
* **Retro Marquee Mode:** A scrolling "ticker" display for song titles.
* **Dark Mode:** Persistent, high-integrity dark theme for late-night sessions.

### 🧠 Intelligent Audio Engine (v1.10.0 Update)

* **Auto-Healing Watchdog:** Proactively catches unexpected Chromium context suspensions (system sleep, tab discarding) via `onstatechange` events and executes programmatic recovery.
* **Concurrency-Safe Operations:** Implemented an atomic mutex lock (`creatingOffscreenPromise`) to prevent race condition crashes during rapid UI toggle interactions.
* **Centralized Teardown Pipeline:** Orchestrates clean resource disposal via `executeCleanTeardown()` and `stopHardwareTracks()`, strictly ensuring instantaneous track termination and forcing the blue casting icon to drop immediately.
* **Slider Routing Middleware:** Intercepts real-time modification events during background worker wake-cycles, safely piping adjustments to the offscreen canvas with fallback recovery.
* **Extended Silence Grace Period:** Background silence detection features an expanded 30-minute grace period buffer before executing proactive teardown to conserve system resources.
* **Zero-Latency Response:** Instant visual and auditory reaction to play/pause events with an optimized 500ms UI polling rate.

---

## 🌍 Global Support

The extension features **Auto-Language Detection** and is fully localized in **22 major languages**, including English, Español, Français, 日本語, 中文, and more.

---

## 🛡️ Privacy & Security

Built with **Manifest V3** and the principle of **Least Privilege**:

* **No Script Injection:** Unlike competitors, we never inject code into your webpages, keeping your data safe.
* **Sandboxed Processing:** Audio is processed in a secure, isolated **Offscreen Document** using the `tabCapture` API.
* **Minimal Permissions:** We only ask for the permissions required to process your audio—nothing more (`activeTab`, `tabCapture`, `offscreen`, `storage`).

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

* **Engine:** Web Audio API (`BiquadFilterNode`, `DynamicsCompressorNode`, `AnalyserNode`) wired into a linear node chain.
* **Architecture:** Modular ES6 Javascript (`themeEngine.js`, `uiStatus.js`, `storageHelpers.js`, `themeEditor.js`) for high performance and maintainability.
* **Communication:** Asynchronous Service Worker orchestration, atomic promise gates, and cross-context message routing.

---

## ☕ Support the Developer

**Chrome EQ Boost** is free and open-source. If it improves your daily browsing, consider supporting its maintenance!

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180">](https://buymeacoffee.com/jussitorres)

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.

**Copyright (c) 2025-2026 Jussi Torres**

---