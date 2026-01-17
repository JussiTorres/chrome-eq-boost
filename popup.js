/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

// ==========================================
// 1. CONFIGURATION & GLOBAL STATE
// ==========================================

const sliderConfigs = [{
    id: "volumeSlider",
    display: "volumeValue",
    type: "UPDATE_GAIN",
    storageKey: "volumeLevel",
    default: 1,
    multiplier: 100,
    suffix: "%"
}, {
    id: "bassSlider",
    display: "bassValue",
    type: "UPDATE_BASS",
    storageKey: "bassLevel",
    default: 0,
    multiplier: 1,
    suffix: " dB"
}, {
    id: "midSlider",
    display: "midValue",
    type: "UPDATE_MID",
    storageKey: "midLevel",
    default: 0,
    multiplier: 1,
    suffix: " dB"
}, {
    id: "trebleSlider",
    display: "trebleValue",
    type: "UPDATE_TREBLE",
    storageKey: "trebleLevel",
    default: 0,
    multiplier: 1,
    suffix: " dB"
}];

let currentMessages = {};
let pollingInterval = null;
let copyTimeout = null;

// Tracks the last time we heard audio to create a visual buffer
let lastAudioTime = 0;
// Tracks if Marquee effect is enabled (Default: true)
let isMarqueeEnabled = true;

// ==========================================
// 2. HELPER FUNCTIONS (i18n & Communication)
// ==========================================

async function loadLanguage(locale) {
    try {
        const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
        const response = await fetch(url);
        currentMessages = await response.json();
        applyTranslations();
    } catch (e) {
        console.error("Error loading language:", e);
    }
}

function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (currentMessages[key]) {
            el.textContent = currentMessages[key].message;
        }
    });
}

function send(message) {
    chrome.runtime.sendMessage(message).catch(() => { });
}

function updateDisplay(id, displayId, value, multiplier, suffix) {
    const display = document.getElementById(displayId);
    const val = parseFloat(value) || 0;
    if (display) {
        display.textContent = multiplier === 100 ?
            `${Math.round(val * multiplier)}%` :
            `${val.toFixed(1)}${suffix}`;
    }
}

function syncAudioEngine() {
    sliderConfigs.forEach(config => {
        const el = document.getElementById(config.id);
        if (el && !el.disabled) {
            send({ type: config.type, value: parseFloat(el.value) });
        }
    });
}

// ==========================================
// 3. UI STATUS MANAGEMENT
// ==========================================

