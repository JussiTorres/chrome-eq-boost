// service_worker.js - Gestión de ID y Limpieza Automática

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
                    
                    // Guardar quién es el dueño
                    chrome.storage.local.set({ capturingTabId: msg.tabId });

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
        // Liberar al dueño manualmente
        chrome.storage.local.remove('capturingTabId');
        chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
    }
});

// Detectar cierre de pestaña ===
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    chrome.storage.local.get(['capturingTabId'], (result) => {
        if (result.capturingTabId === tabId) {
            // La pestaña que controlábamos se cerró. Limpiamos todo.
            console.log(`Pestaña capturada (${tabId}) cerrada. Limpiando estado.`);
            
            // 1. Borrar el ID fantasma
            chrome.storage.local.remove('capturingTabId');
            
            // 2. Resetear el toggle visualmente para la próxima vez
            chrome.storage.local.set({ isEnabled: false });

            // 3. Avisar al Offscreen que pare todo
            chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
        }
    });
});

// === NUEVO: Limpieza al iniciar Chrome (Fix Bug "Estado Fantasma") ===
chrome.runtime.onStartup.addListener(() => {
    console.log("Chrome iniciando. Limpiando estado de audio antiguo.");
    chrome.storage.local.remove('capturingTabId');
    chrome.storage.local.set({ isEnabled: false });
});

// También limpiar al instalar o actualizar la extensión
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.remove('capturingTabId');
    chrome.storage.local.set({ isEnabled: false });
});