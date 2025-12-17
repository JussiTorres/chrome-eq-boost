/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

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

let currentMessages = {},
    pollingInterval = null;

async function loadLanguage(e) {
    try {
        const t = chrome.runtime.getURL(`_locales/${e}/messages.json`),
            s = await fetch(t);
        currentMessages = await s.json(), applyTranslations()
    } catch (e) {
        console.error("Error loading language:", e)
    }
}

function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(e => {
        const t = e.getAttribute("data-i18n");
        currentMessages[t] && (e.textContent = currentMessages[t].message)
    })
}

function send(e) {
    chrome.runtime.sendMessage(e).catch(() => {})
}

function updateDisplay(e, t, s, a, l) {
    const n = document.getElementById(t),
        o = parseFloat(s) || 0;
    n && (n.textContent = 100 === a ? `${Math.round(o*a)}%` : `${o.toFixed(1)}${l}`)
}

function syncAudioEngine() {
    sliderConfigs.forEach(e => {
        const t = document.getElementById(e.id);
        t && !t.disabled && send({
            type: e.type,
            value: parseFloat(t.value)
        })
    })
}

// === UPDATED UI LOGIC ===
function updateStatusUI(e, t, s = !1) {
    const statusMsg = document.getElementById("statusMessage"),
        container = document.getElementById("statusContainer"),
        sliders = document.querySelectorAll('input[type="range"]'),
        toggle = document.getElementById("toggleEnabled"),
        toggleLabel = document.querySelector(".toggle-label"),
        resetBtn = document.getElementById("resetButton");

    if (toggle && (toggle.checked = t), !t) {
        // === DISABLED STATE ===
        const msg = currentMessages.status_disabled ? currentMessages.status_disabled.message : "Extension disabled.";
        statusMsg.textContent = msg;
        statusMsg.style.color = "#9ca3af";
        statusMsg.setAttribute("data-i18n", "status_disabled"); // FIX: Update tag

        if (toggleLabel) {
            toggleLabel.textContent = msg.replace(/\.$/, "");
            toggleLabel.style.color = "#6b7280";
            toggleLabel.setAttribute("data-i18n", "status_disabled"); // FIX: Update tag
        }
        sliders.forEach(e => e.disabled = !0);
        if (resetBtn) resetBtn.disabled = !0;
        return;
    }

    // === ENABLED STATE ===
    if (!container.classList.contains("conflict")) {
        sliders.forEach(e => e.disabled = !1);
        if (resetBtn) resetBtn.disabled = !1;
    }

    if (toggleLabel) {
        toggleLabel.textContent = currentMessages.toggle_label ? currentMessages.toggle_label.message : "Extension Enabled";
        toggleLabel.style.color = "#1e3a8a";
        toggleLabel.setAttribute("data-i18n", "toggle_label"); // FIX: Update tag
    }

    if (e) {
        // AUDIO ACTIVE
        if (s) {
            statusMsg.textContent = currentMessages.status_active ? currentMessages.status_active.message : "Equalizer Active";
            statusMsg.style.color = "#22c55e";
            statusMsg.setAttribute("data-i18n", "status_active"); // FIX: Update tag
        } else {
            // WAITING
            const msg = currentMessages.status_waiting ? currentMessages.status_waiting.message : "Waiting for audio...";
            statusMsg.textContent = msg;
            statusMsg.style.color = "#f59e0b";
            statusMsg.setAttribute("data-i18n", "status_waiting"); // FIX: Update tag
        }
    } else {
        // INITIALIZING
        const msg = currentMessages.status_loading ? currentMessages.status_loading.message : "Initializing...";
        statusMsg.textContent = msg;
        statusMsg.style.color = "#3b82f6";
        statusMsg.setAttribute("data-i18n", "status_loading"); // FIX: Update tag
    }
}

function startPolling() {
    pollingInterval && clearInterval(pollingInterval);
    let e = 0;
    pollingInterval = setInterval(() => {
        e++, chrome.runtime.sendMessage({
            type: "TARGET_OFFSCREEN_PING"
        }, t => {
            if (!chrome.runtime.lastError && t && t.success) updateStatusUI(!0, !0, t.audioDetected), e < 3 && syncAudioEngine();
            else if (e > 2) {
                console.log("Audio dead. Shutting down..."), clearInterval(pollingInterval), chrome.storage.local.set({
                    isEnabled: !1,
                    capturingTabId: null
                });
                const el = document.getElementById("toggleEnabled");
                el && (el.checked = !1), updateStatusUI(!1, !1)
            }
        })
    }, 1e3)
}

async function startCaptureProcess() {
    const [e] = await chrome.tabs.query({
        active: !0,
        currentWindow: !0
    });
    e && (updateStatusUI(!1, !0), startPolling(), chrome.runtime.sendMessage({
        type: "START_CAPTURE",
        tabId: e.id
    }))
}

