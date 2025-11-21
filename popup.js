// popup.js - FINAL BLINDADO (Timing Fix)

const sliderConfigs = [
    { id: 'volumeSlider', display: 'volumeValue', type: 'UPDATE_GAIN', storageKey: 'volumeLevel', default: 1.0, multiplier: 100, suffix: '%' },
    { id: 'bassSlider', display: 'bassValue', type: 'UPDATE_BASS', storageKey: 'bassLevel', default: 0.0, multiplier: 1, suffix: ' dB' },
    { id: 'midSlider', display: 'midValue', type: 'UPDATE_MID', storageKey: 'midLevel', default: 0.0, multiplier: 1, suffix: ' dB' },
    { id: 'trebleSlider', display: 'trebleValue', type: 'UPDATE_TREBLE', storageKey: 'trebleLevel', default: 0.0, multiplier: 1, suffix: ' dB' }
];

function send(msg) {
    chrome.runtime.sendMessage(msg).catch(() => {});
}

function updateDisplay(sliderId, displayId, value, multiplier, suffix) {
    const display = document.getElementById(displayId);
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
        status.style.color = '#22c55e'; // Verde
    } else {
        // Solo ponemos naranja si no está ya en verde para evitar parpadeos
        if (status.textContent !== "Ecualizador Activo") {
            status.textContent = "Captura iniciada. Esperando audio...";
            status.style.color = '#f59e0b'; // Naranja
        }
    }
}

// Variable global para controlar el polling y evitar duplicados
let pollingInterval = null;

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval); // Limpiar anterior si existe

    let attempts = 0;
    const maxAttempts = 40; // ~20 segundos (más paciencia)

    pollingInterval = setInterval(() => {
        attempts++;
        
        // Usamos el canal privado
        chrome.runtime.sendMessage({ type: 'TARGET_OFFSCREEN_PING' }, (response) => {
            if (chrome.runtime.lastError || !response) {
                // Offscreen no listo, seguimos intentando
                return;
            }

            if (response.success === true) {
                // ¡ÉXITO!
                clearInterval(pollingInterval);
                pollingInterval = null;
                updateStatusUI(true, true);
            } 
            // Si responde false, seguimos esperando
        });

        if (attempts >= maxAttempts) {
            clearInterval(pollingInterval);
            pollingInterval = null;
            // Solo mostramos error si sigue habilitado visualmente
            if (document.getElementById('toggleEnabled').checked) {
                const status = document.getElementById('statusMessage');
                if (status.textContent !== "Ecualizador Activo") {
                    status.textContent = "Tiempo de espera agotado. Recarga la página.";
                    status.style.color = '#ef4444';
                }
            }
        }
    }, 500); // Revisar cada 0.5 segundos
}

async function startCaptureProcess() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // 1. Ponemos UI en espera visualmente
    updateStatusUI(false, true); 
    
    // 2. Iniciamos polling INMEDIATAMENTE (sin esperar respuesta del SW)
    startPolling();

    // 3. Enviamos la orden de captura
    chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId: tab.id }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Error captura:", chrome.runtime.lastError);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggleEnabled');

    chrome.storage.local.get(['volumeLevel', 'bassLevel', 'midLevel', 'trebleLevel', 'isEnabled'], (data) => {
        // Cargar sliders
        sliderConfigs.forEach(config => {
            const saved = data[config.storageKey] ?? config.default;
            const slider = document.getElementById(config.id);
            slider.value = saved;
            updateDisplay(config.id, config.display, saved, config.multiplier, config.suffix);
        });

        const isEnabled = data.isEnabled !== false;
        if (toggle) toggle.checked = isEnabled;

        if (isEnabled) {
            // Verificación inicial
            chrome.runtime.sendMessage({ type: 'TARGET_OFFSCREEN_PING' }, (response) => {
                if (response && response.success) {
                    updateStatusUI(true, true);
                } else {
                    // Si no está listo, iniciamos reconexión suave
                    startCaptureProcess();
                }
            });
        } else {
            updateStatusUI(false, false);
        }
    });

    // Listeners Sliders
    sliderConfigs.forEach(config => {
        const slider = document.getElementById(config.id);
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            updateDisplay(config.id, config.display, value, config.multiplier, config.suffix);
            send({ type: config.type, value: value });
            chrome.storage.local.set({ [config.storageKey]: value });
        });
    });

    // === TOGGLE CON RETRASO DE SEGURIDAD ===
    if (toggle) {
        toggle.addEventListener('change', async () => {
            const isEnabled = toggle.checked;
            chrome.storage.local.set({ isEnabled });

            if (isEnabled) {
                updateStatusUI(false, true); // Poner naranja visualmente
                
                // LIMPIEZA PREVENTIVA: Aseguramos que cualquier stream anterior muera
                send({ type: 'STOP_CAPTURE' });

                // PAUSA DE 100ms: Vital para que el navegador libere el audio antes de pedirlo de nuevo
                setTimeout(() => {
                    startCaptureProcess();
                }, 100);

            } else {
                if (pollingInterval) clearInterval(pollingInterval); // Matar polling
                send({ type: 'STOP_CAPTURE' });
                send({ type: 'TOGGLE_ENABLED', value: false });
                updateStatusUI(false, false);
            }
        });
    }

    // Reset Button
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
            // Forzamos el ciclo completo
            updateStatusUI(false, true);
            setTimeout(() => startCaptureProcess(), 50);
        } else {
            // Si ya estaba activo, solo hacemos polling para confirmar estado
            startPolling();
        }
    });

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'STATUS_UPDATE') {
            chrome.storage.local.get('isEnabled', (data) => {
                const currentEnabled = data.isEnabled !== false;
                if (msg.success && currentEnabled) {
                    if (pollingInterval) clearInterval(pollingInterval); // Ya llegó, paramos polling
                    updateStatusUI(true, true);
                }
            });
        }
    });
});