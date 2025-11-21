// popup.js - VERSIÓN FINAL 100% FUNCIONAL (Tab Capture + Offscreen - Nov 2025)

const sliderConfigs = [
    { id: 'volumeSlider', display: 'volumeValue', type: 'UPDATE_GAIN', storageKey: 'volumeLevel', default: 1.0, multiplier: 100, suffix: '%' },
    { id: 'bassSlider', display: 'bassValue', type: 'UPDATE_BASS', storageKey: 'bassLevel', default: 0.0, multiplier: 1, suffix: ' dB' },
    { id: 'midSlider', display: 'midValue', type: 'UPDATE_MID', storageKey: 'midLevel', default: 0.0, multiplier: 1, suffix: ' dB' },
    { id: 'trebleSlider', display: 'trebleValue', type: 'UPDATE_TREBLE', storageKey: 'trebleLevel', default: 0.0, multiplier: 1, suffix: ' dB' }
];

function send(msg) {
    // Usamos chrome.runtime.sendMessage para comunicarnos con el service worker/offscreen
    chrome.runtime.sendMessage(msg).catch(() => { });
}

function updateDisplay(sliderId, displayId, value, multiplier, suffix) {
    const display = document.getElementById(displayId);

    // ⚡ CORRECCIÓN: Asegurar que value sea un número antes de usar toFixed ⚡
    const numericValue = parseFloat(value) || 0;

    if (display) {
        if (multiplier === 100) {
            display.textContent = `${Math.round(numericValue * multiplier)}%`;
        } else {
            display.textContent = `${numericValue.toFixed(1)}${suffix}`;
        }
    }
}

function updateStatusUI(success, isEnabled) {
    const status = document.getElementById('statusMessage');
    const sliders = document.querySelectorAll('input[type="range"]');
    const toggle = document.getElementById('toggleEnabled');

    if (toggle) toggle.checked = isEnabled;

    if (!isEnabled) {
        status.textContent = "Extensión desactivada.";
        status.style.color = '#9ca3af';
        sliders.forEach(s => s.disabled = true);
        return;
    }

    sliders.forEach(s => s.disabled = false);

    if (success) {
        status.textContent = "Ecualizador Activo";
        status.style.color = '#22c55e';
    } else {
        // Estado de espera (Captura en curso, pero aún no hay audio o el grafo está en setup)
        status.textContent = "Captura iniciada. Esperando audio...";
        status.style.color = '#f59e0b';
    }
}

// === LÓGICA ASÍNCRONA PARA INICIAR LA CAPTURA (Mejora la estabilidad) ===
async function startCaptureProcess() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 1. Notificar al Service Worker para iniciar la captura
    chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId: tab.id }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Fallo de comunicación con Service Worker.");
            updateStatusUI(false, true); // Mostrar mensaje de error/espera
            return;
        }

        if (response && response.success) {
            // 2. Si la captura fue iniciada, pedimos el estado real al Offscreen Document
            setTimeout(() => {
                send({ type: 'GET_STATUS' });
            }, 300); // 300ms de gracia para que offscreen.js cargue
        } else {
            // Captura fallida (Permiso denegado por el usuario o navegador)
            updateStatusUI(false, true);
        }
    });
}

// === INICIALIZACIÓN Y LISTENERS ===
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggleEnabled');

    // Cargar valores guardados en sliders
    chrome.storage.local.get(['volumeLevel', 'bassLevel', 'midLevel', 'trebleLevel', 'isEnabled'], (data) => {
        sliderConfigs.forEach(config => {
            const saved = data[config.storageKey] ?? config.default;
            const slider = document.getElementById(config.id);
            slider.value = saved;
            updateDisplay(config.id, config.display, saved, config.multiplier, config.suffix);
        });

        const isEnabled = data.isEnabled !== false;
        if (toggle) toggle.checked = isEnabled;

        // Al iniciar, si está habilitado, forzar el inicio de la captura.
        if (isEnabled) {
            startCaptureProcess();
        } else {
            updateStatusUI(false, false); // Mostrar como Desactivado
        }
    });

    // Sliders → enviar cambio + guardar
    sliderConfigs.forEach(config => {
        const slider = document.getElementById(config.id);

        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            updateDisplay(config.id, config.display, value, config.multiplier, config.suffix);
            send({ type: config.type, value: value });
            chrome.storage.local.set({ [config.storageKey]: value });
        });
    });

    // TOGGLE PRINCIPAL
    if (toggle) {
        toggle.addEventListener('change', async () => {
            const isEnabled = toggle.checked;
            chrome.storage.local.set({ isEnabled });

            if (isEnabled) {
                updateStatusUI(false, true);
                await startCaptureProcess();
            } else {
                send({ type: 'STOP_CAPTURE' });        // ← Para el stream entero
                send({ type: 'TOGGLE_ENABLED', value: false });
                updateStatusUI(false, false);          // ← Gris y "desactivada" al instante
            }
        });
    }

    // Botón Reset
    document.getElementById('resetButton').addEventListener('click', () => {
        sliderConfigs.forEach(config => {
            const slider = document.getElementById(config.id);
            slider.value = config.default;
            updateDisplay(config.id, config.display, config.default, config.multiplier, config.suffix);
            send({ type: config.type, value: config.default });
            chrome.storage.local.set({ [config.storageKey]: config.default });
        });

        if (!toggle.checked) {
            toggle.checked = true;
            chrome.storage.local.set({ isEnabled: true });
            send({ type: 'TOGGLE_ENABLED', value: true });
            // Forzar inicio de captura ya que el reset también habilita
            startCaptureProcess();
        }
        updateStatusUI(true, true);
    });

    // Escuchar actualizaciones desde offscreen.js
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'STATUS_UPDATE') {
            chrome.storage.local.get('isEnabled', (data) => {
                // Actualizar UI con el estado real del motor de audio (msg.success)
                updateStatusUI(msg.success, data.isEnabled !== false);
            });
        }
    });
});