async function updateStatusUI(isActive, isToggleOn, isAudioDetected = false) {
    const statusMsg = document.getElementById("statusMessage");
    const container = document.getElementById("statusContainer");
    const takeOverBtn = document.getElementById("takeOverBtn");
    const sliders = document.querySelectorAll('input[type="range"]');
    const toggle = document.getElementById("toggleEnabled");
    const toggleLabel = document.querySelector(".toggle-label");
    const resetBtn = document.getElementById("resetButton");

    // FIX: Do NOT wipe className here. It kills the animation loop every 500ms.
    // statusMsg.className = 'status-message';  <-- THIS WAS THE BUG

    // Instead, strictly manage the color classes
    statusMsg.classList.remove('text-disabled', 'text-waiting', 'text-loading', 'text-active', 'text-conflict');

    if (toggleLabel) toggleLabel.className = 'toggle-label';

    if (toggle) toggle.checked = isToggleOn;

    if (!isToggleOn) {
        // --- CASE: EXTENSION DISABLED ---
        const msg = currentMessages.status_disabled ? currentMessages.status_disabled.message : "Extension disabled.";
        statusMsg.textContent = msg;
        statusMsg.classList.add('text-disabled');

        // STOP ANIMATION: Explicitly remove marquee class
        statusMsg.classList.remove('marquee-text');

        // Remove fade mask
        if (container) container.classList.remove('mask-active');

        statusMsg.style.animationDelay = "";
        statusMsg.setAttribute("data-i18n", "status_disabled");

        statusMsg.removeAttribute("data-last-title");

        if (takeOverBtn) takeOverBtn.classList.add('hidden');

        if (toggleLabel) {
            toggleLabel.textContent = msg.replace(/\.$/, "");
            toggleLabel.classList.add('label-disabled');
            toggleLabel.setAttribute("data-i18n", "status_disabled");
        }
        sliders.forEach(s => s.disabled = true);
        if (resetBtn) resetBtn.disabled = true;
        return;
    } else {
        if (takeOverBtn) takeOverBtn.classList.add('hidden');
    }

    if (!container.classList.contains("conflict")) {
        sliders.forEach(s => s.disabled = false);
        if (resetBtn) resetBtn.disabled = false;
    }

    if (toggleLabel) {
        toggleLabel.textContent = currentMessages.toggle_label ? currentMessages.toggle_label.message : "Extension Enabled";
        toggleLabel.classList.add('label-enabled');
        toggleLabel.setAttribute("data-i18n", "toggle_label");
    }

    if (isActive) {
        // --- VISUAL BUFFER LOGIC ---
        if (isAudioDetected) {
            lastAudioTime = Date.now();
        }

        const showActiveState = isAudioDetected || (Date.now() - lastAudioTime < 2000);

        if (showActiveState) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.title) {

                    // --- 1. ENFORCE UI STATE (Self-Healing) ---
                    if (isMarqueeEnabled) {
                        // START ANIMATION: Adding it if it's already there does NOTHING (Safe!)
                        statusMsg.classList.add('marquee-text');
                        container.classList.add('mask-active');
                    } else {
                        statusMsg.classList.remove('marquee-text');
                        container.classList.remove('mask-active');
                        statusMsg.style.animationDelay = "";
                    }

                    // --- 2. UPDATE CONTENT (Only if changed) ---
                    const currentTitle = statusMsg.getAttribute("data-last-title");

                    const needsRefresh = currentTitle !== tab.title || !statusMsg.hasChildNodes();

                    if (needsRefresh) {
                        const iconUrl = tab.favIconUrl || '';

                        if (isMarqueeEnabled) {
                            // Marquee Layout (4x items)
                            const item = `
                                <span class="marquee-content">
                                    <img src="${iconUrl}" class="separator-icon" alt="">
                                    <span>${tab.title}</span>
                                </span>
                            `;
                            statusMsg.innerHTML = item.repeat(4);
                        } else {
                            // Static Layout (1x item, centered)
                            const item = `
                                <span style="display: inline-flex; align-items: center; justify-content: center; max-width: 100%;">
                                    <img src="${iconUrl}" class="separator-icon" alt="" style="margin-right: 6px;">
                                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">${tab.title}</span>
                                </span>
                            `;
                            statusMsg.innerHTML = item;
                        }

                        statusMsg.setAttribute("data-last-title", tab.title);
                    }
                } else {
                    // --- PERSISTENCE CHECK ---
                    const hasHistory = statusMsg.getAttribute("data-last-title");
                    if (!hasHistory) {
                        statusMsg.textContent = currentMessages.status_active ? currentMessages.status_active.message : "Equalizer Active";
                        statusMsg.classList.remove('marquee-text');
                        container.classList.remove('mask-active');
                        statusMsg.style.animationDelay = "";
                    }
                }
            } catch (e) {
                const hasHistory = statusMsg.getAttribute("data-last-title");
                if (!hasHistory) {
                    statusMsg.textContent = currentMessages.status_active ? currentMessages.status_active.message : "Equalizer Active";
                    statusMsg.classList.remove('marquee-text');
                    container.classList.remove('mask-active');
                    statusMsg.style.animationDelay = "";
                }
            }
            statusMsg.removeAttribute("data-i18n");
        } else {
            // --- CASE: PAUSED / SILENCE (After 2 seconds) ---
            statusMsg.textContent = currentMessages.status_waiting ? currentMessages.status_waiting.message : "Waiting for audio...";

            statusMsg.classList.add('text-waiting');
            statusMsg.classList.remove('marquee-text'); // STOP ANIMATION

            container.classList.remove('mask-active');

            statusMsg.style.animationDelay = "";
            statusMsg.setAttribute("data-i18n", "status_waiting");

            statusMsg.removeAttribute("data-last-title");
        }

    } else {
        statusMsg.textContent = currentMessages.status_loading ? currentMessages.status_loading.message : "Initializing...";
        statusMsg.classList.add('text-loading');
        statusMsg.classList.remove('marquee-text'); // STOP ANIMATION

        container.classList.remove('mask-active');

        statusMsg.style.animationDelay = "";
        statusMsg.setAttribute("data-i18n", "status_loading");

        statusMsg.removeAttribute("data-last-title");
    }
}

