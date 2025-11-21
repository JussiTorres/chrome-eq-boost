# Changelog

All notable changes to the "Chrome EQ Boost" extension will be documented in this file.

## [1.1.1] - 2025-11-21
### Fixed
- **Critical Race Condition:** Fixed "Waiting for audio..." infinite loop. Implemented a private communication channel (`TARGET_OFFSCREEN_PING`) and polling logic to prevent `content.js` interference.
- **Stability:** Added safety timeouts for stream cleanup and isolated the IPC channel.

## [1.1.0] - 2025-11-21
### Fixed
- **Audio Lifecycle & Tab Capture:** Resolved persistent audio delay bug. Audio stream now terminates instantly when the extension is toggled off. **The core Tab Capture integration stability was finalized on this date.**
- **UI:** Fixed toggle switch visibility and cosmetic issues.

### Changed
- **Refactor:** Separated `STOP_CAPTURE` and `TOGGLE_ENABLED` commands in `popup.js` to ensure correct storage updates and stream termination.

## [1.0.1] - 2025-11-20
### Fixed
- **Initialization Stability:** Resolved conflicts between `service_worker` manual injection and `default_popup`.
- **Cross-Browser Styling:** Added `appearance: none` to sliders for better compatibility.

### Changed
- **Injection Method:** Switched to **declarative injection** using `content_scripts` in `manifest.json`.
- **Dynamic Sites:** Implemented `retryInitAudioGraph` in `content.js` to robustly detect media on SPAs.

## [1.0.0] - 2025-11-20
### Released
- **Initial Release:** First public version.
- **Features:** - Volume boost (up to 400%).
  - 3-band Equalizer (Bass, Mid, Treble).