document.addEventListener("DOMContentLoaded", async () => {
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
        langSelect = document.getElementById("languageSelect");

    // Settings Nav
    settingsBtn.addEventListener("click", () => {
        settingsPanel.classList.remove("hidden");
        window.scrollTo(0, 0);
    });
    closeSettingsBtn.addEventListener("click", () => settingsPanel.classList.add("hidden"));

    // About Nav
    openAboutBtn.addEventListener("click", () => {
        settingsPanel.classList.add("hidden");
        aboutPanel.classList.remove("hidden");
        window.scrollTo(0, 0);
    });
    closeAboutBtn.addEventListener("click", () => {
        aboutPanel.classList.add("hidden");
        settingsPanel.classList.remove("hidden");
        window.scrollTo(0, 0);
    });

    const [activeTab] = await chrome.tabs.query({
        active: !0,
        currentWindow: !0
    });
    
    const r = await chrome.storage.local.get(["volumeLevel", "bassLevel", "midLevel", "trebleLevel", "isEnabled", "capturingTabId", "preferredLocale"]),
        c = r.preferredLocale || "en";

    if (langSelect) {
        langSelect.value = c;
        langSelect.addEventListener("change", async t => {
            const s = t.target.value;
            chrome.storage.local.set({ preferredLocale: s });
            await loadLanguage(s);

            if (!container.classList.contains("conflict")) {
                toggle.checked ? chrome.runtime.sendMessage({
                    type: "TARGET_OFFSCREEN_PING"
                }, e => {
                    chrome.runtime.lastError, updateStatusUI(e?.success, !0, e?.audioDetected)
                }) : updateStatusUI(!1, !1)
            }
        });
    }
    await loadLanguage(c);

    const capturingTabId = r.capturingTabId,
        isEnabled = !1 !== r.isEnabled;

    sliderConfigs.forEach(e => {
        const t = r[e.storageKey] ?? e.default,
            s = document.getElementById(e.id);
        s.value = t, updateDisplay(e.id, e.display, t, e.multiplier, e.suffix), s.addEventListener("input", t => {
            const s = parseFloat(t.target.value);
            updateDisplay(e.id, e.display, s, e.multiplier, e.suffix), send({
                type: e.type,
                value: s
            }), chrome.storage.local.set({
                [e.storageKey]: s
            })
        })
    });

    let g = !1;

    // === GHOST BUSTER / CONFLICT LOGIC ===
    function forceTakeover() {
        // RESET UI TO NORMAL
        container.classList.remove("conflict");
        takeOverBtn.classList.add("hidden");
        
        document.querySelectorAll('input[type="range"]').forEach(e => e.disabled = !1);
        document.getElementById("resetButton").disabled = !1;
        
        send({ type: "STOP_CAPTURE" });
        setTimeout(() => {
            toggle.checked = !0;
            chrome.storage.local.set({ isEnabled: !0 });
            startCaptureProcess();
        }, 200);
    }

    if (isEnabled && capturingTabId && capturingTabId !== activeTab.id) {
        chrome.runtime.sendMessage({
            type: "TARGET_OFFSCREEN_PING"
        }, res => {
            if (!chrome.runtime.lastError && res && res.success) {
                // === CONFLICT DETECTED ===
                g = !0;
                container.classList.add("conflict"); 
                takeOverBtn.classList.remove("hidden"); 
                toggle.checked = !1;

                const label = document.querySelector(".toggle-label");
                if (label) {
                    label.textContent = currentMessages.status_disabled ? currentMessages.status_disabled.message.replace(/\.$/, "") : "Disabled";
                    label.style.color = "#6b7280";
                    label.setAttribute("data-i18n", "status_disabled"); // FIX: Update tag
                }

                // Fuse: Set status text to "Controlling another tab"
                statusMsg.textContent = currentMessages.status_conflict ? currentMessages.status_conflict.message : "Controlling another tab";
                statusMsg.setAttribute("data-i18n", "status_conflict"); // FIX: Update tag

                document.querySelectorAll('input[type="range"]').forEach(e => e.disabled = !0);
                document.getElementById("resetButton").disabled = !0;
                
                takeOverBtn.onclick = forceTakeover;

            } else {
                console.log("Ghost state detected. Cleaning...");
                chrome.storage.local.set({ isEnabled: !1, capturingTabId: null });
                container.classList.remove("conflict");
                takeOverBtn.classList.add("hidden");
                updateStatusUI(!1, !1);
            }
        })
    } else if (isEnabled) {
        updateStatusUI(!1, !0);
        chrome.runtime.sendMessage({
            type: "TARGET_OFFSCREEN_PING"
        }, t => {
            !chrome.runtime.lastError && t && t.success ? (updateStatusUI(!0, !0, t.audioDetected), startPolling()) : (console.log("Dead audio on open. Resetting."), chrome.storage.local.set({
                isEnabled: !1,
                capturingTabId: null
            }), toggle.checked = !1, updateStatusUI(!1, !1))
        })
    } else {
        updateStatusUI(!1, !1);
    }

    toggle && toggle.addEventListener("change", () => {
        if (toggle.checked) {
            if (container.classList.contains("conflict")) {
                forceTakeover();
            } else {
                chrome.storage.local.set({ isEnabled: !0 });
                send({ type: "STOP_CAPTURE" });
                setTimeout(() => startCaptureProcess(), 100);
            }
        } else {
            pollingInterval && clearInterval(pollingInterval);
            
            // Clear conflict state if it existed
            container.classList.remove("conflict");
            takeOverBtn.classList.add("hidden");

            send({ type: "STOP_CAPTURE" });
            send({ type: "TOGGLE_ENABLED", value: !1 });
            updateStatusUI(!1, !1);
            chrome.storage.local.set({ isEnabled: !1 });
        }
    });

    document.getElementById("resetButton").addEventListener("click", () => {
        sliderConfigs.forEach(e => {
            document.getElementById(e.id).value = e.default;
            updateDisplay(e.id, e.display, e.default, e.multiplier, e.suffix);
            send({ type: e.type, value: e.default });
            chrome.storage.local.set({ [e.storageKey]: e.default });
        })
    });

    chrome.storage.onChanged.addListener((t, s) => {
        if ("local" === s && t.isEnabled) {
            const val = t.isEnabled.newValue;
            toggle && (toggle.checked = val, updateStatusUI(val, val));
            !val && pollingInterval && clearInterval(pollingInterval);
        }
    });
});