// ==========================================
// 4. AUDIO ENGINE CONTROL (WATCHDOG LOGIC)
// ==========================================

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

function startPolling() {
    stopPolling();
    let attempts = 0;

    // FIX: Set to 0 so we don't assume audio is playing on startup.
    // This prevents the marquee from showing briefly if silence is detected.
    lastAudioTime = 0;

    pollingInterval = setInterval(() => {
        attempts++;

        if (attempts > 60) {
            console.log("Audio engine unresponsive. Shutting down...");
            stopPolling();
            chrome.storage.local.set({ isEnabled: false, capturingTabId: null });
            const el = document.getElementById("toggleEnabled");
            if (el) el.checked = false;
            updateStatusUI(false, false);
            return;
        }

        chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, async res => {
            if (!pollingInterval) return;

            const storage = await chrome.storage.local.get("isEnabled");
            if (!pollingInterval) return;

            if (storage.isEnabled === false) {
                stopPolling();
                const toggle = document.getElementById("toggleEnabled");
                if (toggle) toggle.checked = false;
                updateStatusUI(false, false);
                return;
            }

            if (!chrome.runtime.lastError && res && res.success) {
                attempts = 0;
                await updateStatusUI(true, true, res.audioDetected);
            } else {
                if (attempts < 4) return; // Grace period active

                stopPolling();
                chrome.storage.local.set({ isEnabled: false, capturingTabId: null });
                const toggle = document.getElementById("toggleEnabled");
                if (toggle) toggle.checked = false;
                updateStatusUI(false, false);
            }
        });
    }, 500);
}

// Helper to force an immediate UI update
function refreshStatus() {
    chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, (res) => {
        if (!chrome.runtime.lastError && res && res.success) {
            updateStatusUI(true, true, res.audioDetected);
        }
    });
}

async function startCaptureProcess() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        await updateStatusUI(false, true);
        startPolling();
        // --- FIX: ADDED .catch() TO SILENCE THE ERROR ---
        chrome.runtime.sendMessage({ type: "START_CAPTURE", tabId: tab.id }).catch(() => { });
    }
}

