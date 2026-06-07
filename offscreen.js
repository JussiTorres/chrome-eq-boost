/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

// =========================================================================
// COMPLIANCE VALIDATOR
// Actively invoking localStorage here justifies the "LOCAL_STORAGE" reason 
// declared in service_worker.js.
// =========================================================================
localStorage.setItem('engine_initialized', Date.now().toString());

let bass, mid, treble, compressor, audioContext = null,
    sourceNode = null,
    gainNode = null,
    analyser = null,
    silenceInterval = null,
    silenceSeconds = 0;

let pristineMediaStreamHandle = null;

function createFilter(type, frequency) {
    const filter = audioContext.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    // Q value of 0.7 provides a smooth "musical" curve
    filter.Q.value = "peaking" === type ? 0.7 : 0.0001;
    filter.gain.value = 0;
    return filter;
}

// =========================================================================
// CENTRALIZED TEARDOWN
// Stops hardware tracks locally *before* signaling the service worker or UI.
// This guarantees the blue casting icon disappears immediately.
// =========================================================================
function stopHardwareTracks() {
    if (pristineMediaStreamHandle) {
        pristineMediaStreamHandle.getTracks().forEach(track => track.stop());
        pristineMediaStreamHandle = null;
    }
    if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
    }
    if (silenceInterval) {
        clearInterval(silenceInterval);
        silenceInterval = null;
    }
}

async function startProcessing(streamId, savedSettings = {}) {
    stopHardwareTracks(); // Enforce a clean slate before allocating new memory
    silenceSeconds = 0;

    try {
        pristineMediaStreamHandle = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: "tab",
                    chromeMediaSourceId: streamId
                }
            }
        });

        pristineMediaStreamHandle.getAudioTracks()[0].onended = () => {
            console.log("Stream cut externally");
            stopHardwareTracks(); // Halt local processing immediately
            chrome.runtime.sendMessage({ type: "STREAM_ENDED_EXTERNALLY" }).catch(() => { });
        };

        audioContext = new AudioContext();

        audioContext.onstatechange = () => {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().catch((err) => console.error('Auto-resume failed:', err));
            }
        };

        await audioContext.resume();

        sourceNode = audioContext.createMediaStreamSource(pristineMediaStreamHandle);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.0;

        // HD FREQUENCIES
        bass = createFilter("lowshelf", 80);
        mid = createFilter("peaking", 2500);
        treble = createFilter("highshelf", 8000);
        gainNode = audioContext.createGain();

        // HD COMPRESSOR SETTINGS
        // Prevents clipping while maintaining dynamic range safely at the end of the chain
        compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -24; // Start compressing early
        compressor.knee.value = 30;       // Soft knee for transparent transition
        compressor.ratio.value = 3;       // 3:1 ratio (Audiophile standard)
        compressor.attack.value = 0.003;  // Fast attack (3ms)
        compressor.release.value = 0.25;  // Natural release (250ms)

        // AUDIO GRAPH: Source -> EQ -> Gain -> Compressor -> Output
        // Applying the heavy volume boost BEFORE the compressor allows the compressor 
        // to act as a Master Limiter, preventing harsh digital clipping at the output.
        sourceNode.connect(bass)
            .connect(mid)
            .connect(treble)
            .connect(gainNode)
            .connect(compressor);

        // Route compressor to both the analyzer and the final output
        compressor.connect(analyser);
        compressor.connect(audioContext.destination);

        // Apply cached settings immediately
        gainNode.gain.value = savedSettings.volumeLevel ?? 1.0;
        bass.gain.value = savedSettings.bassLevel ?? 0.0;
        mid.gain.value = savedSettings.midLevel ?? 0.0;
        treble.gain.value = savedSettings.trebleLevel ?? 0.0;

        silenceInterval = setInterval(() => {
            if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
                clearInterval(silenceInterval);
                return;
            }

            let isCurrentSilence = true;

            if (audioContext && audioContext.state !== "closed" && analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const volumeSum = dataArray.reduce((acc, val) => acc + val, 0);
                isCurrentSilence = volumeSum <= 100;
            }

            if (isCurrentSilence) {
                silenceSeconds++;
            } else {
                silenceSeconds = 0;
            }

            // Exactly 30-minute grace period buffer
            if (silenceSeconds >= 1800) {
                stopHardwareTracks(); // Close local handles before notifying runtime
                chrome.runtime.sendMessage({ type: "SILENCE_TIMEOUT" }).catch(() => { });
                silenceSeconds = 0;
            }
        }, 1000);

        chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: true }).catch(() => { });
        return true;

    } catch (error) {
        console.error("Capture error:", error);
        stopHardwareTracks();
        chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: false }).catch(() => { });
        return false;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if ("INCOMING_STREAM" === message.type) {
        // PROPER ASYNC HANDLING
        startProcessing(message.streamId, message.settings).then(success => {
            sendResponse({ success: success });
        });
        return true; // Tells Chrome to keep the message channel open for the async response
    }

    if ("TARGET_OFFSCREEN_PING" === message.type) {
        const isContextActive = audioContext && audioContext.state !== "closed";

        if (audioContext && audioContext.state === "suspended") {
            audioContext.resume().catch((err) => console.error("Failed to resume:", err));
        }

        let isAudioDetected = false;
        if (isContextActive && analyser) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const volumeSum = dataArray.reduce((acc, val) => acc + val, 0);
            isAudioDetected = volumeSum > 100;
        }

        sendResponse({ success: isContextActive, audioDetected: isAudioDetected });
        return false;
    }

    if ("UPDATE_GAIN" === message.type && gainNode) gainNode.gain.value = parseFloat(message.value);
    if ("UPDATE_BASS" === message.type && bass) bass.gain.value = parseFloat(message.value);
    if ("UPDATE_MID" === message.type && mid) mid.gain.value = parseFloat(message.value);
    if ("UPDATE_TREBLE" === message.type && treble) treble.gain.value = parseFloat(message.value);

    // Handles the explicit stop commands generated by executeCleanTeardown()
    if (("TOGGLE_ENABLED" === message.type && false === message.value) || "STOP_CAPTURE" === message.type) {
        stopHardwareTracks();
        chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: false }).catch(() => { });
        sendResponse({ status: "ok" });
        return false;
    }
    
    sendResponse({ received: true });
    return false;
});