// offscreen.js - Versión Final Corregida (Asincronía)

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
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId
            }
        }
    });

    audioContext = new AudioContext();
    sourceNode = audioContext.createMediaStreamSource(stream);

    bass = createFilter('lowshelf', 100);
    mid = createFilter('peaking', 1000);
    treble = createFilter('highshelf', 8000);
    gainNode = audioContext.createGain();
    compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.ratio.value = 12;

    sourceNode.connect(bass)
        .connect(mid)
        .connect(treble)
        .connect(gainNode)
        .connect(compressor)
        .connect(audioContext.destination);

    // Cargar valores guardados
    const data = await chrome.storage.local.get(['volumeLevel', 'bassLevel', 'midLevel', 'trebleLevel', 'isEnabled']);
    gainNode.gain.value = data.volumeLevel || 1.0;
    bass.gain.value = data.bassLevel || 0;
    mid.gain.value = data.midLevel || 0;
    treble.gain.value = data.trebleLevel || 0;

    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', success: true, isEnabled: data.isEnabled !== false });
}

// ⚡ CORRECCIÓN: La función debe ser asíncrona para usar 'await' ⚡
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (msg.type === 'INCOMING_STREAM') {
        startProcessing(msg.streamId);
    }

    if (msg.type === 'UPDATE_GAIN' && gainNode) {
        gainNode.gain.value = parseFloat(msg.value);
        chrome.storage.local.set({ volumeLevel: msg.value });
    }
    if (msg.type === 'UPDATE_BASS' && bass) {
        bass.gain.value = parseFloat(msg.value);
        chrome.storage.local.set({ bassLevel: msg.value });
    }
    if (msg.type === 'UPDATE_MID' && mid) {
        mid.gain.value = parseFloat(msg.value);
        chrome.storage.local.set({ midLevel: msg.value });
    }
    if (msg.type === 'UPDATE_TREBLE' && treble) {
        treble.gain.value = parseFloat(msg.value);
        chrome.storage.local.set({ trebleLevel: msg.value });
    }

    // ⚡ CORRECCIÓN: Uso de await para cargar volumen al encender ⚡
    if (msg.type === 'TOGGLE_ENABLED') {
        const enabled = msg.value === true;
        chrome.storage.local.set({ isEnabled: enabled });

        if (!enabled) {
            // DESACTIVAR = parar el stream entero (silencio instantáneo y libera recursos)
            if (sourceNode && sourceNode.mediaStream) {
                sourceNode.mediaStream.getTracks().forEach(track => track.stop());
            }
            if (audioContext) audioContext.close();
            audioContext = sourceNode = gainNode = bass = always = mid = treble = compressor = null;

            chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', success: false });
        } else {
            // Al volver a activar, el popup ya llamará a START_CAPTURE → no hacemos nada aquí
        }
    }

    if (msg.type === 'STOP_CAPTURE') {
        // Lo mismo que arriba (para el botón reset y cierre de pestaña)
        if (sourceNode && sourceNode.mediaStream) {
            sourceNode.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (audioContext) audioContext.close();
        audioContext = sourceNode = gainNode = bass = mid = treble = compressor = null;
        chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', success: false });
    }
});