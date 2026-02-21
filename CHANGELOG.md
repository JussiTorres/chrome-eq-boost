# Changelog

All notable changes to the "Chrome EQ Boost" extension will be documented in this file.

## [1.9.0] - 2026-02-21

### 💄 UI Overhaul ("Void" Edition)

- **The Void Dark Mode:** Established a premium, high-contrast midnight aesthetic using a deep blue-black base (#020617) and midnight slate cards (#0F172A).
- **Unified "Light-Up" Logic:** Engineered a global state-management system via CSS :has() that applies a subtle opacity "fade" when disabled and a high-luminance "glow" when active.
- **Dynamic Accent Integration:** Refactored the "Reset EQ & Vol" button to be a true chameleon; it now automatically adopts the active accent color in Custom Themes while maintaining high-contrast text.
- **High-Luminance Status Indicators:** - Swapped standard colors for **Neon Jade** (#2DD4BF) during initialization for a digital terminal feel.
  - Implemented **Electric Orange** (#FF7A00) for waiting/active states to provide maximum contrast against dark backgrounds.

### 🎨 Design & Branding Polish

- **Minimalist Footer:** Stripped the "Buy Me A Coffee" section of its container box and borders, leaving a clean, floating icon and text for a more integrated look.
- **Hierarchy Refinement:** Synchronized all header and label blues to a unified Neon Cobalt system, eliminating clashing shades in Dark Mode.
- **Value Display Clarity:** Forced slider numerical values to a high-contrast white and **Electric Orange** system to ensure readability regardless of the slider's position.

### 🌐 Global Infrastructure
- **Locale Synchronization:** Updated all 22 localized messages.json files to align with the revised UI hierarchy.

## [1.8.0] - 2026-02-17

### ✨ Audio Engineering (HD Upgrade)

* **High-Fidelity Tuning:** Refactored the audio engine to prioritize musical transparency over aggressive limiting.
* **New Dynamics Chain:** Implemented a gentle 3:1 compressor ratio with a -24dB threshold and soft-knee transition to prevent clipping while preserving dynamic range.
* **Audiophile EQ Frequencies:** - Re-tuned Bass to **80Hz** for deeper sub-frequency response.
* Re-tuned Mids to **2500Hz** to enhance vocal clarity and presence.
* Applied a musical **0.7 Q-factor** to the peaking filter for smoother, more natural frequency curves.
* **Zen Balance UI:** Increased the EQ range to **+/- 15dB**, providing a middle ground between standard fidelity and extreme boosting.

### 🌍 Localization & Infrastructure

* **Massive Locale Refactor:** Expanded the localization system with numerous new key variables to support deeper UI translation across all 22 languages.
* **UI Alignment:** Updated labels in the popup to accurately reflect the new 80Hz/2500Hz HD frequency targets and the +/- 15dB range globally.

## [1.7.0] - 2026-02-17

### ✨ New Features

- **Custom Theme Editor:** Users can now create, save, and delete their own custom themes using a new 3-color picker interface.
- **Dynamic Contrast Engine:** The "Reset" button and other UI elements now automatically switch between Black/White text based on the brightness of the user's custom accent color.
- **Smart Safety Checks:** Added a confirmation modal to prevent accidental deletion or overwriting of existing themes.

### 💄 UI/UX Improvements
- **Responsive Modal:** The delete/overwrite confirmation modal now adapts its width to the content, removing unnecessary whitespace.

## [1.6.1] - 2026-02-16

### 🏗️ Code Architecture & Maintainability

- **Modular Refactor:** Completely dismantled the monolithic `popup.js` into a robust, ES6 module-based architecture to improve scalability and debugging.
- **Logic Decoupling:** Distributed core responsibilities into specialized modules:
  - `themeEngine.js`: Dedicated handler for Dark Mode persistence and UI transitions.
  - `i18n.js`: Centralized localization engine for seamless multi-language support.
  - `storageHelpers.js`: Unified wrapper for all `chrome.storage.local` operations.
  - `uiStatus.js`: Isolated UI state management for active, waiting, and disabled states.
  - `constants.js`: Centralized configuration for audio sliders and engine polling rates.
- **Performance Optimization:** Improved initialization speed by utilizing a directory-based module loading system, reducing redundant logic execution in the popup.

## [1.5.1] - 2026-02-10

### 🎨 Visual Engineering & Branding
- **"Engineered Soft" Theme:** Completely refactored the color palette from harsh "Electric Blues" to a softer, professional "Inter Blue" (`#3b82f6`) system to reduce eye strain.
- **Brand Alignment:** Synced the UI accent colors (Orange/Blue) to perfectly match the updated `logo-horizontal.png`.
- **Donate Button Polish:** Changed the "Buy me a coffee" button from neon yellow to a matte "Latte Gold" (`#fbbf24`) with dark coffee text for a premium look.

### 🐛 Critical Fixes
- **Contrast Inversion Fix:** Fixed a critical CSS bug where text contrast variables were swapped, causing labels to be invisible in Light Mode and too dark in Dark Mode.
- **Dark Mode Readability:** Tuned section headers and labels to "Silver" (`#cbd5e1`) for better legibility against the new "True Black" (`#121212`) OLED background.

## [1.4.1] - 2026-01-17
### 🌍 Southeast Asia & Baltic Expansion
- **New Languages:** Added full native support for 6 new regions:
  - **Thai (th)**
  - **Vietnamese (vi)**
  - **Filipino (fil)**
  - **Khmer (km)**
  - **Lithuanian (lt)**
  - **Dutch (nl)**
- **Auto-Detection:** The extension now automatically detects and applies these languages based on the user's browser settings.

### 💅 UI & Polish
- **Status Text Cleanup:** Simplified the "Waiting for audio..." message across all 22 supported languages (removed the redundant "Capture started" prefix) for a cleaner, more professional look.
- **Menu Update:** Added the new languages to the Settings dropdown.

## [1.4.0] - 2026-01-13
### ✨ New Features (Retro & Interactive)
- **Retro Marquee Mode:** Added a scrolling "ticker" style song title display.
  - Features an **Interactive Double-Click-to-Copy** function (requires double-click to prevent accidental clipboard overrides).
  - Includes a **Smart Visual Buffer** (Hysteresis) that prevents the text from flashing "Waiting..." during short gaps between songs.
  - Added a toggle in Settings with a custom **Retro MP3 Player Icon** to enable/disable the effect.
- **Smart Fade Mask:** The scrolling text now features a dynamic fade effect on the edges that only activates when animation is running.

### ⚡ Core Engine Improvements
- **Auto-Healing Logic:** The popup now includes a startup "Grace Period," ignoring initial connection failures for 2 seconds to allow the audio engine to warm up without stuttering the UI.
- **Extended Battery Life:** Moved the silence detection logic to the background (`offscreen.js`). The extension now waits for **30 seconds of silence** (up from 5s) before auto-shutting down.
- **Zero-Latency Response:**
  - Removed audio analyzer smoothing for instant visual reaction to play/pause.
  - Increased UI polling rate to 500ms for a snappy 60fps feel.

### 🌐 Localization
- **Universal Support:** Added `settings_marquee` key to all 16 supported languages.
- **Refinements:** Improved grammar and native phrasing for Portuguese (BR), Ukrainian, Russian, and Turkish.

### 🛡️ Stability & Fixes
- **Windows Stutter Fix:** Forced GPU acceleration (`backface-visibility`) to eliminate marquee frame drops on Windows 11.
- **Animation Loop Logic:** Fixed a critical bug where the status update loop was forcibly resetting the animation every 500ms.
- **Race Condition Proof:** Implemented a "Kill Switch" to ignore "Zombie" messages from a closing engine.
- **Message Hygiene:** Removed redundant `syncAudioEngine` calls to prevent port flooding.
- **Error Handling:** Added safety catches to eliminate "Unchecked runtime.lastError" console noise.

## [1.3.1] - 2026-01-06
### Added
- **Auto-Language Detection:** Implemented `chrome.i18n` logic to automatically match the extension language to the browser's UI on the first run.
- **First-Run Intelligence:** Established a strict Light Mode default for new installs, ensuring the theme engine only activates persistence after the user's first manual choice.
- **UI Update:** Added a localized moon icon to the Dark Mode settings toggle for better visual clarity.

### Changed
- **Logic Centralization:** Fully refactored `popup.js` to use a single-fetch storage block, improving performance and eliminating redundant database calls.

## [1.3.0] - 2026-01-05
### Added
- Persistent Dark Mode theme engine.
- High-integrity blue theme for section titles and toggles.

### Changed
- Refactored entire CSS architecture to use dynamic variables.

## [1.2.7] - 2025-12-31
### Added
- **Greater Chinese Expansion:** Added native support for Traditional Chinese (zh_TW) optimized for Taiwan and Hong Kong users.
- **Terminology Polish:** Implemented region-specific technical terms.

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