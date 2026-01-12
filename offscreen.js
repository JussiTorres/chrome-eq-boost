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
    analyser = null;

// NEW: Variables for background silence detection
let silenceInterval = null;
let silenceSeconds = 0;

function createFilter(type, frequency) {
    const filter = audioContext.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = "peaking" === type ? 1 : 0.0001;
    filter.gain.value = 0;
    return filter;
}

async function startProcessing(streamId) {
    if (audioContext) {
        await audioContext.close().catch(() => {});
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
            chrome.runtime.sendMessage({ type: "STREAM_ENDED_EXTERNALLY" }).catch(() => {});
        };

        audioContext = new AudioContext();
        await audioContext.resume();

        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; 
        
        // Instant response for snappy UI
        analyser.smoothingTimeConstant = 0.0; 

        bass = createFilter("lowshelf", 100);
        mid = createFilter("peaking", 1000);
        treble = createFilter("highshelf", 8000);
        gainNode = audioContext.createGain();
        compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -10;
        compressor.ratio.value = 12;

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
            } catch (e) {}
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

        // --- NEW: INTERNAL WATCHDOG ---
        // This runs inside the background document, so it keeps working
        // even when the popup is closed.
        silenceInterval = setInterval(() => {
            if (!analyser || !audioContext || audioContext.state === 'closed') return;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate total volume
            const volumeSum = dataArray.reduce((acc, val) => acc + val, 0);

            // Threshold > 100 filters out digital noise
            if (volumeSum > 100) {
                // Audio detected: Reset timer
                silenceSeconds = 0;
            } else {
                // Silence detected: Start counting
                silenceSeconds++;
                
                // If silent for 30 seconds, shut down
                if (silenceSeconds >= 30) {
                    console.log("Auto-shutdown: 30 seconds of silence detected.");
                    
                    // 1. Update UI state (so toggle turns off next time you open it)
                    chrome.storage.local.set({ isEnabled: false });
                    
                    // 2. Tell Service Worker to stop capture
                    chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
                    
                    // 3. Stop this timer
                    clearInterval(silenceInterval);
                }
            }
        }, 1000); // Check every 1 second

        chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: true }).catch(() => {});

    } catch (error) {
        console.error("Capture error:", error);
        chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: false }).catch(() => {});
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if ("INCOMING_STREAM" === message.type) {
        startProcessing(message.streamId);
    }

    if ("TARGET_OFFSCREEN_PING" === message.type) {
        const isContextActive = audioContext && "closed" !== audioContext.state;
        let isAudioDetected = false;
        
        if (isContextActive && analyser) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const volumeSum = dataArray.reduce((acc, val) => acc + val, 0);
            isAudioDetected = volumeSum > 100; 
        }
        sendResponse({
            success: !!isContextActive,
            audioDetected: isAudioDetected
        });
        return false;
    }

    if ("UPDATE_GAIN" === message.type && gainNode) gainNode.gain.value = parseFloat(message.value);
    if ("UPDATE_BASS" === message.type && bass) bass.gain.value = parseFloat(message.value);
    if ("UPDATE_MID" === message.type && mid) mid.gain.value = parseFloat(message.value);
    if ("UPDATE_TREBLE" === message.type && treble) treble.gain.value = parseFloat(message.value);

    if (("TOGGLE_ENABLED" === message.type && false === message.value) || "STOP_CAPTURE" === message.type) {
        // Clear the watchdog timer on manual stop
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
        chrome.runtime.sendMessage({ type: "STATUS_UPDATE", success: false }).catch(() => {});
    }
});