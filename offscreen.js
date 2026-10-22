/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

let bass = null,
    mid = null,
    treble = null,
    compressor = null,
    audioContext = null,
    sourceNode = null,
    gainNode = null,
    analyser = null,
    silenceInterval = null,
    silenceSeconds = 0,
    isInitializing = false;

let pristineMediaStreamHandle = null;

function createFilter(type, frequency) {
    const filter = audioContext.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    if ("peaking" === type) {
        filter.Q.value = 0.7; // Smooth musical bandwidth for mids
    }
    filter.gain.value = 0;
    return filter;
}

function setSmoothParam(param, targetValue) {
    if (!param || !audioContext) return;
    const now = audioContext.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(targetValue, now, 0.015);
}

// =========================================================================
// CENTRALIZED TEARDOWN
// Stops hardware tracks locally *before* signaling the service worker or UI.
// This guarantees the blue casting icon disappears immediately.
// =========================================================================
function stopHardwareTracks() {
    if (pristineMediaStreamHandle) {
        pristineMediaStreamHandle.getTracks().forEach(track => {
            track.onended = null;
            try { track.stop(); } catch (e) { }
        });
        pristineMediaStreamHandle = null;
    }

    if (silenceInterval) {
        clearInterval(silenceInterval);
        silenceInterval = null;
    }

    if (sourceNode) {
        try { sourceNode.disconnect(); } catch (e) { }
        sourceNode = null;
    }

    if (gainNode) {
        try { gainNode.disconnect(); } catch (e) { }
        gainNode = null;
    }

    if (compressor) {
        try { compressor.disconnect(); } catch (e) { }
        compressor = null;
    }

    if (audioContext) {
        audioContext.onstatechange = null;
        if (audioContext.state !== "closed") {
            audioContext.close().catch(() => { });
        }
        audioContext = null;
    }

    bass = null;
    mid = null;
    treble = null;
    analyser = null;
    silenceSeconds = 0;
}

async function startProcessing(streamId, savedSettings = {}) {
    isInitializing = true;
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

        const tracks = pristineMediaStreamHandle.getAudioTracks();
        if (tracks.length > 0) {
            const activeTrack = tracks[0];
            activeTrack.onended = () => {
                if (pristineMediaStreamHandle && pristineMediaStreamHandle.getAudioTracks()[0] === activeTrack) {
                    stopHardwareTracks();
                    chrome.runtime.sendMessage({ type: "STREAM_ENDED_EXTERNALLY" }).catch(() => { });
                }
            };
        }

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

        // HD FREQUENCIES (Synced with UI: 80Hz / 2500Hz / 8000Hz)
        bass = createFilter("lowshelf", 80);
        mid = createFilter("peaking", 2500);
        treble = createFilter("highshelf", 8000);
        gainNode = audioContext.createGain();

        // THE V2.0.0 SUCCESSOR
        compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -16.0; // Sweet spot: high enough to keep normal volume, low enough to catch bass spikes
        compressor.knee.value = 24.0;       // Ultra-soft knee: smoothly glues bass and vocals together
        compressor.ratio.value = 5.0;       // Strong enough to catch heavy EQ boosts without brickwalling
        compressor.attack.value = 0.003;    // 3ms: The exact v2.0.0 punch
        compressor.release.value = 0.25;    // 250ms: The exact v2.0.0 depth

        // Watchdog input tap (pre-EQ/pre-gain)
        sourceNode.connect(analyser);

        // AUDIO GRAPH: Source -> EQ -> Gain -> Limiter -> Output
        sourceNode.connect(bass)
            .connect(mid)
            .connect(treble)
            .connect(gainNode)
            .connect(compressor);

        compressor.connect(audioContext.destination);

        // Apply cached settings
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
                if (audioContext.state === "suspended") {
                    audioContext.resume().catch(() => { });
                }

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const volumeSum = dataArray.reduce((acc, val) => acc + val, 0);
                isCurrentSilence = volumeSum <= 50;
            }

            if (isCurrentSilence) {
                silenceSeconds++;
            } else {
                silenceSeconds = 0;
            }

            if (silenceSeconds >= 1800) {
                stopHardwareTracks();
                chrome.runtime.sendMessage({ type: "SILENCE_TIMEOUT" }).catch(() => { });
                silenceSeconds = 0;
            }
        }, 1000);

        isInitializing = false;
        chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: true }).catch(() => { });
        return true;

    } catch (error) {
        console.error("Capture error:", error);
        isInitializing = false;
        stopHardwareTracks();
        chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: false }).catch(() => { });
        return false;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case "INCOMING_STREAM":
            startProcessing(message.streamId, message.settings)
                .then(success => sendResponse({ success }));
            return true;

        case "TARGET_OFFSCREEN_PING": {
            const isContextActive = !!(
                isInitializing ||
                (audioContext &&
                    audioContext.state !== "closed" &&
                    pristineMediaStreamHandle &&
                    pristineMediaStreamHandle.active)
            );

            if (audioContext && audioContext.state === "suspended") {
                audioContext.resume().catch(() => { });
            }

            let isAudioDetected = false;
            if (!isInitializing && isContextActive && analyser) {
                const d = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(d);
                isAudioDetected = d.reduce((a, v) => a + v, 0) > 50;
            }

            sendResponse({ success: isContextActive, audioDetected: isAudioDetected });
            return false;
        }

        case "UPDATE_GAIN":
            if (gainNode) setSmoothParam(gainNode.gain, parseFloat(message.value));
            sendResponse({ ok: true });
            return false;

        case "UPDATE_BASS":
            if (bass) setSmoothParam(bass.gain, parseFloat(message.value));
            sendResponse({ ok: true });
            return false;

        case "UPDATE_MID":
            if (mid) setSmoothParam(mid.gain, parseFloat(message.value));
            sendResponse({ ok: true });
            return false;

        case "UPDATE_TREBLE":
            if (treble) setSmoothParam(treble.gain, parseFloat(message.value));
            sendResponse({ ok: true });
            return false;

        case "OFFSCREEN_STOP":
        case "STOP_CAPTURE":
            stopHardwareTracks();
            sendResponse({ status: "ok" });
            return false;
    }

    return false;
});