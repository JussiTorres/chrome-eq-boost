// content.js - FINAL (Para Arquitectura Tab Capture)
// Este script es un simple placeholder. La lógica de audio reside en offscreen.js.

// Enviamos un mensaje de respuesta a cualquier solicitud GET_STATUS que llegue
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_STATUS") {
        // En la arquitectura Tab Capture, el content script nunca está "listo" para el EQ.
        // Simplemente responde para evitar un error de "timeout" en el popup.
        sendResponse({ success: false, message: "Captura requerida." });
        return true;
    }
});