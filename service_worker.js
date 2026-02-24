/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

async function ensureOffscreen() {
    await (chrome.offscreen.hasDocument?.()) || await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Audio Processing"
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if ("START_CAPTURE" === message.type) {
        (async () => {
            try {
                await ensureOffscreen();
                chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId }, async (streamId) => {
                    if (chrome.runtime.lastError || !streamId) {
                        return sendResponse({ success: false });
                    }
                    chrome.storage.local.set({ capturingTabId: message.tabId });

                    // 1. Fetch settings here where the API is 100% stable
                    const settings = await chrome.storage.local.get(["volumeLevel", "bassLevel", "midLevel", "trebleLevel"]);

                    // 2. Pass them directly to the offscreen document
                    chrome.runtime.sendMessage({
                        type: "INCOMING_STREAM",
                        streamId: streamId,
                        settings: settings
                    }).catch(() => { });

                    sendResponse({ success: true });
                });
            } catch (error) {
                sendResponse({ success: false });
            }
        })();
        return true; // REQUIRED for async
    }

    if ("STOP_CAPTURE" === message.type) {
        chrome.storage.local.remove("capturingTabId");
        chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }).catch(() => { });
        sendResponse({ status: "stopped" }); // Added response
        return false;
    }

    if ("STREAM_ENDED_EXTERNALLY" === message.type) {
        chrome.storage.local.remove("capturingTabId");
        chrome.storage.local.set({ isEnabled: false });
        // Add this line to kill the zombie offscreen document
        chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }).catch(() => { });
        sendResponse({ status: "cleaned" });
        return false;
    }

    // Add this new block to handle the 30-second silence timeout securely
    if ("SILENCE_TIMEOUT" === message.type) {
        chrome.storage.local.remove("capturingTabId");
        chrome.storage.local.set({ isEnabled: false });
        chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }).catch(() => { });
        sendResponse({ status: "cleaned" });
        return false;
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.get(["capturingTabId"], (result) => {
        if (result.capturingTabId === tabId) {
            console.log(`Captured tab (${tabId}) closed.`);
            chrome.storage.local.remove("capturingTabId");
            chrome.storage.local.set({ isEnabled: false });
            chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }).catch(() => { });
        }
    });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.remove("capturingTabId");
    chrome.storage.local.set({ isEnabled: false });
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.remove("capturingTabId");
    chrome.storage.local.set({ isEnabled: false });
});