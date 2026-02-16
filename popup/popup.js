import { SLIDER_CONFIGS } from './constants.js';
import { storage } from './storageHelpers.js';
import { i18n } from './i18n.js';
import { themeEngine } from './themeEngine.js';
import { uiStatus } from './uiStatus.js';

let isMarqueeEnabled = true;
let copyTimeout = null;

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Initialize Data
    const data = await storage.getAll();
    const currentLocale = i18n.detectLocale(data.preferredLocale);
    await i18n.load(currentLocale);

    // 2. Initialize Visuals
    themeEngine.init(data.darkMode);
    themeEngine.setupListener();
    isMarqueeEnabled = data.marqueeEnabled ?? true;

    // Pass refreshUI as the callback so the song title stays visible
    themeEngine.setupListener(() => {
        refreshUI();
    });

    // 3. Initialize Sliders
    SLIDER_CONFIGS.forEach(config => {
        const savedVal = data[config.storageKey] ?? config.default;
        const slider = document.getElementById(config.id);
        const display = document.getElementById(config.display);

        if (slider) {
            slider.value = savedVal;
            updateDisplay(display, savedVal, config);

            // Added lastError check here
            const safeSend = (message, callback = () => { }) => {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) { return; }
                    callback(response);
                });
            };

            slider.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value);
                updateDisplay(display, val, config);
                safeSend({ type: config.type, value: val });
                storage.set(config.storageKey, val);
            });
        }
    });

    // 4. UI References
    const toggle = document.getElementById("toggleEnabled");
    const container = document.getElementById("statusContainer");
    const statusMsg = document.getElementById("statusMessage");
    const takeOverBtn = document.getElementById("takeOverBtn");
    const marqueeToggle = document.getElementById("marqueeToggle");
    const langSelect = document.getElementById("languageSelect");
    const resetBtn = document.getElementById("resetButton");

    // --- RESTORED: Settings & About Navigation ---
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsPanel = document.getElementById("settingsPanel");
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");
    const openAboutBtn = document.getElementById("openAboutBtn");
    const closeAboutBtn = document.getElementById("closeAboutBtn");
    const aboutPanel = document.getElementById("aboutPanel");

    settingsBtn.addEventListener("click", () => { settingsPanel.classList.remove("hidden"); });
    closeSettingsBtn.addEventListener("click", () => settingsPanel.classList.add("hidden"));
    openAboutBtn.addEventListener("click", () => { settingsPanel.classList.add("hidden"); aboutPanel.classList.remove("hidden"); });
    closeAboutBtn.addEventListener("click", () => { aboutPanel.classList.add("hidden"); settingsPanel.classList.remove("hidden"); });

    // Language Selector
    if (langSelect) {
        langSelect.value = currentLocale;
        langSelect.addEventListener("change", async (t) => {
            const newLang = t.target.value;
            storage.set("preferredLocale", newLang);

            // 1. Force a UI State Reset
            if (statusMsg) {
                statusMsg.removeAttribute("data-ui-type");
                statusMsg.removeAttribute("data-last-title");
            }

            // 2. Load the new language
            await i18n.load(newLang);

            // 3. Re-render the UI with the new strings
            refreshUI();
        });
    }

    // --- RESTORED: Marquee Toggle ---
    if (marqueeToggle) {
        marqueeToggle.checked = isMarqueeEnabled;
        marqueeToggle.addEventListener("change", (e) => {
            isMarqueeEnabled = e.target.checked;
            storage.set("marqueeEnabled", isMarqueeEnabled);
            if (statusMsg) statusMsg.removeAttribute("data-last-title");
            refreshUI();
        });
    }

    // --- RESTORED: Reset Button ---
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            SLIDER_CONFIGS.forEach(config => {
                const el = document.getElementById(config.id);
                if (el) {
                    el.value = config.default;
                    updateDisplay(document.getElementById(config.display), config.default, config);
                    chrome.runtime.sendMessage({ type: config.type, value: config.default }, () => {
                        if (chrome.runtime.lastError) { /* ignore */ }
                    });
                    storage.set(config.storageKey, config.default);
                }
            });
        });
    }

    // --- RESTORED: Double-Click to Copy ---
    if (statusMsg) {
        statusMsg.addEventListener("dblclick", async () => {
            const titleToCopy = statusMsg.getAttribute("data-last-title");
            if (titleToCopy && !statusMsg.classList.contains('text-waiting')) {
                try {
                    await navigator.clipboard.writeText(titleToCopy);
                    if (copyTimeout) clearTimeout(copyTimeout);
                    statusMsg.style.transition = "color 0.2s";
                    statusMsg.style.color = "var(--success)";
                    copyTimeout = setTimeout(() => { statusMsg.style.color = ""; }, 1400);
                } catch (err) {
                    console.error("Failed to copy text:", err);
                }
            }
        });
    }

    // --- RESTORED: Main Toggle Logic ---
    toggle.addEventListener("change", async () => {
        if (toggle.checked) {
            if (container.classList.contains("conflict")) {
                await forceTakeover();
            } else {
                storage.set("isEnabled", true);
                chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }, () => {
                    if (chrome.runtime.lastError) { /* ignore */ }
                    setTimeout(() => startCapture(), 100);
                });
            }
        } else {
            handleManualDisable();
        }
    });

    // --- RESTORED: Conflict Detection & Startup Logic ---
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isEnabled = data.isEnabled === true;
    const capturingTabId = data.capturingTabId;

    if (isEnabled && capturingTabId && capturingTabId !== activeTab.id) {
        chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, async res => {
            if (!chrome.runtime.lastError && res && res.success) {
                container.classList.add("conflict");
                takeOverBtn.classList.remove("hidden");
                takeOverBtn.textContent = i18n.t("button_takeover") || "Use on this tab";
                toggle.checked = false;
                await uiStatus.update(true, false);
                takeOverBtn.onclick = forceTakeover;
            } else {
                storage.set("isEnabled", false);
                await uiStatus.update(false, false);
            }
        });
    } else if (isEnabled) {
        // DO NOT call uiStatus.update(false, true) here anymore.
        // Instead, ping first to see if we should actually show the "ON" state.
        chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, async res => {
            if (!chrome.runtime.lastError && res && res.success) {
                // Engine is actually running! Show the tab name and turn toggle ON.
                await uiStatus.update(true, true, res.audioDetected, isMarqueeEnabled);
                startWatchdog();
            } else {
                // Engine is NOT running. Clean up storage and show the "OFF" state.
                storage.set("isEnabled", false);
                storage.set("capturingTabId", null);
                await uiStatus.update(false, false);
            }
        });
    } else {
        await uiStatus.update(false, false);
    }

    // --- Helpers ---

    function handleManualDisable() {
        uiStatus.stopPolling();
        container.classList.remove("conflict");
        takeOverBtn.classList.add("hidden");
        chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }, () => { if (chrome.runtime.lastError) { } });
        chrome.runtime.sendMessage({ type: "TOGGLE_ENABLED", value: false }, () => { if (chrome.runtime.lastError) { } });
        uiStatus.update(false, false);
        storage.set("isEnabled", false);
    }

    async function forceTakeover() {
        container.classList.remove("conflict");
        takeOverBtn.classList.add("hidden");
        document.querySelectorAll('input[type="range"]').forEach(e => e.disabled = false);
        if (resetBtn) resetBtn.disabled = false;

        chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }, () => {
            if (chrome.runtime.lastError) { }
            setTimeout(async () => {
                toggle.checked = true;
                storage.set("isEnabled", true);
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
            chrome.runtime.sendMessage({ type: "START_CAPTURE", tabId: tab.id });
        }
    }

    function refreshUI() {
        chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, async res => {
            if (chrome.runtime.lastError) { } // Suppress console error
            const isEnabled = toggle.checked;
            if (isEnabled && res && res.success) {
                await uiStatus.update(true, true, res.audioDetected, isMarqueeEnabled);
            } else {
                await uiStatus.update(false, isEnabled);
            }
        });
    }

    chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area === "local") {
            // Handle Global Enable/Disable
            if (changes.isEnabled) {
                const isNowEnabled = changes.isEnabled.newValue;
                if (toggle) toggle.checked = isNowEnabled;
                if (!isNowEnabled) {
                    uiStatus.stopPolling();
                    await uiStatus.update(false, false);
                }
            }

            // ADD THIS: Handle Global Dark Mode Sync
            if (changes.darkMode) {
                themeEngine.apply(changes.darkMode.newValue);
            }

            // ADD THIS: Handle Global Marquee Sync
            if (changes.marqueeEnabled) {
                isMarqueeEnabled = changes.marqueeEnabled.newValue;
                refreshUI();
            }
        }
    });
});