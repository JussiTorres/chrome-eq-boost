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
import { confirmModal } from './modalEngine.js';

let isMarqueeEnabled = true;
let copyTimeout = null;
let rejectionTimeout = null;
let isToggleTransitioning = false;

document.addEventListener("DOMContentLoaded", async () => {
    const safeSend = (message, callback = () => { }) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) { return; }
            callback(response);
        });
    };

    const send = (message) => new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (res) => {
            if (chrome.runtime.lastError || !res) return resolve(null);
            resolve(res);
        });
    });

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

    // 0ms Synchronous Dark Mode Lock
    if (localStorage.getItem("syncDarkMode") === "true") {
        document.body.classList.add('dark-mode');
    }

    chrome.storage.local.get(['darkMode', 'customThemeEnabled', 'customTheme'], (result) => {
        if (result.customThemeEnabled && result.customTheme) {
            themeEngine.apply('custom', result.customTheme);
        } else if (result.darkMode) {
            document.body.classList.add('dark-mode');
            try { localStorage.setItem("syncDarkMode", "true"); } catch (e) { }
        } else {
            document.body.classList.remove('dark-mode');
            try { localStorage.setItem("syncDarkMode", "false"); } catch (e) { }
        }
    });

    // --- 0ms SYNCHRONOUS PRE-WARM: MARQUEE & AUDIO HUD ---
    const earlyStatusMsg = document.getElementById("statusMessage");
    const earlyContainer = document.getElementById("statusContainer");
    const cachedEnabled = localStorage.getItem("syncEnabledState") === "true";
    const cachedTab = (() => {
        try { return JSON.parse(localStorage.getItem("cachedTabInfo")); } catch (e) { return null; }
    })();

    if (cachedEnabled && cachedTab?.title && earlyStatusMsg && earlyContainer) {
        earlyStatusMsg.setAttribute("data-ui-type", "active");
        earlyStatusMsg.setAttribute("data-last-title", cachedTab.title);
        earlyStatusMsg.classList.remove('text-disabled', 'text-waiting', 'text-loading');

        if (cachedTab.travelPx && document.documentElement.dir !== "rtl") {
            earlyStatusMsg.style.setProperty('--marquee-travel', `-${cachedTab.travelPx}px`);
            earlyStatusMsg.classList.add('marquee-text');
            earlyContainer.classList.add('mask-active');
            earlyStatusMsg.innerHTML = `<span class="marquee-content"><img src="${cachedTab.iconUrl || ''}" class="separator-icon" style="flex-shrink:0;"><span dir="auto">${cachedTab.title}</span></span>`.repeat(4);
        } else {
            earlyStatusMsg.classList.remove('marquee-text');
            earlyContainer.classList.remove('mask-active');
            earlyStatusMsg.innerHTML = `<span class="static-wrapper"><img src="${cachedTab.iconUrl || ''}" class="separator-icon" style="flex-shrink:0;"><span class="static-title" dir="auto">${cachedTab.title}</span></span>`;
        }
    }

    // --- 0ms SYNCHRONOUS SLIDER & PRESET HYDRATION ---
    const cachedAudio = (() => {
        try { return JSON.parse(localStorage.getItem("syncAudioSettings")); } catch (e) { return null; }
    })();

    if (cachedAudio) {
        const sliderMap = [
            { id: "volumeSlider", display: "volumeValue", val: cachedAudio.volumeLevel, mult: 100, suf: "%" },
            { id: "bassSlider", display: "bassValue", val: cachedAudio.bassLevel, mult: 1, suf: " dB" },
            { id: "midSlider", display: "midValue", val: cachedAudio.midLevel, mult: 1, suf: " dB" },
            { id: "trebleSlider", display: "trebleValue", val: cachedAudio.trebleLevel, mult: 1, suf: " dB" }
        ];

        sliderMap.forEach(item => {
            if (item.val !== undefined) {
                const sl = document.getElementById(item.id);
                const disp = document.getElementById(item.display);
                if (sl) sl.value = item.val;
                if (disp) {
                    disp.textContent = item.mult === 100
                        ? `${Math.round(item.val * item.mult)}%`
                        : `${item.val.toFixed(1)}${item.suf}`;
                }
            }
        });

        const presetText = document.getElementById("presetDropdownText");
        if (presetText && cachedAudio.activePresetTitle) {
            presetText.textContent = cachedAudio.activePresetTitle;
            presetText.removeAttribute("data-i18n");
        }
    }

    // --- 2. ASYNC STATE INITIALIZATION & TAB CHECK ---
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const data = await storage.getAll();

    // Reality first, storage second: ping offscreen to wipe any zombie/stale state
    const ping = await send({ type: "TARGET_OFFSCREEN_PING" });
    const alive = ping?.success === true;

    if (!alive && (data.isEnabled || data.capturingTabId)) {
        await storage.setMultiple({ isEnabled: false, capturingTabId: null });
        data.isEnabled = false;
        data.capturingTabId = null;
        try {
            localStorage.setItem("syncEnabledState", "false");
            localStorage.removeItem("cachedTabInfo");
        } catch (e) { }

        if (earlyStatusMsg) {
            earlyStatusMsg.textContent = "";
            earlyStatusMsg.removeAttribute("data-ui-type");
            earlyStatusMsg.removeAttribute("data-last-title");
            earlyStatusMsg.classList.remove('marquee-text');
        }
        if (earlyContainer) {
            earlyContainer.classList.remove('mask-active');
        }
    }

    // Purge cached preview if active tab differs
    if (cachedTab && cachedTab.tabId && activeTab?.id && cachedTab.tabId !== activeTab.id) {
        if (earlyStatusMsg) {
            earlyStatusMsg.textContent = "";
            earlyStatusMsg.removeAttribute("data-ui-type");
            earlyStatusMsg.removeAttribute("data-last-title");
            earlyStatusMsg.classList.remove('marquee-text');
        }
        if (earlyContainer) {
            earlyContainer.classList.remove('mask-active');
        }
    }

    const isEnabled = alive && data.isEnabled === true;
    const isCapturingAnotherTab = alive && !!(data.capturingTabId && activeTab?.id && data.capturingTabId !== activeTab.id);
    const isCapturingThisTab = alive && isEnabled && data.capturingTabId === activeTab?.id;
    const shouldEnableOnThisTab = isCapturingThisTab || (!alive && !isCapturingAnotherTab && data.autoStartupEnabled === true);

    const earlyToggle = document.getElementById("toggleEnabled");
    const earlyResetBtn = document.getElementById("resetButton");
    const presetToggleBtn = document.getElementById("presetToggleBtn");
    const generalControlsBlock = document.getElementById("generalControlsBlock");
    const presetControlsBlock = document.getElementById("presetControlsBlock");
    const container = document.getElementById("statusContainer");
    const statusMsg = document.getElementById("statusMessage");
    const takeOverBtn = document.getElementById("takeOverBtn");

    if (earlyToggle) earlyToggle.checked = shouldEnableOnThisTab;
    if (earlyResetBtn) earlyResetBtn.disabled = !shouldEnableOnThisTab;

    syncPresetUIButton(shouldEnableOnThisTab);

    // Persist preset deck state
    if (shouldEnableOnThisTab && data.isPresetDeckOpen === true) {
        setPresetDeckState(true);
    } else {
        setPresetDeckState(false);
    }

    themeEngine.init(data);

    let currentLocale = i18n.detectLocale(data.preferredLocale);
    localStorage.setItem("syncLocaleCache", currentLocale);

    const editThemeBtn = document.getElementById("editThemeBtn");

    if (dropdown) {
        dropdown.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
        const actualActive = dropdown.querySelector(`.option[data-value="${currentLocale}"]`);
        if (actualActive) {
            actualActive.classList.add('selected');
            if (summary) summary.textContent = actualActive.textContent;
        }
    }

    await i18n.load(currentLocale);

    // --- 3. INITIALIZE VISUALS & ENGINES ---
    confirmModal.init();
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

                try {
                    const cur = JSON.parse(localStorage.getItem("syncAudioSettings")) || {};
                    cur[config.storageKey] = val;
                    localStorage.setItem("syncAudioSettings", JSON.stringify(cur));
                } catch (err) { }
            });
        }
    });

    // --- 5. UI REFERENCES & PANELS ---
    const marqueeToggle = document.getElementById("marqueeToggle");
    const autoStartupToggle = document.getElementById("autoStartupToggle");
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

    const tactileEls = document.querySelectorAll(
        '#updatePresetBtn, #deletePresetBtn, #revertPresetBtn, #newPresetBtn, #savePresetBtn, #presetDropdown summary, #presetNameInput'
    );

    tactileEls.forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('is-hover'));
        el.addEventListener('mouseleave', () => el.classList.remove('is-hover'));
    });

    document.querySelectorAll('.custom-dropdown').forEach(customDrop => {
        customDrop.addEventListener('toggle', () => {
            if (customDrop.hasAttribute('open')) {
                document.querySelectorAll('.custom-dropdown').forEach(other => {
                    if (other !== customDrop && other.hasAttribute('open')) {
                        other.removeAttribute('open');
                    }
                });

                const optionsContainer = customDrop.querySelector('.dropdown-options');
                const currentSelection = customDrop.querySelector('.option.selected') ||
                    customDrop.querySelector(`.option[data-value="${currentLocale}"]`);

                if (optionsContainer && currentSelection) {
                    const containerHeight = optionsContainer.clientHeight || 194;
                    const targetHeight = currentSelection.clientHeight || 36;
                    optionsContainer.scrollTop = currentSelection.offsetTop - (containerHeight / 2) + (targetHeight / 2);
                }
            } else {
                const summaryEl = customDrop.querySelector("summary");
                if (summaryEl) summaryEl.blur();
            }
        });
    });

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
            if (!earlyToggle.checked) return;

            const isHidden = presetControlsBlock.classList.contains("hidden");
            if (isHidden) {
                generalControlsBlock.classList.add("hidden");
                presetControlsBlock.classList.remove("hidden");
                presetToggleBtn.classList.add("active-mode");
                presetToggleBtn.style.backgroundColor = "var(--bg-hover)";
                storage.set("isPresetDeckOpen", true);
                data.isPresetDeckOpen = true;
            } else {
                generalControlsBlock.classList.remove("hidden");
                presetControlsBlock.classList.add("hidden");
                presetToggleBtn.classList.remove("active-mode");
                presetToggleBtn.style.backgroundColor = "";
                storage.set("isPresetDeckOpen", false);
                data.isPresetDeckOpen = false;
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

                await i18n.load(newLang);

                if (presetManager && presetManager.render) {
                    presetManager.render();
                }

                if (themeEditor && themeEditor.render) {
                    themeEditor.render();
                }

                currentLocale = newLang;
                refreshUI();
            });
        });
    }

    // --- 8. THEME, MARQUEE & SETTINGS LISTENERS ---
    if (darkModeToggle) {
        if (!data.customThemeEnabled) {
            darkModeToggle.checked = !!data.darkMode;
        }

        darkModeToggle.addEventListener("change", (e) => {
            const enabled = e.target.checked;
            storage.set("darkMode", enabled);
            try { localStorage.setItem("syncDarkMode", enabled ? "true" : "false"); } catch (err) { }

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

    if (autoStartupToggle) {
        autoStartupToggle.checked = !!data.autoStartupEnabled;
        autoStartupToggle.addEventListener("change", (e) => {
            storage.set("autoStartupEnabled", e.target.checked);
            data.autoStartupEnabled = e.target.checked;
        });
    }

    // --- 9. CLIPBOARD COPY ---
    // 🚨 NOTE: The `#resetButton` click listener was removed from here because
    // `presetManager.setupListeners()` already binds to `#resetButton`, resets all
    // 4 sliders, dispatches their 'input' events (which trigger `popup.js` slider
    // listeners to send messages and update storage), and clears `activePresetName`.
    // Having a second listener here caused duplicate messages and conflicting dirty states.

    if (statusMsg) {
        statusMsg.addEventListener("dblclick", async () => {
            const titleToCopy = statusMsg.getAttribute("data-last-title");
            if (titleToCopy && !statusMsg.classList.contains('text-waiting')) {
                try {
                    await navigator.clipboard.writeText(titleToCopy);
                    if (copyTimeout) clearTimeout(copyTimeout);
                    statusMsg.style.transition = "color 0.2s";
                    statusMsg.style.color = "var(--status-success)";
                    copyTimeout = setTimeout(() => { statusMsg.style.color = ""; }, 1400);
                } catch (err) {
                    console.error("Failed to copy text:", err);
                }
            }
        });
    }

    // --- 10. MAIN TOGGLE & CONFLICT RESOLUTION ---
    earlyToggle.addEventListener("change", async () => {
        if (isToggleTransitioning) return;
        isToggleTransitioning = true;

        try {
            if (earlyToggle.checked) {
                if (container.classList.contains("conflict")) {
                    await forceTakeover();
                } else {
                    await startCapture();
                }
            } else {
                await handleManualDisable();
            }
        } finally {
            isToggleTransitioning = false;
        }
    });

    if (alive && isCapturingAnotherTab) {
        // Conflict has priority over auto-enable
        container.classList.add("conflict");
        takeOverBtn.classList.remove("hidden");
        takeOverBtn.textContent = i18n.t("button_takeover") || "Use on this tab";
        earlyToggle.checked = false;
        syncPresetUIButton(false);
        setPresetDeckState(false);
        await uiStatus.update(true, false);
        takeOverBtn.onclick = async () => {
            if (isToggleTransitioning) return;
            isToggleTransitioning = true;
            try {
                await forceTakeover();
            } finally {
                isToggleTransitioning = false;
            }
        };
    } else if (alive && isCapturingThisTab) {
        await uiStatus.update(true, true, ping.audioDetected, isMarqueeEnabled);
        syncPresetUIButton(true);
        if (data.isPresetDeckOpen === true) setPresetDeckState(true);
        startWatchdog();
    } else if (data.autoStartupEnabled) {
        earlyToggle.checked = true;
        await startCapture();
    } else {
        await uiStatus.update(false, false);
        syncPresetUIButton(false);
        setPresetDeckState(false);
        storage.set("isPresetDeckOpen", false);
    }

    // --- 11. HELPER FUNCTIONS ---
    function syncPresetUIButton(enabled) {
        if (!presetToggleBtn) return;

        if (enabled) {
            presetToggleBtn.classList.remove("hidden");
            presetToggleBtn.style.opacity = "1";
            presetToggleBtn.style.cursor = "pointer";
        } else {
            presetToggleBtn.classList.add("hidden");
            if (generalControlsBlock && presetControlsBlock) {
                presetControlsBlock.classList.add("hidden");
                generalControlsBlock.classList.remove("hidden");
                presetToggleBtn.classList.remove("active-mode");
                presetToggleBtn.style.backgroundColor = "";
            }
        }
    }

    async function handleManualDisable() {
        if (rejectionTimeout) {
            clearTimeout(rejectionTimeout);
            rejectionTimeout = null;
        }
        uiStatus.stopPolling();

        // Only clear conflict early. Let uiStatus handle mask-active and marquee-text
        container.classList.remove("conflict");

        takeOverBtn.classList.add("hidden");
        syncPresetUIButton(false);
        setPresetDeckState(false);

        // Await STOP_CAPTURE so teardown finishes cleanly
        await send({ type: "STOP_CAPTURE" });

        // The UI now updates cleanly in a single frame AFTER the wait
        await uiStatus.update(false, false);

        await storage.setMultiple({
            isEnabled: false,
            isPresetDeckOpen: false,
            capturingTabId: null
        });

        data.isEnabled = false;
        data.isPresetDeckOpen = false;

        try {
            localStorage.setItem("syncEnabledState", "false");
            localStorage.removeItem("cachedTabInfo");
        } catch (e) { }
    }

    async function forceTakeover() {
        if (rejectionTimeout) {
            clearTimeout(rejectionTimeout);
            rejectionTimeout = null;
        }
        container.classList.remove("conflict");
        takeOverBtn.classList.add("hidden");

        // Removed the manual manual slider/resetBtn overrides here
        // We now let uiStatus.js handle the locking automatically.

        // Await full teardown before starting capture on the new tab
        await send({ type: "STOP_CAPTURE" });
        earlyToggle.checked = true;
        setPresetDeckState(false);
        await storage.set("isPresetDeckOpen", false);
        data.isPresetDeckOpen = false;

        // startCapture will naturally set the "Initializing..." lock
        await startCapture();
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
                storage.setMultiple({ isEnabled: false, capturingTabId: null });
                data.isEnabled = false;

                if (!data.autoStartupEnabled) {
                    storage.set("isPresetDeckOpen", false);
                    setPresetDeckState(false);
                    data.isPresetDeckOpen = false;
                }

                try {
                    localStorage.setItem("syncEnabledState", "false");
                    localStorage.removeItem("cachedTabInfo");
                } catch (e) { }

                if (earlyToggle) earlyToggle.checked = false;
                syncPresetUIButton(false);
                uiStatus.stopPolling();
                uiStatus.update(false, false);
            }
        });
    }

    async function startCapture() {
        if (rejectionTimeout) {
            clearTimeout(rejectionTimeout);
            rejectionTimeout = null;
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        await uiStatus.update(false, true); // Sets to "Initializing..."
        const res = await send({ type: "START_CAPTURE", tabId: tab.id });

        if (res?.success) {
            await storage.setMultiple({ isEnabled: true, capturingTabId: tab.id });
            try { localStorage.setItem("syncEnabledState", "true"); } catch (e) { }
            syncPresetUIButton(true);
            const currentData = await storage.getAll();
            if (currentData.isPresetDeckOpen === true) {
                setPresetDeckState(true);
            }
            startWatchdog();
        } else {
            // 1. IMMEDIATELY hide the preset UI
            syncPresetUIButton(false);
            setPresetDeckState(false);
            if (earlyToggle) {
                earlyToggle.checked = true; // Force it visually ON, preserving the spam animation

                // 2. Clear any existing timer if they are spamming the toggle
                if (rejectionTimeout) clearTimeout(rejectionTimeout);

                // 🚀 THE FIX: Manually lock the UI so "Extension enabled" never shows and sliders stay dead
                document.querySelectorAll('input[type="range"]').forEach(e => e.disabled = true);
                if (resetBtn) resetBtn.disabled = true;

                const toggleLabel = document.querySelector(".toggle-label");
                if (toggleLabel) {
                    toggleLabel.textContent = i18n.t("status_disabled") || "Extension disabled";
                    toggleLabel.classList.add('label-disabled');
                    toggleLabel.classList.remove('label-enabled');
                }

                // 🚀 NEW: Instantly show the conflict warning in red
                const statusMsg = document.getElementById("statusMessage");
                if (statusMsg) {
                    // Repurpose the existing translation key
                    statusMsg.textContent = i18n.t("status_conflict") || "Audio blocked by another app";
                    statusMsg.className = "status-message text-conflict"; // Applies the bold red styling
                    document.getElementById("statusContainer")?.classList.remove("mask-active");
                }

                // 3. Start a fresh 4-second countdown (No disabled lock!)
                rejectionTimeout = setTimeout(async () => {
                    rejectionTimeout = null;
                    earlyToggle.checked = false; // Trigger smooth slide "OFF"

                    // 4. Clean up storage
                    await storage.setMultiple({ isEnabled: false, capturingTabId: null });
                    try {
                        localStorage.setItem("syncEnabledState", "false");
                        localStorage.removeItem("cachedTabInfo");
                    } catch (e) { }
                    uiStatus.stopPolling();

                    // This will wipe the red conflict text and return it to the standard disabled state
                    await uiStatus.update(false, false);
                }, 4000);
            }
        }
    }

    function refreshUI() {
        // Guard: If currently in tab conflict mode, preserve the Take Over button & conflict state
        if (container && container.classList.contains("conflict")) {
            if (takeOverBtn) {
                takeOverBtn.textContent = i18n.t("button_takeover") || "Use on this tab";
                takeOverBtn.classList.remove("hidden");
            }
            return;
        }

        safeSend({ type: "TARGET_OFFSCREEN_PING" }, async (res) => {
            const isCurrentEnabled = earlyToggle.checked;
            if (isCurrentEnabled && res && res.success) {
                await uiStatus.update(true, true, res.audioDetected, isMarqueeEnabled);
            } else {
                await uiStatus.update(false, isCurrentEnabled);
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
            const editBtn = document.getElementById("editThemeBtn");

            if (changes.customThemeEnabled) {
                const isCustom = changes.customThemeEnabled.newValue;
                if (editBtn) {
                    isCustom ? editBtn.classList.remove("hidden") : editBtn.classList.add("hidden");
                }
            }

            if (changes.darkMode) {
                const isDark = changes.darkMode.newValue;
                try { localStorage.setItem("syncDarkMode", isDark ? "true" : "false"); } catch (err) { }
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

    // --- 13. REMOVE NO-TRANSITIONS ---
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.body.classList.remove('no-transitions');
        });
    });
});