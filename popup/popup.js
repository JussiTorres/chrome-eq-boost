/**
 * popup/popup.js
 */
import { SLIDER_CONFIGS } from './constants.js';
import { storage } from './storageHelpers.js';
import { i18n } from './i18n.js';
import { themeEngine } from './themeEngine.js';
import { uiStatus } from './uiStatus.js';
import { themeEditor } from './themeEditor.js';

let isMarqueeEnabled = true;
let copyTimeout = null;

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Initialize Data
    const data = await storage.getAll();
    const currentLocale = i18n.detectLocale(data.preferredLocale);
    const editThemeBtn = document.getElementById("editThemeBtn"); // Reference established for startup check
    await i18n.load(currentLocale);

    // 2. Initialize Visuals (Theme Engine + Editor)
    themeEngine.init(data);
    await themeEditor.init();

    // Logic for the edit pencil visibility on initial boot
    if (data.customThemeEnabled && editThemeBtn) {
        editThemeBtn.classList.remove("hidden");
    }

    isMarqueeEnabled = data.marqueeEnabled ?? true;

    // 3. Initialize Sliders (Audio Logic)
    SLIDER_CONFIGS.forEach(config => {
        const savedVal = data[config.storageKey] ?? config.default;
        const slider = document.getElementById(config.id);
        const display = document.getElementById(config.display);

        if (slider) {
            slider.value = savedVal;
            updateDisplay(display, savedVal, config);

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
    const darkModeToggle = document.getElementById("darkModeToggle");

    // --- Settings & About Navigation ---
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

    // --- Language Selector ---
    if (langSelect) {
        langSelect.value = currentLocale;
        langSelect.addEventListener("change", async (t) => {
            const newLang = t.target.value;
            storage.set("preferredLocale", newLang);

            if (statusMsg) {
                statusMsg.removeAttribute("data-ui-type");
                statusMsg.removeAttribute("data-last-title");
            }
            await i18n.load(newLang);
            refreshUI();
        });
    }

    // --- Smart Dark Mode Toggle ---
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

    // --- Marquee Toggle ---
    if (marqueeToggle) {
        marqueeToggle.checked = isMarqueeEnabled;
        marqueeToggle.addEventListener("change", (e) => {
            isMarqueeEnabled = e.target.checked;
            storage.set("marqueeEnabled", isMarqueeEnabled);
            if (statusMsg) statusMsg.removeAttribute("data-last-title");
            refreshUI();
        });
    }

    // --- Reset Button ---
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

    // --- Double-Click to Copy ---
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

    // --- Main Toggle Logic (Cleaned for Theme Integrity) ---
    toggle.addEventListener("change", async () => {
        if (toggle.checked) {
            if (container.classList.contains("conflict")) {
                await forceTakeover();
            } else {
                storage.set("isEnabled", true);
                startCapture();
            }
        } else {
            handleManualDisable();
        }
        // DELETED: Manual pencil visibility management here.
        // The visibility is now handled by themeEditor.js and storage.onChanged.
    });

    // --- Conflict Detection & Startup Logic ---
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
        chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, async res => {
            if (!chrome.runtime.lastError && res && res.success) {
                await uiStatus.update(true, true, res.audioDetected, isMarqueeEnabled);
                startWatchdog();
            } else {
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
            if (chrome.runtime.lastError) { }
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
            const editThemeBtn = document.getElementById("editThemeBtn");

            // Sync Pencil Visibility on any theme-related change
            if (changes.customThemeEnabled) {
                const isCustom = changes.customThemeEnabled.newValue;
                if (editThemeBtn) {
                    isCustom ? editThemeBtn.classList.remove("hidden") : editThemeBtn.classList.add("hidden");
                }
            }

            // Global Theme Sync logic
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
});