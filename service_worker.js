/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

// =============================================================================
// STATE MANAGEMENT & MUTEX LOCKS
// =============================================================================
// 🚨 CRITICAL WARNING: `creatingOffscreenPromise` and `teardownPromise` act as Mutex locks.
// They prevent race conditions where rapid UI toggling might attempt to spawn or tear down
// offscreen documents simultaneously, which would crash the extension.
let creatingOffscreenPromise = null;
let teardownPromise = null;
let isCapturingBusy = false;

/**
 * Safely ensures the offscreen document is alive before routing audio.
 */
async function ensureOffscreen() {
    // Wait for any in-flight teardown to finish completely before checking/creating
    if (teardownPromise) {
        await teardownPromise;
    }

    if (creatingOffscreenPromise) {
        await creatingOffscreenPromise;
        return;
    }

    const hasDoc = await chrome.offscreen.hasDocument?.();
    if (!hasDoc) {
        creatingOffscreenPromise = (async () => {
            await chrome.offscreen.createDocument({
                url: "offscreen.html",
                // 🚨 CRITICAL FIX: Include "USER_MEDIA" alongside "AUDIO_PLAYBACK".
                // Using "AUDIO_PLAYBACK" alone causes Chromium to forcibly kill the
                // offscreen document after ~30 seconds of silence, ignoring the 30-min timer.
                reasons: ["USER_MEDIA", "AUDIO_PLAYBACK"],
                justification: "Continuous tab audio capture and real-time equalization"
            });

            // 🚨 CRITICAL FIX: Initialization Buffer
            // The offscreen document needs a fraction of a second to parse its JavaScript 
            // and register message listeners. Keeping this inside `creatingOffscreenPromise`
            // guarantees concurrent callers also wait for the buffer before sending messages.
            await new Promise(resolve => setTimeout(resolve, 150));
        })();

        try {
            await creatingOffscreenPromise;
        } finally {
            creatingOffscreenPromise = null;
        }
    }
}

// =============================================================================
// CENTRALIZED TEARDOWN PIPELINE
// =============================================================================
/**
 * Restores the extension to a clean state.
 * @param {boolean} preserveUiState - Keeps the preset deck open state if auto-startup is enabled.
 */
async function executeCleanTeardown(preserveUiState = false) {
    if (teardownPromise) {
        return teardownPromise;
    }

    teardownPromise = (async () => {
        // Wait for any pending creation to settle before tearing down
        if (creatingOffscreenPromise) {
            await creatingOffscreenPromise.catch(() => { });
        }

        isCapturingBusy = false;

        // 1. Clear capturing state from storage so the popup UI updates correctly
        await chrome.storage.local.remove("capturingTabId");
        const updates = { isEnabled: false };
        if (!preserveUiState) {
            updates.isPresetDeckOpen = false;
        }
        await chrome.storage.local.set(updates);

        // 2. Safely signal and destroy the offscreen document to free memory
        const hasDoc = await chrome.offscreen.hasDocument?.();
        if (hasDoc) {
            // Matches the "OFFSCREEN_STOP" listener inside offscreen.js
            await chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" }).catch(() => { });
            await chrome.offscreen.closeDocument().catch(() => { });
        }
    })();

    try {
        await teardownPromise;
    } finally {
        teardownPromise = null;
    }
}

