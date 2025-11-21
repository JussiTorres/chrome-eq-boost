// service_worker.js - Gestión de ID de Pestaña

async function ensureOffscreen() {
    if (await chrome.offscreen.hasDocument?.()) return;
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Audio Processing'
    });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'START_CAPTURE') {
        (async () => {
            try {
                await ensureOffscreen();
                chrome.tabCapture.getMediaStreamId({ targetTabId: msg.tabId }, (streamId) => {
                    if (chrome.runtime.lastError || !streamId) {
                        console.warn("Error stream:", chrome.runtime.lastError);
                        sendResponse({ success: false });
                        return;
                    }
                    
                    // === CAMBIO: Guardar quién es el dueño ===
                    chrome.storage.local.set({ capturingTabId: msg.tabId });
                    // ========================================

                    chrome.runtime.sendMessage({
                        type: 'INCOMING_STREAM',
                        streamId: streamId
                    });
                    sendResponse({ success: true });
                });
            } catch (e) {
                console.error(e);
                sendResponse({ success: false });
            }
        })();
        return true;
    }

    if (msg.type === 'STOP_CAPTURE') {
        // === CAMBIO: Liberar al dueño ===
        chrome.storage.local.remove('capturingTabId');
        // ================================
        chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
    }
});