import { i18n } from './i18n.js';
import { storage } from './storageHelpers.js';

let pollingInterval = null;
let lastAudioTime = 0;

export const uiStatus = {
    async update(isActive, isToggleOn, isAudioDetected = false, isMarqueeEnabled = true) {
        const statusMsg = document.getElementById("statusMessage");
        const container = document.getElementById("statusContainer");
        const takeOverBtn = document.getElementById("takeOverBtn");
        const sliders = document.querySelectorAll('input[type="range"]');
        const toggleLabel = document.querySelector(".toggle-label");
        const resetBtn = document.getElementById("resetButton");
        const toggle = document.getElementById("toggleEnabled");

        if (toggle) toggle.checked = isToggleOn;

        // --- SMART RESET ---
        // Only wipe the UI if we are changing major states to prevent flickering
        const currentType = statusMsg.getAttribute("data-ui-type");
        const nextType = !isToggleOn ? "disabled" : (!isActive ? "loading" : "active");

        if (currentType !== nextType) {
            statusMsg.classList.remove('text-disabled', 'text-waiting', 'text-loading', 'text-active', 'text-conflict', 'marquee-text');
            container.classList.remove('mask-active');
            statusMsg.style.animationDelay = "";
            statusMsg.textContent = ""; 
            statusMsg.setAttribute("data-ui-type", nextType);
        }

        // --- CASE 1: DISABLED ---
        if (!isToggleOn) {
            const msg = i18n.t("status_disabled") || "Extension disabled.";
            if (statusMsg.textContent !== msg) statusMsg.textContent = msg;
            statusMsg.classList.add('text-disabled');
            statusMsg.removeAttribute("data-last-title");

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
        if (!container.classList.contains("conflict")) {
            sliders.forEach(s => s.disabled = false);
            if (resetBtn) resetBtn.disabled = false;
        }

        if (toggleLabel) {
            toggleLabel.textContent = i18n.t("toggle_label") || "Extension Enabled";
            toggleLabel.classList.remove('label-disabled');
            toggleLabel.classList.add('label-enabled');
        }

        if (isActive) {
            if (isAudioDetected) lastAudioTime = Date.now();
            const showActiveState = isAudioDetected || (Date.now() - lastAudioTime < 5000);

            if (showActiveState) {
                await this._renderActiveState(statusMsg, container, isMarqueeEnabled);
            } else {
                const waitMsg = i18n.t("status_waiting") || "Waiting for audio...";
                if (statusMsg.textContent !== waitMsg) {
                    statusMsg.textContent = waitMsg;
                    statusMsg.classList.add('text-waiting');
                    statusMsg.classList.remove('marquee-text');
                    container.classList.remove('mask-active');
                    statusMsg.removeAttribute("data-last-title");
                }
            }
        } else {
            const loadMsg = i18n.t("status_loading") || "Initializing...";
            if (statusMsg.textContent !== loadMsg) {
                statusMsg.textContent = loadMsg;
                statusMsg.classList.add('text-loading');
                statusMsg.removeAttribute("data-last-title");
            }
        }
    },

    async _renderActiveState(statusMsg, container, isMarqueeEnabled) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;

            const currentTitle = statusMsg.getAttribute("data-last-title");
            const titleChanged = currentTitle !== tab.title;

            // Check if we need to switch between Marquee and Static mode
            const hasMarqueeHTML = !!statusMsg.querySelector('.marquee-content');
            const modeChanged = isMarqueeEnabled !== hasMarqueeHTML;

            // ONLY update the DOM if the title or mode actually changed
            if (titleChanged || modeChanged || !statusMsg.hasChildNodes()) {

                if (isMarqueeEnabled) {
                    statusMsg.classList.add('marquee-text');
                    container.classList.add('mask-active');
                } else {
                    statusMsg.classList.remove('marquee-text');
                    container.classList.remove('mask-active');
                    statusMsg.style.animationDelay = "";
                }

                const iconUrl = tab.favIconUrl || '';
                const content = isMarqueeEnabled
                    ? `<span class="marquee-content"><img src="${iconUrl}" class="separator-icon"><span>${tab.title}</span></span>`.repeat(4)
                    : `<span class="static-wrapper" style="display:inline-flex;align-items:center;justify-content:center;max-width:100%;"><img src="${iconUrl}" class="separator-icon" style="margin-right:6px;"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tab.title}</span></span>`;

                statusMsg.innerHTML = content;
                statusMsg.setAttribute("data-last-title", tab.title);
            }
        } catch (e) {
            statusMsg.textContent = i18n.t("status_active") || "Active";
        }
    },

    startPolling(callback) {
        this.stopPolling();
        lastAudioTime = 0;
        let hasConnectedOnce = false;

        pollingInterval = setInterval(() => {
            chrome.runtime.sendMessage({ type: "TARGET_OFFSCREEN_PING" }, res => {
                const error = chrome.runtime.lastError;
                if (!pollingInterval) return;

                if (error || !res) {
                    if (hasConnectedOnce) {
                        callback({ disabled: true });
                    } else {
                        callback({ initializing: true });
                    }
                    return;
                }

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