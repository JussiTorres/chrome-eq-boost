/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

let bass, mid, treble, compressor, audioContext = null,
    sourceNode = null,
    gainNode = null,
    analyser = null,
    silenceInterval = null,
    silenceSeconds = 0; // Global timer

function createFilter(type, frequency) {
    const filter = audioContext.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    // HD TWEAK: Q value of 0.7 provides a smooth "musical" curve
    filter.Q.value = "peaking" === type ? 0.7 : 0.0001;
    filter.gain.value = 0;
    return filter;
}

async function startProcessing(streamId) {
    if (audioContext) {
        await audioContext.close().catch(() => { });
        audioContext = null;
    }

    // Clear any existing silence timer to prevent overlaps
    if (silenceInterval) {
        clearInterval(silenceInterval);
        silenceInterval = null;
    }
    silenceSeconds = 0;

    try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: "tab",
                    chromeMediaSourceId: streamId
                }
            }
        });

        mediaStream.getAudioTracks()[0].onended = () => {
            console.log("Stream cut externally");
            chrome.runtime.sendMessage({ type: "STREAM_ENDED_EXTERNALLY" }).catch(() => { });
        };

        // Standard AudioContext uses system sample rate (e.g., 44.1kHz or 48kHz) for high fidelity
        audioContext = new AudioContext();
        await audioContext.resume();

        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        // Instant response for snappy UI
        analyser.smoothingTimeConstant = 0.0;

        // HD FREQUENCIES
        bass = createFilter("lowshelf", 80);      // Deep Bass (previously 100)
        mid = createFilter("peaking", 2500);      // Clarity/Presence (previously 1000)
        treble = createFilter("highshelf", 8000); // Air/Brilliance (Stayed same)

        gainNode = audioContext.createGain();

        // HD COMPRESSOR SETTINGS
        // Prevents clipping while maintaining dynamic range
        compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -24; // Start compressing early
        compressor.knee.value = 30;       // Soft knee for transparent transition
        compressor.ratio.value = 3;       // 3:1 ratio (Audiophile standard)
        compressor.attack.value = 0.003;  // Fast attack (3ms)
        compressor.release.value = 0.25;  // Natural release (250ms)

        // Connect the nodes chain
        sourceNode.connect(analyser);
        sourceNode.connect(bass)
            .connect(mid)
            .connect(treble)
            .connect(gainNode)
            .connect(compressor)
            .connect(audioContext.destination);

        // Restore saved settings
        let settings = {
            volumeLevel: 1,
            bassLevel: 0,
            midLevel: 0,
            trebleLevel: 0
        };

        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            try {
                const stored = await chrome.storage.local.get(["volumeLevel", "bassLevel", "midLevel", "trebleLevel"]);
                settings = { ...settings, ...stored };
            } catch (e) { }
        }

        gainNode.gain.value = settings.volumeLevel ?? 1;
        bass.gain.value = settings.bassLevel ?? 0;
        mid.gain.value = settings.midLevel ?? 0;
        treble.gain.value = settings.trebleLevel ?? 0;

        // Anti-sleep hack
        const osc = audioContext.createOscillator();
        osc.frequency.value = 0;
        const silentGain = audioContext.createGain();
        silentGain.gain.value = 0;
        osc.connect(silentGain).connect(audioContext.destination);
        osc.start();
        osc.stop(audioContext.currentTime + 0.001);

        // Internal Watchdog
        if (silenceInterval) clearInterval(silenceInterval);
        silenceSeconds = 0; // Use the global variable

        silenceInterval = setInterval(() => {
            // Safety Check: If the extension context is invalidated, stop the interval immediately
            if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
                clearInterval(silenceInterval);
                return;
            }

            let isCurrentSilence = true;

            if (audioContext && audioContext.state === "running" && analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const volumeSum = dataArray.reduce((acc, val) => acc + val, 0);

                // If sound is detected, reset the timer to zero
                isCurrentSilence = volumeSum <= 100;
            }

            if (isCurrentSilence) {
                silenceSeconds++;
            } else {
                silenceSeconds = 0;
            }

            // ONLY here does the system auto-shutdown
            if (silenceSeconds >= 30) {
                // Secondary safety check for storage access
                if (chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({ isEnabled: false });
                    chrome.storage.local.remove("capturingTabId");
                }

                if (audioContext) audioContext.close();
                clearInterval(silenceInterval);
                silenceInterval = null;
                silenceSeconds = 0;

                // Explicitly notify any open popups
                chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: false }).catch(() => { });
            }
        }, 1000);

        chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: true }).catch(() => { });

    } catch (error) {
        console.error("Capture error:", error);
        chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: false }).catch(() => { });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if ("INCOMING_STREAM" === message.type) {
        startProcessing(message.streamId);
        sendResponse({ success: true });
        return false;
    }

    if ("TARGET_OFFSCREEN_PING" === message.type) {
        const isContextActive = audioContext && audioContext.state !== "closed";
        let isAudioDetected = false;

        if (isContextActive && analyser) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const volumeSum = dataArray.reduce((acc, val) => acc + val, 0);
            isAudioDetected = volumeSum > 100;
        }

        sendResponse({
            success: isContextActive,
            audioDetected: isAudioDetected
        });
        return false;
    }

    if ("UPDATE_GAIN" === message.type && gainNode) gainNode.gain.value = parseFloat(message.value);
    if ("UPDATE_BASS" === message.type && bass) bass.gain.value = parseFloat(message.value);
    if ("UPDATE_MID" === message.type && mid) mid.gain.value = parseFloat(message.value);
    if ("UPDATE_TREBLE" === message.type && treble) treble.gain.value = parseFloat(message.value);

    if (("TOGGLE_ENABLED" === message.type && false === message.value) || "STOP_CAPTURE" === message.type) {
        if (silenceInterval) {
            clearInterval(silenceInterval);
            silenceInterval = null;
        }

        if (sourceNode?.mediaStream) {
            sourceNode.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: false }).catch(() => { });
    }
    sendResponse({ received: true });
    return false;
});