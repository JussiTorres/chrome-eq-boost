// service_worker.js - Versión FINAL que SÍ funciona (Chrome 131+ Nov 2025)

chrome.runtime.onInstalled.addListener(() => {
    console.log("EQ Boost instalado");
});

async function ensureOffscreen() {
    if (await chrome.offscreen.hasDocument?.()) return;
    
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],  // ← Razón correcta
        justification: 'Procesar audio de pestaña con Web Audio API'
    });
}

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (msg.type === 'START_CAPTURE') {
        await ensureOffscreen();

        chrome.tabCapture.getMediaStreamId({
            targetTabId: msg.tabId
        }, (streamId) => {
            if (chrome.runtime.lastError || !streamId) {
                sendResponse({ success: false });
                return;
            }

            // Enviamos el streamId al offscreen
            chrome.runtime.sendMessage({
                type: 'INCOMING_STREAM',
                streamId: streamId
            });

            sendResponse({ success: true });
        });

        return true; // respuesta asíncrona
    }

    if (msg.type === 'STOP_CAPTURE') {
        chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
    }
});