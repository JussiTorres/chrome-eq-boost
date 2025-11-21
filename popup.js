// popup.js - GESTIÓN DE VENTANAS PERFECCIONADA

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

    // Solo habilitamos sliders si NO estamos en modo conflicto (ver lógica abajo)
    const conflictPanel = document.getElementById('tabConflictPanel');
    if (conflictPanel.style.display === 'none') {
        sliders.forEach(s => s.disabled = false);
    }

    if (success) {
        status.textContent = "Ecualizador Activo";
        status.style.color = '#22c55e'; 
    } else {
        if (status.textContent !== "Ecualizador Activo") {
            status.textContent = "Captura iniciada. Esperando audio...";
            status.style.color = '#f59e0b'; 
        }
    }
}

let pollingInterval = null;

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    let attempts = 0;
    
    pollingInterval = setInterval(() => {
        attempts++;
        chrome.runtime.sendMessage({ type: 'TARGET_OFFSCREEN_PING' }, (response) => {
            if (chrome.runtime.lastError || !response) return;
            if (response.success === true) {
                clearInterval(pollingInterval);
                pollingInterval = null;
                updateStatusUI(true, true);
            } 
        });
        if (attempts >= 40) clearInterval(pollingInterval);
    }, 500);
}

async function startCaptureProcess() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    updateStatusUI(false, true); 
    startPolling();

    chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId: tab.id });
}

document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('toggleEnabled');
    const conflictPanel = document.getElementById('tabConflictPanel');
    const takeOverBtn = document.getElementById('takeOverBtn');

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const data = await chrome.storage.local.get(['volumeLevel', 'bassLevel', 'midLevel', 'trebleLevel', 'isEnabled', 'capturingTabId']);
    
    const savedTabId = data.capturingTabId;
    const isEnabledGlobal = data.isEnabled !== false;

    // === CAMBIO CLAVE: Cargar sliders SIEMPRE al inicio ===
    sliderConfigs.forEach(config => {
        const saved = data[config.storageKey] ?? config.default;
        const slider = document.getElementById(config.id);
        slider.value = saved;
        updateDisplay(config.id, config.display, saved, config.multiplier, config.suffix);
    });
    // ======================================================

    // Lógica de Conflicto
    if (isEnabledGlobal && savedTabId && savedTabId !== currentTab.id) {
        // MODO CONFLICTO
        conflictPanel.style.display = 'block';
        toggle.checked = false; 
        document.getElementById('statusMessage').textContent = "Controlando otra pestaña";
        
        // Deshabilitar sliders visualmente
        document.querySelectorAll('input[type="range"]').forEach(s => s.disabled = true);
        
        takeOverBtn.addEventListener('click', () => {
            conflictPanel.style.display = 'none';
            
            // === CAMBIO: Habilitar sliders INMEDIATAMENTE al tomar control ===
            document.querySelectorAll('input[type="range"]').forEach(s => s.disabled = false);
            // ================================================================

            send({ type: 'STOP_CAPTURE' });
            
            setTimeout(() => {
                toggle.checked = true;
                chrome.storage.local.set({ isEnabled: true });
                startCaptureProcess();
            }, 200);
        });

    } else {
        // MODO NORMAL
        if (toggle) toggle.checked = isEnabledGlobal;

        if (isEnabledGlobal) {
            chrome.runtime.sendMessage({ type: 'TARGET_OFFSCREEN_PING' }, (response) => {
                if (response && response.success) {
                    updateStatusUI(true, true);
                } else {
                    startCaptureProcess();
                }
            });
        } else {
            updateStatusUI(false, false);
        }
    }

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

    // Toggle Listener
    if (toggle) {
        toggle.addEventListener('change', async () => {
            const isEnabled = toggle.checked;
            
            if (isEnabled) conflictPanel.style.display = 'none';

            chrome.storage.local.set({ isEnabled });

            if (isEnabled) {
                updateStatusUI(false, true); 
                send({ type: 'STOP_CAPTURE' });
                setTimeout(() => startCaptureProcess(), 100);
            } else {
                if (pollingInterval) clearInterval(pollingInterval);
                send({ type: 'STOP_CAPTURE' });
                send({ type: 'TOGGLE_ENABLED', value: false });
                updateStatusUI(false, false);
            }
        });
    }

    // Reset Listener
    document.getElementById('resetButton').addEventListener('click', () => {
        sliderConfigs.forEach(config => {
             const slider = document.getElementById(config.id);
             slider.value = config.default;
             updateDisplay(config.id, config.display, config.default, config.multiplier, config.suffix);
             send({ type: config.type, value: config.default });
             chrome.storage.local.set({ [config.storageKey]: config.default });
         });
         
         if (!toggle.checked) {
             conflictPanel.style.display = 'none';
             toggle.checked = true;
             // Asegurar que se habiliten al resetear
             document.querySelectorAll('input[type="range"]').forEach(s => s.disabled = false);
             
             chrome.storage.local.set({ isEnabled: true });
             updateStatusUI(false, true);
             setTimeout(() => startCaptureProcess(), 50);
         }
    });

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'STATUS_UPDATE') {
            chrome.storage.local.get('isEnabled', (data) => {
                const currentEnabled = data.isEnabled !== false;
                if (msg.success && currentEnabled) {
                    if (pollingInterval) clearInterval(pollingInterval);
                    updateStatusUI(true, true);
                }
            });
        }
    });
});