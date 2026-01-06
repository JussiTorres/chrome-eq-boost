/**
 * Chrome EQ & Volume Boost
 * Version: 1.3.0
 * Copyright (c) 2025 Jussi Torres
 * Licensed under the MIT License.
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

function updateStatusUI(isActive, isToggleOn, isAudioDetected = false) {
    const statusMsg = document.getElementById("statusMessage");
    const container = document.getElementById("statusContainer");
    const sliders = document.querySelectorAll('input[type="range"]');
    const toggle = document.getElementById("toggleEnabled");
    const toggleLabel = document.querySelector(".toggle-label");
    const resetBtn = document.getElementById("resetButton");

    statusMsg.className = 'status-message';
    if (toggleLabel) toggleLabel.className = 'toggle-label';

    if (toggle) toggle.checked = isToggleOn;

    if (!isToggleOn) {
        const msg = currentMessages.status_disabled ? currentMessages.status_disabled.message : "Extension disabled.";
        statusMsg.textContent = msg;
        statusMsg.classList.add('text-disabled');
        statusMsg.setAttribute("data-i18n", "status_disabled");

        if (toggleLabel) {
            toggleLabel.textContent = msg.replace(/\.$/, "");
            toggleLabel.classList.add('label-disabled');
            toggleLabel.setAttribute("data-i18n", "status_disabled");
        }
        sliders.forEach(s => s.disabled = true);
        if (resetBtn) resetBtn.disabled = true;
        return;
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
        if (isAudioDetected) {
            statusMsg.textContent = currentMessages.status_active ? currentMessages.status_active.message : "Equalizer Active";
            statusMsg.classList.add('text-active');
            statusMsg.setAttribute("data-i18n", "status_active");
        } else {
            statusMsg.textContent = currentMessages.status_waiting ? currentMessages.status_waiting.message : "Waiting for audio...";
            statusMsg.classList.add('text-waiting');
            statusMsg.setAttribute("data-i18n", "status_waiting");
        }
    } else {
        statusMsg.textContent = currentMessages.status_loading ? currentMessages.status_loading.message : "Initializing...";
        statusMsg.classList.add('text-loading');
        statusMsg.setAttribute("data-i18n", "status_loading");
    }
}

// ==========================================
// 4. AUDIO ENGINE CONTROL
// ==========================================

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    let attempts = 0;
    pollingInterval = setInterval(() => {
        attempts++;
        chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, res => {
            if (!chrome.runtime.lastError && res && res.success) {
                updateStatusUI(true, true, res.audioDetected);
                if (attempts < 3) syncAudioEngine();
            } else if (attempts > 2) {
                console.log("Audio dead. Shutting down...");
                clearInterval(pollingInterval);
                chrome.storage.local.set({ isEnabled: false, capturingTabId: null });
                const el = document.getElementById("toggleEnabled");
                if (el) el.checked = false;
                updateStatusUI(false, false);
            }
        });
    }, 1000);
}

async function startCaptureProcess() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        updateStatusUI(false, true);
        startPolling();
        chrome.runtime.sendMessage({ type: "START_CAPTURE", tabId: tab.id });
    }
}

// ==========================================
// 5. MAIN ENTRY POINT (Initialize UI)
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
        darkModeToggle = document.getElementById("darkModeToggle");

    // Unified Storage Fetch
    const storage = await chrome.storage.local.get([
        "darkMode", "preferredLocale", "volumeLevel",
        "bassLevel", "midLevel", "trebleLevel",
        "isEnabled", "capturingTabId"
    ]);

    // First Run: Auto-Language Detection
    let currentLocale = storage.preferredLocale;
    if (currentLocale === undefined) {
        const supported = ["en", "es", "pt_BR", "de", "fr", "it", "pl", "ru", "uk", "tr", "id", "ja", "ko", "hi", "zh_CN", "zh_TW"];
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

    // Theme & Language Listeners
    if (darkModeToggle) {
        darkModeToggle.addEventListener("change", (e) => {
            const enabled = e.target.checked;
            document.body.classList.toggle("dark-mode", enabled);
            chrome.storage.local.set({ darkMode: enabled });
        });
    }

    if (langSelect) {
        langSelect.addEventListener("change", async (t) => {
            const newLang = t.target.value;
            chrome.storage.local.set({ preferredLocale: newLang });
            await loadLanguage(newLang);
            if (!container.classList.contains("conflict")) {
                toggle.checked ? chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" },
                    res => updateStatusUI(res?.success, true, res?.audioDetected)) : updateStatusUI(false, false);
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

    function forceTakeover() {
        container.classList.remove("conflict");
        takeOverBtn.classList.add("hidden");
        document.querySelectorAll('input[type="range"]').forEach(e => e.disabled = false);
        document.getElementById("resetButton").disabled = false;
        send({ type: "STOP_CAPTURE" });
        setTimeout(() => {
            toggle.checked = true;
            chrome.storage.local.set({ isEnabled: true });
            startCaptureProcess();
        }, 200);
    }

    if (isEnabled && capturingTabId && capturingTabId !== activeTab.id) {
        chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, res => {
            if (!chrome.runtime.lastError && res && res.success) {
                container.classList.add("conflict");
                takeOverBtn.classList.remove("hidden");
                toggle.checked = false;
                updateStatusUI(true, false);
                takeOverBtn.onclick = forceTakeover;
            } else {
                chrome.storage.local.set({ isEnabled: false, capturingTabId: null });
                updateStatusUI(false, false);
            }
        });
    } else if (isEnabled) {
        updateStatusUI(false, true);
        chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, res => {
            if (!chrome.runtime.lastError && res && res.success) {
                updateStatusUI(true, true, res.audioDetected);
                startPolling();
            } else {
                chrome.storage.local.set({ isEnabled: false, capturingTabId: null });
                toggle.checked = false;
                updateStatusUI(false, false);
            }
        });
    } else {
        updateStatusUI(false, false);
    }

    // Main Toggle Listener
    toggle.addEventListener("change", () => {
        if (toggle.checked) {
            if (container.classList.contains("conflict")) forceTakeover();
            else {
                chrome.storage.local.set({ isEnabled: true });
                send({ type: "STOP_CAPTURE" });
                setTimeout(() => startCaptureProcess(), 100);
            }
        } else {
            if (pollingInterval) clearInterval(pollingInterval);
            container.classList.remove("conflict");
            takeOverBtn.classList.add("hidden");
            send({ type: "STOP_CAPTURE" });
            send({ type: "TOGGLE_ENABLED", value: false });
            updateStatusUI(false, false);
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

    // Storage Sync Listener
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.isEnabled) {
            const val = changes.isEnabled.newValue;
            if (toggle) toggle.checked = val;
            updateStatusUI(val, val);
            if (!val && pollingInterval) clearInterval(pollingInterval);
        }
    });
});