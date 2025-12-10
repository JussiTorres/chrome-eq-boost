# Changelog

All notable changes to the "Chrome EQ Boost" extension will be documented in this file.

## [1.2.3] - 2025-12-10
### Added
- **Audio Activity Detection:** Implemented an `AnalyserNode` in the audio engine to detect real-time silence. The UI now distinguishes between "Active" (Green) and "Waiting for audio..." (Orange).
- **Auto-Shutdown:** The extension now automatically powers off and resets its state if the audio stream is terminated externally or if Chrome's battery saver kills the process.
- **Branding:** Replaced text header with the official "Chrome EQ Boost" logo and refined UI spacing.
- **UI Footer:** Added a sticky footer in the Settings panel with developer credits and version info.

### Fixed
- **Ghost State Logic:** Implemented "Ghost Buster" checks on startup. The popup now verifies if the audio engine is truly alive before showing an "Active" state, preventing false positives.
- **Startup Cleanup:** Fixed a bug where the extension retained "active" state after a browser restart. Added `onStartup` listeners in Service Worker to clear stale storage data.
- **Conflict Resolution:** The main toggle switch now intelligently handles "Take Over" actions. Toggling it ON in a conflict scenario now automatically claims the audio stream for the current tab.
- **UX/Safety:** The "Reset EQ & Vol" button is now strictly locked (disabled) when the extension is off or in conflict mode, preventing accidental resets.
- **UI Polish:** Removed unsightly scrollbars across all languages and fixed startup flickering issues where status text was missing.

## [1.2.2] - 2025-11-28
### Fixed
- **Logic:** Implemented dynamic string replacement without requiring extension reload.
- **Fix:** Resolved hardcoded strings in Tab Conflict mode ('status_conflict').
- **UX:** Added state re-validation when switching languages to ensure status text remains accurate.

### Added
- **UI:** Added a 'Settings' overlay panel with real-time language selector.
- **Feat:** Add Multi-language Support and Settings Panel (v1.2.2).
- **i18n:** Implemented full localization support for 8 languages (En, Es, De, Fr, It, Ja, Hi, Zh_CN).

## [1.2.1] - 2025-11-21
### Fixed
- **Audio Sync:** Fixed critical bug where initial volume/EQ values were not applied until the user interacted with a slider. Added forced synchronization on startup.
- **Security/UX:** Patched a logic loophole where the "Reset" button remained active during Tab Conflicts. It is now disabled alongside the sliders to prevent accidental stream overriding.
- **Garbage Collection:** The extension now automatically clears capture state from storage if the captured tab is closed externally.

## [1.2.0] - 2025-11-21
### Added
- **Smart Tab Ownership:** The extension now tracks which tab is being captured.
- **Conflict Resolution UI:** A new panel appears if you open the extension on a different tab, allowing you to "Take Over" the audio control instantly.

### Changed
- **UI/UX:** Sliders now load their visual state immediately upon opening the popup, providing better feedback.

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