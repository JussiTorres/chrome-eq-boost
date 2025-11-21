# Chrome EQ & Volume Boost 🎧

A powerful Chrome Extension to boost volume (up to 400%) and equalize audio frequencies using the **Web Audio API** within an Offscreen Document environment.

## Features
- 🔊 **Volume Booster:** Pre-amp gain up to 400%.
- 🎚️ **3-Band Equalizer:** Adjust Bass, Mid, and Treble (-12dB to +12dB).
- 🛡️ **Tab Capture Technology:** Works on Spotify, SoundCloud, YouTube, and sites with strict CSP (Content Security Policy).
- ✨ **Robust Lifecycle:** Instant termination and reliable re-initialization (v1.1.1).

## Installation (Developer Mode)
1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** (top right switch).
4. Click **"Load unpacked"**.
5. Select the folder containing this project.

## Usage
1. Open a tab playing audio (e.g., Spotify).
2. Click the extension icon.
3. Toggle the switch to **ON**.
4. Adjust volume and EQ sliders to taste.

## Tech Stack
- **JavaScript (ES6+):** Core logic and state management.
- **Chrome Extension API (Manifest V3):** Handles security, stream capture (`tabCapture`), and background processing (`Offscreen Document`).
- **Web Audio API:** The audio processing engine.