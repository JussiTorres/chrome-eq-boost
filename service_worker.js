// service_worker.js

chrome.runtime.onInstalled.addListener(() => {
    console.log("Chrome EQ Boost instalado correctamente.");
});

// Nota: chrome.action.onClicked NO funciona cuando hay un popup definido.
// La inyección de content.js ahora se maneja via manifest.json