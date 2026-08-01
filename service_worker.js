/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

// Mutex lock to prevent concurrency crashes if the user rapidly double-clicks UI toggles
let creatingOffscreenPromise = null;

async function ensureOffscreen() {
    if (creatingOffscreenPromise) {
        await creatingOffscreenPromise;
        return;
    }

    const hasDoc = await chrome.offscreen.hasDocument?.();
    if (!hasDoc) {
        creatingOffscreenPromise = chrome.offscreen.createDocument({
            url: "offscreen.html",
            reasons: ["AUDIO_PLAYBACK", "LOCAL_STORAGE"],
            justification: "Continuous audio equalization and settings persistence"
        });
        await creatingOffscreenPromise;
    }
    creatingOffscreenPromise = null;
}

// -----------------------------------------------------------------------------
// CENTRALIZED TEARDOWN PIPELINE
// Eliminates race conditions by strictly awaiting the track termination 
// inside offscreen.js before destroying the document execution context.
// -----------------------------------------------------------------------------
async function executeCleanTeardown() {
    chrome.storage.local.remove("capturingTabId");
    chrome.storage.local.set({
        isEnabled: false,
        isPresetDeckOpen: false // Kills preset view on browser exit or teardown
    });

    const hasDoc = await chrome.offscreen.hasDocument?.();
    if (hasDoc) {
        await chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }).catch(() => { });
        await chrome.offscreen.closeDocument().catch(() => { });
    }
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

                    // Fetch parameters securely inside the background worker
                    const settings = await chrome.storage.local.get(["volumeLevel", "bassLevel", "midLevel", "trebleLevel"]);

                    // Pipe stream handles to the canvas and AWAIT confirmation
                    // This fixes the "synchronous lie" where the UI thought it succeeded 
                    // before the stream was actually processed.
                    const response = await chrome.runtime.sendMessage({
                        type: "INCOMING_STREAM",
                        streamId: streamId,
                        settings: settings
                    }).catch(() => ({ success: false }));

                    sendResponse({ success: response?.success || false });
                });
            } catch (error) {
                sendResponse({ success: false });
            }
        })();
        return true; // REQUIRED for async sendResponse
    }

    // Handles intentional shutdowns triggered from the UI
    if ("STOP_CAPTURE" === message.type) {
        executeCleanTeardown().then(() => sendResponse({ status: "stopped" }));
        return true; // Keep channel open for async teardown
    }

    // Handles automatic shutdowns triggered FROM the offscreen document.
    // Because offscreen.js already ran track.stop() locally before sending these, 
    // we bypass the await chain and just kill the document frame.
    if (["STREAM_ENDED_EXTERNALLY", "SILENCE_TIMEOUT"].includes(message.type)) {
        chrome.storage.local.remove("capturingTabId");
        chrome.storage.local.set({
            isEnabled: false,
            isPresetDeckOpen: false
        });
        chrome.offscreen.closeDocument().catch(() => { });
        sendResponse({ status: "cleaned" });
        return false;
    }

    // =========================================================================
    // SLIDER REAL-TIME ROUTING MIDDLEWARE
    // Intercepts UI slider modification messages when the service worker wakes
    // up from an inactive state and pipes them forward onto the offscreen canvas.
    // =========================================================================
    const uiUpdateEvents = ["UPDATE_GAIN", "UPDATE_BASS", "UPDATE_MID", "UPDATE_TREBLE"];
    if (uiUpdateEvents.includes(message.type)) {
        chrome.runtime.sendMessage(message).catch(() => {
            // Self-healing fallback: If forwarding fails, the offscreen target context 
            // was closed unexpectedly, so we trigger a clean teardown to reset state.
            executeCleanTeardown();
        });
        sendResponse({ forwarded: true });
        return false;
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.get(["capturingTabId"], (result) => {
        if (result.capturingTabId === tabId) {
            console.log(`Captured tab (${tabId}) closed.`);
            executeCleanTeardown();
        }
    });
});

chrome.runtime.onStartup.addListener(executeCleanTeardown);

// =============================================================================
// LIFECYCLE & STORAGE SCHEMA BOOTSTRAP
// Seeds essential data structures on install/update while executing teardowns.
// =============================================================================
chrome.runtime.onInstalled.addListener((details) => {
    executeCleanTeardown();

    if (details.reason === "install" || details.reason === "update") {
        chrome.storage.local.get(["customPresets", "hiddenBuiltInIds"], (result) => {
            const initialData = {};
            if (!result.customPresets) initialData.customPresets = [];
            if (!result.hiddenBuiltInIds) initialData.hiddenBuiltInIds = [];

            if (Object.keys(initialData).length > 0) {
                chrome.storage.local.set(initialData);
            }
        });
    }
});