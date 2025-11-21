// offscreen.js - VERSIÓN FINAL ESTÉTICA 100% + FUNCIONAL (21 Nov 2025)

let audioContext = null;
let sourceNode = null;
let gainNode = null;
let bass, mid, treble, compressor;

function createFilter(type, freq) {
    const f = audioContext.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = type === 'peaking' ? 1 : 0.0001;
    f.gain.value = 0;
    return f;
}

async function startProcessing(streamId) {
    if (audioContext) {
        await audioContext.close().catch(() => { });
        audioContext = null;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            }
        });

        audioContext = new AudioContext();
        await audioContext.resume(); // por si acaso

        sourceNode = audioContext.createMediaStreamSource(stream);

        bass = createFilter('lowshelf', 100);
        mid = createFilter('peaking', 1000);
        treble = createFilter('highshelf', 8000);
        gainNode = audioContext.createGain();
        compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -10;
        compressor.ratio.value = 12;

        sourceNode.connect(bass)
            .connect(mid)
            .connect(treble)
            .connect(gainNode)
            .connect(compressor)
            .connect(audioContext.destination);

        const data = await chrome.storage.local.get(['volumeLevel', 'bassLevel', 'midLevel', 'trebleLevel']);
        gainNode.gain.value = data.volumeLevel ?? 1.0;
        bass.gain.value = data.bassLevel ?? 0;
        mid.gain.value = data.midLevel ?? 0;
        treble.gain.value = data.trebleLevel ?? 0;

        // Forzamos running con un kick silencioso (inaudible)
        const kick = audioContext.createOscillator();
        kick.frequency.value = 0;
        const g = audioContext.createGain();
        g.gain.value = 0;
        kick.connect(g).connect(audioContext.destination);
        kick.start();
        kick.stop(audioContext.currentTime + 0.001);

        chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', success: true });

    } catch (err) {
        console.error("Error captura:", err);
        chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', success: false });
    }
}

// SOLO CAMBIA EL LISTENER AL FINAL:

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'INCOMING_STREAM') startProcessing(msg.streamId);

    // === CANAL PRIVADO AJUSTADO ===
    if (msg.type === 'TARGET_OFFSCREEN_PING') {
        // Solo decimos true si el contexto existe Y no está cerrado
        const isReady = audioContext && audioContext.state !== 'closed';
        sendResponse({ success: !!isReady });
        return false;
    }
    // ==============================

    if (msg.type === 'UPDATE_GAIN' && gainNode) gainNode.gain.value = parseFloat(msg.value);
    if (msg.type === 'UPDATE_BASS' && bass) bass.gain.value = parseFloat(msg.value);
    if (msg.type === 'UPDATE_MID' && mid) mid.gain.value = parseFloat(msg.value);
    if (msg.type === 'UPDATE_TREBLE' && treble) treble.gain.value = parseFloat(msg.value);

    if ((msg.type === 'TOGGLE_ENABLED' && msg.value === false) || msg.type === 'STOP_CAPTURE') {
        if (sourceNode?.mediaStream) sourceNode.mediaStream.getTracks().forEach(t => t.stop());
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', success: false });
    }
});