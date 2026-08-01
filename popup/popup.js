/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

import { SLIDER_CONFIGS } from './constants.js';
import { storage } from './storageHelpers.js';
import { i18n } from './i18n.js';
import { themeEngine } from './themeEngine.js';
import { uiStatus } from './uiStatus.js';
import { themeEditor } from './themeEditor.js';
import { presetManager } from './presetManager.js';
import { confirmModal } from './modalEngine.js'; // <-- The Stateless Engine

let isMarqueeEnabled = true;
let copyTimeout = null;

document.addEventListener("DOMContentLoaded", async () => {
    // --- 0. GLOBAL MESSAGING UTILITY ---
    // Safely communicates with background/offscreen workers without throwing unhandled port errors
    const safeSend = (message, callback = () => { }) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) { return; }
            callback(response);
        });
    };

    // --- 1. 0ms SYNCHRONOUS UI & THEME LOCK ---
    const dropdown = document.getElementById("languageDropdown");
    const summary = document.getElementById("dropdownSelected");
    const cachedLang = localStorage.getItem("syncLocaleCache") || "en";

    if (dropdown && summary) {
        const activeOption = dropdown.querySelector(`.option[data-value="${cachedLang}"]`);
        if (activeOption) {
            summary.textContent = activeOption.textContent;
            activeOption.classList.add("selected");
        }
    }

    // Immediate Dark Mode & Custom Theme DOM Lock (Eliminates White Flash)
    chrome.storage.local.get(['darkMode', 'customThemeEnabled', 'customTheme'], (result) => {
        if (result.customThemeEnabled && result.customTheme) {
            themeEngine.apply('custom', result.customTheme);
        } else if (result.darkMode) {
            document.body.classList.add('dark-mode');
        }
    });

    // --- 2. INITIALIZE DATA & THEMES IMMEDIATELY ---
    const data = await storage.getAll();

    // --- SYNCHRONOUS STATE LOCK ---
    const earlyToggle = document.getElementById("toggleEnabled");
    const earlyResetBtn = document.getElementById("resetButton");

    // FIX: Hoist these UI references so they are initialized before the function call
    const presetToggleBtn = document.getElementById("presetToggleBtn");
    const generalControlsBlock = document.getElementById("generalControlsBlock");
    const presetControlsBlock = document.getElementById("presetControlsBlock");

    if (earlyToggle) earlyToggle.checked = data.isEnabled === true;
    if (earlyResetBtn) earlyResetBtn.disabled = data.isEnabled !== true;

    // PATCH: Evaluate preset deck state synchronously to prevent layout jumping
    if (data.isEnabled === true && data.isPresetDeckOpen === true) {
        setPresetDeckState(true);
    }

    // Apply themes instantly BEFORE waiting for translation files to download over the network
    themeEngine.init(data);

    let currentLocale = i18n.detectLocale(data.preferredLocale);
    localStorage.setItem("syncLocaleCache", currentLocale);

    const editThemeBtn = document.getElementById("editThemeBtn");

    // Bulletproof baseline sync: verify highlights line up with asynchronous storage accuracy
    if (dropdown) {
        dropdown.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
        const actualActive = dropdown.querySelector(`.option[data-value="${currentLocale}"]`);
        if (actualActive) {
            actualActive.classList.add('selected');
            if (summary) summary.textContent = actualActive.textContent; // <-- PATCH 4 APPLIED
        }
    }

    await i18n.load(currentLocale);

    // --- 3. INITIALIZE VISUALS & ENGINES ---
    confirmModal.init(); // <-- Initialize the Modal Engine
    await themeEditor.init();
    await presetManager.init();

    if (data.customThemeEnabled && editThemeBtn) {
        editThemeBtn.classList.remove("hidden");
    }

    isMarqueeEnabled = data.marqueeEnabled ?? true;

    // --- 4. INITIALIZE SLIDERS ---
    SLIDER_CONFIGS.forEach(config => {
        const savedVal = data[config.storageKey] ?? config.default;
        const slider = document.getElementById(config.id);
        const display = document.getElementById(config.display);

        if (slider) {
            slider.value = savedVal;
            updateDisplay(display, savedVal, config);

            slider.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value);
                updateDisplay(display, val, config);
                safeSend({ type: config.type, value: val });
                storage.set(config.storageKey, val);
            });
        }
    });

    // --- 5. UI REFERENCES & PANELS ---
    const toggle = document.getElementById("toggleEnabled");
    const container = document.getElementById("statusContainer");
    const statusMsg = document.getElementById("statusMessage");
    const takeOverBtn = document.getElementById("takeOverBtn");
    const marqueeToggle = document.getElementById("marqueeToggle");
    const resetBtn = document.getElementById("resetButton");
    const darkModeToggle = document.getElementById("darkModeToggle");

    const settingsBtn = document.getElementById("settingsBtn");
    const settingsPanel = document.getElementById("settingsPanel");
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");
    const openAboutBtn = document.getElementById("openAboutBtn");
    const closeAboutBtn = document.getElementById("closeAboutBtn");
    const aboutPanel = document.getElementById("aboutPanel");

    settingsBtn.addEventListener("click", () => settingsPanel.classList.remove("hidden"));
    closeSettingsBtn.addEventListener("click", () => settingsPanel.classList.add("hidden"));
    openAboutBtn.addEventListener("click", () => {
        settingsPanel.classList.add("hidden");
        aboutPanel.classList.remove("hidden");
    });
    closeAboutBtn.addEventListener("click", () => {
        aboutPanel.classList.add("hidden");
        settingsPanel.classList.remove("hidden");
    });

    // ==========================================================================
    // PURE HARDWARE HOVER STATE LOCK (Bug 2 Fix)
    // Replaces browser :hover hit-testing to eliminate 3D transform edge-flicker
    // ==========================================================================
    const tactileEls = document.querySelectorAll(
        '#updatePresetBtn, #deletePresetBtn, #revertPresetBtn, #newPresetBtn, #savePresetBtn, #presetDropdown summary, #presetNameInput'
    );

    tactileEls.forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('is-hover'));
        el.addEventListener('mouseleave', () => el.classList.remove('is-hover'));
    });

    // ==========================================================================
    // UNIVERSAL DROPDOWN ENGINE (Auto-Centering & Global Click-Outside)
    // Applies instant centering & visual feedback to Language, Presets, and Themes
    // ==========================================================================
    document.querySelectorAll('.custom-dropdown').forEach(customDrop => {
        customDrop.addEventListener('toggle', () => {
            if (customDrop.hasAttribute('open')) {
                // 1. Mutual Exclusivity: Close any other open dropdowns so menus don't overlap
                document.querySelectorAll('.custom-dropdown').forEach(other => {
                    if (other !== customDrop && other.hasAttribute('open')) {
                        other.removeAttribute('open');
                    }
                });

                // 2. Instant Vertical Centering
                const optionsContainer = customDrop.querySelector('.dropdown-options');
                const currentSelection = customDrop.querySelector('.option.selected') ||
                    customDrop.querySelector(`.option[data-value="${currentLocale}"]`);

                if (optionsContainer && currentSelection) {
                    const containerHeight = optionsContainer.clientHeight || 194;
                    const targetHeight = currentSelection.clientHeight || 36;
                    optionsContainer.scrollTop = currentSelection.offsetTop - (containerHeight / 2) + (targetHeight / 2);
                }
            } else {
                // 3. Clean focus removal when closing
                const summaryEl = customDrop.querySelector("summary");
                if (summaryEl) summaryEl.blur();
            }
        });
    });

    // Global Click-Outside Closer for ALL custom dropdowns
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.custom-dropdown').forEach(customDrop => {
            if (customDrop.hasAttribute('open') && !customDrop.contains(e.target)) {
                customDrop.removeAttribute('open');
            }
        });
    });

    // --- 6. PRESET / GENERAL CONTROLS TOGGLE ---
    if (presetToggleBtn && generalControlsBlock && presetControlsBlock) {
        presetToggleBtn.addEventListener("click", () => {
            if (!toggle.checked) return;

            const isHidden = presetControlsBlock.classList.contains("hidden");
            if (isHidden) {
                generalControlsBlock.classList.add("hidden");
                presetControlsBlock.classList.remove("hidden");
                presetToggleBtn.classList.add("active-mode");
                presetToggleBtn.style.backgroundColor = "var(--bg-hover)";
                storage.set("isPresetDeckOpen", true); // Save open state
            } else {
                generalControlsBlock.classList.remove("hidden");
                presetControlsBlock.classList.add("hidden");
                presetToggleBtn.classList.remove("active-mode");
                presetToggleBtn.style.backgroundColor = "";
                storage.set("isPresetDeckOpen", false); // Save closed state
            }
        });
    }

    // --- 7. LANGUAGE SWITCHING ENGINE ---
    if (dropdown && summary) {
        dropdown.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', async () => {
                const newLang = option.getAttribute('data-value');
                summary.textContent = option.textContent;
                dropdown.removeAttribute('open');

                dropdown.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');

                await storage.set("preferredLocale", newLang);
                localStorage.setItem("syncLocaleCache", newLang);

                if (statusMsg) {
                    statusMsg.removeAttribute("data-ui-type");
                    statusMsg.removeAttribute("data-last-title");
                }

                // Load the new language dictionary
                await i18n.load(newLang);

                // Force presetManager to re-render localized text immediately
                if (presetManager && presetManager.render) {
                    presetManager.render();
                }

                // Force themeEditor to re-render selected theme or localized placeholder immediately
                if (themeEditor && themeEditor.render) {
                    themeEditor.render();
                }

                currentLocale = newLang;
                refreshUI();
            });
        });
    }

    // --- 8. THEME & MARQUEE LISTENERS ---
    if (darkModeToggle) {
        if (!data.customThemeEnabled) {
            darkModeToggle.checked = !!data.darkMode;
        }

        darkModeToggle.addEventListener("change", (e) => {
            const enabled = e.target.checked;
            storage.set("darkMode", enabled);

            if (enabled) {
                const customToggle = document.getElementById("customThemeToggle");
                if (customToggle && customToggle.checked) {
                    customToggle.click();
                } else {
                    themeEngine.apply('dark');
                }
            } else {
                themeEngine.apply('default');
            }
        });
    }

    if (marqueeToggle) {
        marqueeToggle.checked = isMarqueeEnabled;
        marqueeToggle.addEventListener("change", (e) => {
            isMarqueeEnabled = e.target.checked;
            storage.set("marqueeEnabled", isMarqueeEnabled);
            if (statusMsg) statusMsg.removeAttribute("data-last-title");
            refreshUI();
        });
    }

    // --- 9. AUDIO RESET & CLIPBOARD COPY ---
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            SLIDER_CONFIGS.forEach(config => {
                const el = document.getElementById(config.id);
                if (el) {
                    el.value = config.default;
                    updateDisplay(document.getElementById(config.display), config.default, config);
                    safeSend({ type: config.type, value: config.default });
                    storage.set(config.storageKey, config.default);
                }
            });
            presetManager.setDirty(true);
        });
    }

    if (statusMsg) {
        statusMsg.addEventListener("dblclick", async () => {
            const titleToCopy = statusMsg.getAttribute("data-last-title");
            if (titleToCopy && !statusMsg.classList.contains('text-waiting')) {
                try {
                    await navigator.clipboard.writeText(titleToCopy);
                    if (copyTimeout) clearTimeout(copyTimeout);
                    statusMsg.style.transition = "color 0.2s";
                    statusMsg.style.color = "var(--status-success)"; // <-- PATCH 3 APPLIED
                    copyTimeout = setTimeout(() => { statusMsg.style.color = ""; }, 1400);
                } catch (err) {
                    console.error("Failed to copy text:", err);
                }
            }
        });
    }

    // --- 10. MAIN TOGGLE & STATE BOOTSTRAP ---
    toggle.addEventListener("change", async () => {
        if (toggle.checked) {
            if (container.classList.contains("conflict")) {
                await forceTakeover();
            } else {
                storage.set("isEnabled", true);
                syncPresetUIButton(true);
                startCapture();
            }
        } else {
            handleManualDisable();
        }
    });

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isEnabled = data.isEnabled === true;
    const capturingTabId = data.capturingTabId;

    syncPresetUIButton(isEnabled);

    if (isEnabled && capturingTabId && capturingTabId !== activeTab.id) {
        safeSend({ type: "TARGET_OFFSCREEN_PING" }, async (res) => {
            if (res && res.success) {
                container.classList.add("conflict");
                takeOverBtn.classList.remove("hidden");
                takeOverBtn.textContent = i18n.t("button_takeover") || "Use on this tab";
                toggle.checked = false;
                syncPresetUIButton(false);
                await uiStatus.update(true, false);
                takeOverBtn.onclick = forceTakeover;
            } else {
                storage.set("isEnabled", false);
                await uiStatus.update(false, false);
                syncPresetUIButton(false);
            }
        });
    } else if (isEnabled) {
        safeSend({ type: "TARGET_OFFSCREEN_PING" }, async (res) => {
            if (res && res.success) {
                await uiStatus.update(true, true, res.audioDetected, isMarqueeEnabled);

                // REMOVE THESE LINES:
                // FAIL-SAFE RESTORE: Only reopen if enabled AND stream is verified
                // if (data.isPresetDeckOpen === true) {
                //     setPresetDeckState(true);
                // }

                startWatchdog();
            } else {
                // Keep this: it safely wipes state if the offscreen document crashed
                storage.set("isEnabled", false);
                storage.set("capturingTabId", null);
                storage.set("isPresetDeckOpen", false);
                await uiStatus.update(false, false);
                syncPresetUIButton(false);
                setPresetDeckState(false);
            }
        });
    } else {
        await uiStatus.update(false, false);
        setPresetDeckState(false);
    }

    // --- 11. HELPER FUNCTIONS ---
    function syncPresetUIButton(enabled) {
        if (!presetToggleBtn) return;

        if (enabled) {
            presetToggleBtn.classList.remove("hidden");
            presetToggleBtn.style.opacity = "1";
            presetToggleBtn.style.cursor = "pointer";
        } else {
            // PATCH: Removed presetToggleBtn.classList.add("hidden");
            // We now rely exclusively on your popup.css :has() pseudo-class to render the disabled visual state.
            if (generalControlsBlock && presetControlsBlock) {
                presetControlsBlock.classList.add("hidden");
                generalControlsBlock.classList.remove("hidden");
                presetToggleBtn.classList.remove("active-mode");
                presetToggleBtn.style.backgroundColor = "";
            }
        }
    }

    function handleManualDisable() {
        uiStatus.stopPolling();
        container.classList.remove("conflict");
        takeOverBtn.classList.add("hidden");
        syncPresetUIButton(false);
        setPresetDeckState(false); // Force back to default deck
        safeSend({ type: "STOP_CAPTURE" });
        safeSend({ type: "TOGGLE_ENABLED", value: false });
        uiStatus.update(false, false);
        storage.set("isEnabled", false);
        storage.set("isPresetDeckOpen", false); // Wipe stale state
    }

    async function forceTakeover() {
        container.classList.remove("conflict");
        takeOverBtn.classList.add("hidden");
        document.querySelectorAll('input[type="range"]').forEach(e => e.disabled = false);
        if (resetBtn) resetBtn.disabled = false;

        safeSend({ type: "STOP_CAPTURE" }, () => {
            setTimeout(async () => {
                toggle.checked = true;
                storage.set("isEnabled", true);
                syncPresetUIButton(true);
                await startCapture();
            }, 200);
        });
    }

    function updateDisplay(el, val, config) {
        if (el) {
            el.textContent = config.multiplier === 100 ?
                `${Math.round(val * config.multiplier)}%` :
                `${val.toFixed(1)}${config.suffix}`;
        }
    }

    function startWatchdog() {
        uiStatus.startPolling((status) => {
            if (status.success) {
                uiStatus.update(true, true, status.audioDetected, isMarqueeEnabled);
            } else if (status.initializing) {
                uiStatus.update(false, true);
            } else if (status.disabled) {
                storage.set("isEnabled", false);
                if (toggle) toggle.checked = false;
                syncPresetUIButton(false);
                uiStatus.stopPolling();
                uiStatus.update(false, false);
            }
        });
    }

    async function startCapture() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            await uiStatus.update(false, true);
            startWatchdog();
            safeSend({ type: "START_CAPTURE", tabId: tab.id });
        }
    }

    function refreshUI() {
        safeSend({ type: "TARGET_OFFSCREEN_PING" }, async (res) => {
            const isEnabled = toggle.checked;
            if (isEnabled && res && res.success) {
                await uiStatus.update(true, true, res.audioDetected, isMarqueeEnabled);
            } else {
                await uiStatus.update(false, isEnabled);
            }
        });
    }

    function setPresetDeckState(isOpen) {
        if (!presetToggleBtn || !generalControlsBlock || !presetControlsBlock) return;

        if (isOpen) {
            generalControlsBlock.classList.add("hidden");
            presetControlsBlock.classList.remove("hidden");
            presetToggleBtn.classList.add("active-mode");
            presetToggleBtn.style.backgroundColor = "var(--bg-hover)";
        } else {
            generalControlsBlock.classList.remove("hidden");
            presetControlsBlock.classList.add("hidden");
            presetToggleBtn.classList.remove("active-mode");
            presetToggleBtn.style.backgroundColor = "";
        }
    }

    // --- 12. STORAGE SYNCHRONIZATION ---
    chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area === "local") {
            const editThemeBtn = document.getElementById("editThemeBtn");

            if (changes.customThemeEnabled) {
                const isCustom = changes.customThemeEnabled.newValue;
                if (editThemeBtn) {
                    isCustom ? editThemeBtn.classList.remove("hidden") : editThemeBtn.classList.add("hidden");
                }
            }

            if (changes.darkMode || changes.customTheme || changes.customThemeEnabled) {
                const newData = await storage.getAll();
                themeEngine.init(newData);
            }

            if (changes.marqueeEnabled) {
                isMarqueeEnabled = changes.marqueeEnabled.newValue;
                refreshUI();
            }
        }
    });

    // --- 13. UI LIFECYCLE TEARDOWN (PATCH) ---
    // Intercepts forceful popup closures and wipes the deck state
    // preventing the Preset Deck from resurrecting on the next open.
    window.addEventListener("unload", () => {
        storage.set("isPresetDeckOpen", false);
    });
}); // <-- End of DOMContentLoaded