// ==========================================
// 5. MAIN ENTRY POINT
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    // UI Element References
    const toggle = document.getElementById("toggleEnabled"),
        container = document.getElementById("statusContainer"),
        statusMsg = document.getElementById("statusMessage"),
        takeOverBtn = document.getElementById("takeOverBtn"),
        settingsBtn = document.getElementById("settingsBtn"),
        settingsPanel = document.getElementById("settingsPanel"),
        closeSettingsBtn = document.getElementById("closeSettingsBtn"),
        openAboutBtn = document.getElementById("openAboutBtn"),
        closeAboutBtn = document.getElementById("closeAboutBtn"),
        aboutPanel = document.getElementById("aboutPanel"),
        langSelect = document.getElementById("languageSelect"),
        darkModeToggle = document.getElementById("darkModeToggle"),
        marqueeToggle = document.getElementById("marqueeToggle");

    // Unified Storage Fetch
    const storage = await chrome.storage.local.get([
        "darkMode", "preferredLocale", "volumeLevel",
        "bassLevel", "midLevel", "trebleLevel",
        "isEnabled", "capturingTabId", "marqueeEnabled"
    ]);

    // First Run: Auto-Language Detection
    let currentLocale = storage.preferredLocale;
    if (currentLocale === undefined) {
        const supported = [
            "en", "es", "pt_BR", "de", "fr", "it", "pl", "ru", "uk", "tr",
            "id", "ja", "ko", "hi", "zh_CN", "zh_TW",
            "th", "vi", "fil", "km", "lt", "nl"
        ];
        const uiLang = chrome.i18n.getUILanguage().replace('-', '_');
        currentLocale = supported.includes(uiLang) ? uiLang : supported.find(l => l === uiLang.split('_')[0]) || "en";
        chrome.storage.local.set({ preferredLocale: currentLocale });
    }

    // First Run: Default to Light Mode
    let isDark = storage.darkMode;
    if (isDark === undefined) {
        isDark = false;
        chrome.storage.local.set({ darkMode: isDark });
    }

    // Load Marquee Setting (Default: true)
    isMarqueeEnabled = storage.marqueeEnabled ?? true;
    if (marqueeToggle) marqueeToggle.checked = isMarqueeEnabled;

    // Apply Initial Visual State
    document.body.classList.toggle("dark-mode", isDark);
    if (darkModeToggle) darkModeToggle.checked = isDark;
    if (langSelect) langSelect.value = currentLocale;
    await loadLanguage(currentLocale);

    // Initialize Sliders
    sliderConfigs.forEach(config => {
        const savedVal = storage[config.storageKey] ?? config.default;
        const slider = document.getElementById(config.id);
        if (slider) {
            slider.value = savedVal;
            updateDisplay(config.id, config.display, savedVal, config.multiplier, config.suffix);
            slider.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value);
                updateDisplay(config.id, config.display, val, config.multiplier, config.suffix);
                send({ type: config.type, value: val });
                chrome.storage.local.set({ [config.storageKey]: val });
            });
        }
    });

    // Theme, Language & Marquee Listeners
    if (darkModeToggle) {
        darkModeToggle.addEventListener("change", (e) => {
            const enabled = e.target.checked;
            document.body.classList.toggle("dark-mode", enabled);
            chrome.storage.local.set({ darkMode: enabled });
        });
    }

    if (marqueeToggle) {
        marqueeToggle.addEventListener("change", (e) => {
            isMarqueeEnabled = e.target.checked;
            chrome.storage.local.set({ marqueeEnabled: isMarqueeEnabled });

            // Force status message update by clearing memory
            if (statusMsg) statusMsg.removeAttribute("data-last-title");

            // Trigger instant refresh so the user sees the change immediately
            refreshStatus();
        });
    }

    if (langSelect) {
        langSelect.addEventListener("change", async (t) => {
            const newLang = t.target.value;
            chrome.storage.local.set({ preferredLocale: newLang });
            await loadLanguage(newLang);
            if (!container.classList.contains("conflict")) {
                toggle.checked ? chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" },
                    async res => await updateStatusUI(res?.success, true, res?.audioDetected)) : await updateStatusUI(false, false);
            }
        });
    }

    // Navigation Listeners
    settingsBtn.addEventListener("click", () => { settingsPanel.classList.remove("hidden"); window.scrollTo(0, 0); });
    closeSettingsBtn.addEventListener("click", () => settingsPanel.classList.add("hidden"));
    openAboutBtn.addEventListener("click", () => { settingsPanel.classList.add("hidden"); aboutPanel.classList.remove("hidden"); window.scrollTo(0, 0); });
    closeAboutBtn.addEventListener("click", () => { aboutPanel.classList.add("hidden"); settingsPanel.classList.remove("hidden"); window.scrollTo(0, 0); });

    // Conflict & Ghost Buster Checks
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isEnabled = storage.isEnabled === true;
    const capturingTabId = storage.capturingTabId;

    async function forceTakeover() {
        container.classList.remove("conflict");
        takeOverBtn.classList.add("hidden");
        document.querySelectorAll('input[type="range"]').forEach(e => e.disabled = false);
        document.getElementById("resetButton").disabled = false;
        send({ type: "STOP_CAPTURE" });
        setTimeout(async () => {
            toggle.checked = true;
            chrome.storage.local.set({ isEnabled: true });
            await startCaptureProcess();
        }, 200);
    }

    if (isEnabled && capturingTabId && capturingTabId !== activeTab.id) {
        chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, async res => {
            if (!chrome.runtime.lastError && res && res.success) {
                container.classList.add("conflict");
                takeOverBtn.classList.remove("hidden");
                takeOverBtn.textContent = "Use here";
                toggle.checked = false;
                await updateStatusUI(true, false);
                takeOverBtn.onclick = forceTakeover;
            } else {
                chrome.storage.local.set({ isEnabled: false, capturingTabId: null });
                await updateStatusUI(false, false);
            }
        });
    } else if (isEnabled) {
        await updateStatusUI(false, true);
        chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, async res => {
            if (!chrome.runtime.lastError && res && res.success) {
                await updateStatusUI(true, true, res.audioDetected);
                startPolling();
            } else {
                chrome.storage.local.set({ isEnabled: false, capturingTabId: null });
                toggle.checked = false;
                await updateStatusUI(false, false);
            }
        });
    } else {
        await updateStatusUI(false, false);
    }

    // Main Toggle Listener
    toggle.addEventListener("change", async () => {
        if (toggle.checked) {
            if (container.classList.contains("conflict")) await forceTakeover();
            else {
                chrome.storage.local.set({ isEnabled: true });
                send({ type: "STOP_CAPTURE" });
                setTimeout(async () => await startCaptureProcess(), 100);
            }
        } else {
            if (pollingInterval) clearInterval(pollingInterval);
            container.classList.remove("conflict");
            takeOverBtn.classList.add("hidden");
            send({ type: "STOP_CAPTURE" });
            send({ type: "TOGGLE_ENABLED", value: false });
            await updateStatusUI(false, false);
            chrome.storage.local.set({ isEnabled: false });
        }
    });

    // Reset Listener
    document.getElementById("resetButton").addEventListener("click", () => {
        sliderConfigs.forEach(config => {
            const el = document.getElementById(config.id);
            if (el) {
                el.value = config.default;
                updateDisplay(config.id, config.display, config.default, config.multiplier, config.suffix);
                send({ type: config.type, value: config.default });
                chrome.storage.local.set({ [config.storageKey]: config.default });
            }
        });
    });

    // DOUBLE-CLICK to Copy Title (Prevents accidental copies)
    statusMsg.addEventListener("dblclick", async () => {
        const titleToCopy = statusMsg.getAttribute("data-last-title");
        if (titleToCopy && !statusMsg.classList.contains('text-waiting')) {
            try {
                await navigator.clipboard.writeText(titleToCopy);
                if (copyTimeout) clearTimeout(copyTimeout);

                // Visual Feedback
                statusMsg.style.transition = "color 0.2s";
                statusMsg.style.color = "var(--success)";

                copyTimeout = setTimeout(() => {
                    statusMsg.style.color = "";
                }, 1400);
            } catch (err) {
                console.error("Failed to copy text:", err);
            }
        }
    });

    // Storage Sync Listener
    chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area === "local" && changes.isEnabled) {
            const val = changes.isEnabled.newValue;
            if (toggle) toggle.checked = val;
            await updateStatusUI(val, val);
            if (!val && pollingInterval) clearInterval(pollingInterval);
        }
    });
});