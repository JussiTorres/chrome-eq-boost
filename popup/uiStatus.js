/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

import { i18n } from './i18n.js';
import { storage } from './storageHelpers.js';

let pollingInterval = null;
let lastAudioTime = 0;

export const uiStatus = {
    touchAudioClock() {
        lastAudioTime = Date.now();
    },

    resetAudioClock() {
        lastAudioTime = 0;
    },

    async update(isActive, isToggleOn, isAudioDetected = false, isMarqueeEnabled = true) {
        const statusMsg = document.getElementById("statusMessage");
        const container = document.getElementById("statusContainer");
        const takeOverBtn = document.getElementById("takeOverBtn");
        const sliders = document.querySelectorAll('input[type="range"]');
        const toggleLabel = document.querySelector(".toggle-label");
        const resetBtn = document.getElementById("resetButton");
        const toggle = document.getElementById("toggleEnabled");

        if (toggle) toggle.checked = isToggleOn;

        if (isActive && isAudioDetected) lastAudioTime = Date.now();

        const showActiveState = isActive && (isAudioDetected || (Date.now() - lastAudioTime < 5000));
        const currentType = statusMsg ? statusMsg.getAttribute("data-ui-type") : null;

        // Guard: Protect optimistic marquee strictly while the extension is active
        if (isToggleOn && currentType === "active" && !isAudioDetected && (Date.now() - lastAudioTime < 2000)) {
            return;
        }

        const nextType = !isToggleOn ? "disabled" : (!isActive ? "loading" : (showActiveState ? "active" : "waiting"));

        if (statusMsg && container && currentType !== nextType) {
            statusMsg.classList.remove('text-disabled', 'text-waiting', 'text-loading', 'text-active', 'text-conflict', 'marquee-text');
            container.classList.remove('mask-active');
            statusMsg.style.animationDelay = "";
            statusMsg.textContent = "";
            statusMsg.setAttribute("data-ui-type", nextType);
        }

        // --- CASE 1: DISABLED ---
        if (!isToggleOn) {
            const msg = i18n.t("status_disabled") || "Extension disabled.";
            if (statusMsg && statusMsg.textContent !== msg) statusMsg.textContent = msg;
            if (statusMsg) {
                statusMsg.classList.add('text-disabled');
                statusMsg.removeAttribute("data-last-title");
            }
            if (takeOverBtn) takeOverBtn.classList.add('hidden');
            if (toggleLabel) {
                toggleLabel.textContent = msg.replace(/\.$/, "");
                toggleLabel.classList.add('label-disabled');
                toggleLabel.classList.remove('label-enabled');
            }
            sliders.forEach(s => s.disabled = true);
            if (resetBtn) resetBtn.disabled = true;
            return;
        }

        // --- CASE 2: ENABLED ---
        if (takeOverBtn) takeOverBtn.classList.add('hidden');
        if (container && !container.classList.contains("conflict")) {
            sliders.forEach(s => s.disabled = false);
            if (resetBtn) resetBtn.disabled = false;
        }
        if (toggleLabel) {
            toggleLabel.textContent = i18n.t("toggle_label") || "Extension Enabled";
            toggleLabel.classList.remove('label-disabled');
            toggleLabel.classList.add('label-enabled');
        }

        if (isActive) {
            if (showActiveState) {
                if (statusMsg) statusMsg.classList.remove('text-waiting');
                if (statusMsg && container) {
                    await this._renderActiveState(statusMsg, container, isMarqueeEnabled);
                }
            } else {
                const waitMsg = i18n.t("status_waiting") || "Waiting for audio...";
                if (statusMsg && statusMsg.textContent !== waitMsg) {
                    statusMsg.textContent = waitMsg;
                    statusMsg.classList.add('text-waiting');
                    statusMsg.classList.remove('marquee-text');
                    if (container) container.classList.remove('mask-active');
                    statusMsg.removeAttribute("data-last-title");
                }
            }
        } else {
            const loadMsg = i18n.t("status_loading") || "Initializing...";
            if (statusMsg && statusMsg.textContent !== loadMsg) {
                statusMsg.textContent = loadMsg;
                statusMsg.classList.add('text-loading');
                statusMsg.removeAttribute("data-last-title");
            }
        }

        // Immediate fallback: ensure statusMsg never stays an empty/invisible node
        if (statusMsg && !statusMsg.textContent.trim() && !statusMsg.hasChildNodes()) {
            statusMsg.textContent = !isToggleOn
                ? (i18n.t("status_disabled") || "Extension disabled.")
                : (i18n.t("status_loading") || "Initializing...");
        }
    },

    async _renderActiveState(statusMsg, container, isMarqueeEnabled) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;

            const currentTitle = statusMsg.getAttribute("data-last-title");
            const titleChanged = currentTitle !== tab.title;
            const isRTL = document.documentElement.dir === "rtl";
            const applyMarquee = isRTL ? false : isMarqueeEnabled;
            const hasMarqueeHTML = !!statusMsg.querySelector('.marquee-content');
            const modeChanged = applyMarquee !== hasMarqueeHTML;

            if (titleChanged || modeChanged || !statusMsg.hasChildNodes()) {

                // --- Anti-Flicker Soft Update ---
                if (titleChanged && !modeChanged && statusMsg.hasChildNodes()) {
                    // 1. Update the text and icons in-place
                    statusMsg.querySelectorAll('span[dir="auto"]').forEach(span => span.textContent = tab.title);
                    statusMsg.querySelectorAll('img.separator-icon').forEach(img => {
                        if (tab.favIconUrl && img.src !== tab.favIconUrl) img.src = tab.favIconUrl;
                    });
                    statusMsg.setAttribute("data-last-title", tab.title);

                    if (applyMarquee) {
                        // 2. PRECISE FIX: Recalculate and apply exact travel distance dynamically.
                        // This guarantees the seamless loop remains pixel-perfect without rebuilding innerHTML.
                        const newHalfWidth = statusMsg.scrollWidth / 2;
                        statusMsg.style.setProperty('--marquee-travel', `-${newHalfWidth}px`);

                        try {
                            localStorage.setItem("cachedTabInfo", JSON.stringify({
                                tabId: tab.id,
                                title: tab.title,
                                iconUrl: tab.favIconUrl || '',
                                travelPx: newHalfWidth
                            }));
                        } catch (e) { }
                    } else {
                        try {
                            localStorage.setItem("cachedTabInfo", JSON.stringify({
                                tabId: tab.id,
                                title: tab.title,
                                iconUrl: tab.favIconUrl || '',
                                travelPx: 0
                            }));
                        } catch (e) { }
                    }

                    // 3. Halt execution to prevent the hard innerHTML rebuild below
                    return;
                }

                if (applyMarquee) {
                    statusMsg.classList.add('marquee-text');
                    container.classList.add('mask-active');
                } else {
                    statusMsg.classList.remove('marquee-text');
                    container.classList.remove('mask-active');
                    statusMsg.style.animationDelay = "";
                }

                const iconUrl = tab.favIconUrl || '';
                const content = applyMarquee
                    ? `<span class="marquee-content"><img src="${iconUrl}" class="separator-icon" style="flex-shrink:0;"><span dir="auto">${tab.title}</span></span>`.repeat(4)
                    : `<span class="static-wrapper"><img src="${iconUrl}" class="separator-icon" style="flex-shrink:0;"><span class="static-title" dir="auto">${tab.title}</span></span>`;

                statusMsg.innerHTML = content;
                statusMsg.setAttribute("data-last-title", tab.title);

                if (applyMarquee) {
                    statusMsg.style.animation = 'none';
                    void statusMsg.offsetWidth;
                    const totalWidth = statusMsg.scrollWidth;
                    const halfWidth = totalWidth / 2;
                    statusMsg.style.setProperty('--marquee-travel', `-${halfWidth}px`);
                    statusMsg.style.animation = '';
                    try {
                        localStorage.setItem("cachedTabInfo", JSON.stringify({
                            tabId: tab.id,
                            title: tab.title,
                            iconUrl,
                            travelPx: halfWidth
                        }));
                    } catch (e) { }
                } else {
                    try {
                        localStorage.setItem("cachedTabInfo", JSON.stringify({
                            tabId: tab.id,
                            title: tab.title,
                            iconUrl,
                            travelPx: 0
                        }));
                    } catch (e) { }
                }
            }
        } catch (e) {
            statusMsg.textContent = i18n.t("status_active") || "Active";
        }
    },

    startPolling(callback) {
        this.stopPolling();

        let hasConnectedOnce = false;
        let failedPings = 0;

        pollingInterval = setInterval(() => {
            chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, res => {
                const error = chrome.runtime.lastError;
                if (!pollingInterval) return;

                if (error || !res) {
                    if (hasConnectedOnce) {
                        failedPings++;
                        if (failedPings >= 3) {
                            callback({ disabled: true });
                        }
                    } else {
                        callback({ initializing: true });
                    }
                    return;
                }

                failedPings = 0;

                if (res.success === true) {
                    hasConnectedOnce = true;
                    callback({ success: true, audioDetected: res.audioDetected });
                } else if (res.success === false) {
                    callback({ disabled: true });
                }
            });
        }, 500);
    },

    stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }
};