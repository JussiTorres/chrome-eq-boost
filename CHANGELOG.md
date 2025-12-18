# Changelog

All notable changes to the "Chrome EQ Boost" extension will be documented in this file.

## [1.2.6] - 2025-12-18
### Added
- **Global Expansion:** Expanded localization support to 15 major languages by adding native support for Portuguese-BR, Polish, Russian, Ukrainian, Turkish, Indonesian, and Korean.
- **Cultural Nuance:** Refined all "Buy me a coffee" donation labels with region-specific "treat me" phrasing for a warmer user experience.

### Changed
- **UI Refinement:** Standardized capitalization (Sentence case) across all supported locales for a unified professional look.
- **Layout Optimization:** Fixed the "floating" footer bug in Settings and About panels using flex-grow; the footer now correctly pins to the bottom of the window.
- **Code Hygiene:** Replaced heavy inline styles in the About section with dedicated CSS classes for better maintainability.

## [1.2.5] - 2025-12-17
### Changed
- **UI Refinement:** Consolidated the Status message and Conflict Warning into a single, smart status container for a cleaner interface.
- **Visuals:** Optimized spacing and typography in the popup (removed bold warning text, tightened margins).
- **Navigation:** Fixed a bug where opening the "About" panel inside Settings would cause layout issues; panels are now properly sibling-structured.
- **UX:** Moved "Buy me a coffee" and author credits to a dedicated "About" view to de-clutter the main Settings list.

## [1.2.4] - 2025-12-11
### Security (Crucial)
- **Privacy Hardening:** Removed `content.js` and the `<all_urls>` permission entirely. The extension no longer has the ability to run scripts on web pages, strictly adhering to the **Principle of Least Privilege**.
- **Manifest Cleanup:** Removed unused `scripting` and `tabs` permissions to ensure the extension only requests exactly what it needs (`activeTab`, `tabCapture`, `offscreen`).

### Added
- **Support:** Added a "Buy me a coffee" donation button in the Settings panel.
- **Localization:** Finalized native translations for Japanese, Chinese, and Hindi to improve cultural relevance.

### Changed
- **Codebase:** Refactored `popup.css` into logical sections for better maintainability.
- **Legal:** Added MIT License headers to all source files protecting authorship (Jussi Torres).

## [1.2.3] - 2025-12-10
### Added
- **Audio Activity Detection:** Implemented an `AnalyserNode` in the audio engine to detect real-time silence. The UI now distinguishes between "Active" (Green) and "Waiting for audio..." (Orange).
- **Auto-Shutdown:** The extension now automatically powers off and resets its state if the audio stream is terminated externally or if Chrome's battery saver kills the process.
- **Branding:** Replaced text header with the official "Chrome EQ Boost" logo, added a sticky footer in Settings, and fixed missing icons in the Extensions Management page.
- **SEO & Metadata:** Updated manifest description to "Powerful and simple volume boost..." and ensured high-resolution icons are correctly registered.

### Fixed
- **Core Stability:** Fixed the "TypeError: Cannot read properties of undefined" error in `offscreen.js` by implementing a safe storage loading mechanism with fallback values.
- **Console Hygiene:** Suppressed harmless "Could not establish connection" errors in `service_worker.js` using proper promise catching.
- **Ghost State Logic:** Implemented "Ghost Buster" checks on startup. The popup now verifies if the audio engine is truly alive before showing an "Active" state.
- **Conflict Resolution:** The main toggle switch now intelligently handles "Take Over" actions seamlessly.
- **UX/Safety:** The "Reset EQ & Vol" button is now strictly locked (disabled) when the extension is off to prevent accidental resets.
- **UI Polish:** Removed unsightly scrollbars across all languages and fixed startup flickering issues.

## [1.2.2] - 2025-11-28
### Added
- **UI:** Added a 'Settings' overlay panel with real-time language selector.
- **i18n:** Implemented full localization support for 8 languages (En, Es, De, Fr, It, Ja, Hi, Zh_CN).

### Fixed
- **Logic:** Implemented dynamic string replacement without requiring extension reload.
- **UX:** Added state re-validation when switching languages.

## [1.2.1] - 2025-11-21
### Fixed
- **Audio Sync:** Fixed critical bug where initial volume/EQ values were not applied until user interaction.
- **Security:** "Reset" button is now disabled during Tab Conflicts to prevent accidental stream overriding.
- **Garbage Collection:** Automatic state cleanup if the captured tab is closed externally.

## [1.2.0] - 2025-11-21
### Added
- **Smart Tab Ownership:** Tracks which tab is being captured to prevent conflicts.
- **Conflict Resolution UI:** "Take Over" panel for managing multiple audio sources.

## [1.1.0] - 2025-11-21
### Fixed
- **Audio Lifecycle:** Solved persistent audio delay bug; stream now terminates instantly on toggle off.