// =============================================================================
// MESSAGE ROUTER
// =============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Ignore ping messages meant specifically for the offscreen document
    if ("TARGET_OFFSCREEN_PING" === message.type) {
        return false;
    }

    // --- INITIATE AUDIO CAPTURE ---
    if ("START_CAPTURE" === message.type) {
        // Prevent multiple simultaneous capture attempts overlapping
        if (isCapturingBusy) {
            sendResponse({ success: false, busy: true });
            return false;
        }
        isCapturingBusy = true;

        (async () => {
            try {
                await ensureOffscreen();

                // 🚨 CRITICAL: Get the MediaStream ID for the requested tab
                chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId }, async (streamId) => {
                    if (chrome.runtime.lastError || !streamId) {
                        isCapturingBusy = false;
                        return sendResponse({ success: false });
                    }

                    try {
                        // Retrieve saved EQ settings to apply immediately upon stream start to prevent audio jumps
                        const settings = await chrome.storage.local.get(["volumeLevel", "bassLevel", "midLevel", "trebleLevel"]);

                        // Hand off the stream ID and settings to the offscreen document
                        const response = await chrome.runtime.sendMessage({
                            type: "INCOMING_STREAM",
                            streamId: streamId,
                            settings: settings
                        }).catch(() => ({ success: false }));

                        // Update storage based on whether the offscreen document successfully attached the stream
                        if (response?.success) {
                            await chrome.storage.local.set({
                                isEnabled: true,
                                capturingTabId: message.tabId
                            });
                        } else {
                            await chrome.storage.local.remove("capturingTabId");
                            await chrome.storage.local.set({ isEnabled: false });
                        }

                        isCapturingBusy = false;
                        sendResponse({ success: response?.success || false });
                    } catch (innerError) {
                        isCapturingBusy = false;
                        sendResponse({ success: false });
                    }
                });
            } catch (error) {
                isCapturingBusy = false;
                sendResponse({ success: false });
            }
        })();
        return true; // Keeps the message channel open for the async response
    }

    // --- MANUAL STOP INITIATED BY USER ---
    if ("STOP_CAPTURE" === message.type) {
        chrome.storage.local.get(["autoStartupEnabled"], (result) => {
            executeCleanTeardown(result.autoStartupEnabled === true).then(() => {
                sendResponse({ status: "stopped" });
            });
        });
        return true;
    }

    // --- AUTOMATIC STOP (Stream died natively or silence watchdog fired) ---
    if (["STREAM_ENDED_EXTERNALLY", "SILENCE_TIMEOUT"].includes(message.type)) {
        // Ignore stale stream-ended events if a new capture is actively initializing
        if (isCapturingBusy && message.type === "STREAM_ENDED_EXTERNALLY") {
            sendResponse({ status: "ignored_busy" });
            return false;
        }

        chrome.storage.local.get(["autoStartupEnabled"], (result) => {
            executeCleanTeardown(result.autoStartupEnabled === true).then(() => {
                sendResponse({ status: "cleaned" });
            });
        });
        return true;
    }

    // 🚨 WARNING: EQ SLIDER UPDATES BLOCK REMOVED
    // The previous block intercepting "UPDATE_GAIN", "UPDATE_BASS", etc., was deleted.
    // The Popup now communicates these slider values directly to the offscreen document
    // via broadcast. Intercepting them here caused redundant processing and fatal 
    // teardowns when rapid slider messages overlapped and triggered the .catch() block.

    return false;
});

// =============================================================================
// TAB LIFECYCLE MANAGEMENT
// =============================================================================

/*
 * -----------------------------------------------------------------------------
 * 🚨 CRITICAL WARNING REGARDING TAB URL CHANGES (SPA COMPATIBILITY) 🚨
 * -----------------------------------------------------------------------------
 * The `chrome.tabs.onUpdated` listener looking for `changeInfo.url` has been 
 * INTENTIONALLY REMOVED. Do not add it back.
 *
 * Single Page Applications (SPAs) like YouTube, Spotify, and SoundCloud change 
 * the URL dynamically when moving to the next track WITHOUT reloading the page. 
 * Tearing down on a URL change prematurely breaks continuous audio playback.
 * 
 * Instead, this extension relies entirely on the native `MediaStream.onended` 
 * event inside `offscreen.js`. When a user performs a true hard-reload or 
 * navigates away completely, the browser natively destroys the MediaStream, 
 * which safely fires `STREAM_ENDED_EXTERNALLY` and cleans up the state.
 * -----------------------------------------------------------------------------
 */

// Tear down capture only if the tab is physically closed/removed from the window
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.get(["capturingTabId", "autoStartupEnabled"], (result) => {
        if (result.capturingTabId === tabId) {
            executeCleanTeardown(result.autoStartupEnabled === true);
        }
    });
});

// =============================================================================
// BROWSER / EXTENSION LIFECYCLE
// =============================================================================

// Ensure a clean UI and memory state when the browser starts up
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(["autoStartupEnabled"], (result) => {
        executeCleanTeardown(result.autoStartupEnabled === true);
    });
});

// Ensure a clean state and initialize base storage structures on install/update
chrome.runtime.onInstalled.addListener((details) => {
    chrome.storage.local.get(["autoStartupEnabled"], (res) => {
        executeCleanTeardown(res.autoStartupEnabled === true);
    });

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