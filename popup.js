// popup.js - VERSIÓN 1.2.2 (Multilenguaje + Audio Sync Fix)

const sliderConfigs = [
    { id: 'volumeSlider', display: 'volumeValue', type: 'UPDATE_GAIN', storageKey: 'volumeLevel', default: 1.0, multiplier: 100, suffix: '%' },
    { id: 'bassSlider', display: 'bassValue', type: 'UPDATE_BASS', storageKey: 'bassLevel', default: 0.0, multiplier: 1, suffix: ' dB' },
    { id: 'midSlider', display: 'midValue', type: 'UPDATE_MID', storageKey: 'midLevel', default: 0.0, multiplier: 1, suffix: ' dB' },
    { id: 'trebleSlider', display: 'trebleValue', type: 'UPDATE_TREBLE', storageKey: 'trebleLevel', default: 0.0, multiplier: 1, suffix: ' dB' }
];

// === LÓGICA DE TRADUCCIÓN (i18n) ===
let currentMessages = {};

async function loadLanguage(locale) {
    try {
        // Usamos getURL para obtener la ruta absoluta dentro de la extensión
        const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
        const response = await fetch(url);
        const messages = await response.json();
        currentMessages = messages;
        applyTranslations();
    } catch (e) {
        console.error("Error cargando idioma:", e);
    }
}

function applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (currentMessages[key]) {
            el.textContent = currentMessages[key].message;
        }
    });
}
// ====================================

function send(msg) {
    chrome.runtime.sendMessage(msg).catch(() => { });
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

// Función: Forzar envío de valores al motor de audio
function syncAudioEngine() {
    sliderConfigs.forEach(config => {
        const slider = document.getElementById(config.id);
        if (slider && !slider.disabled) {
            send({ type: config.type, value: parseFloat(slider.value) });
        }
    });
    console.log("Audio sincronizado con UI");
}

function updateStatusUI(success, isEnabled) {
    const status = document.getElementById('statusMessage');
    const sliders = document.querySelectorAll('input[type="range"]');
    const toggle = document.getElementById('toggleEnabled');

    if (toggle) toggle.checked = isEnabled;

    if (!isEnabled) {
        // Usamos la traducción si está disponible, si no un fallback
        status.textContent = currentMessages.status_disabled ? currentMessages.status_disabled.message : "Extensión desactivada.";
        status.style.color = '#9ca3af';
        sliders.forEach(s => s.disabled = true);
        return;
    }

    const conflictPanel = document.getElementById('tabConflictPanel');
    if (conflictPanel.style.display === 'none') {
        sliders.forEach(s => s.disabled = false);
    }

    if (success) {
        status.textContent = currentMessages.status_active ? currentMessages.status_active.message : "Ecualizador Activo";
        status.style.color = '#22c55e';
    } else {
        const activeMsg = currentMessages.status_active ? currentMessages.status_active.message : "Ecualizador Activo";
        if (status.textContent !== activeMsg) {
            status.textContent = currentMessages.status_waiting ? currentMessages.status_waiting.message : "Captura iniciada. Esperando audio...";
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
                syncAudioEngine();
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

    // Elementos de Settings
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const languageSelect = document.getElementById('languageSelect');

    // Listeners del Panel de Configuración
    settingsBtn.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
    closeSettingsBtn.addEventListener('click', () => settingsPanel.classList.add('hidden'));

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Recuperamos también 'preferredLocale'
    const data = await chrome.storage.local.get(['volumeLevel', 'bassLevel', 'midLevel', 'trebleLevel', 'isEnabled', 'capturingTabId', 'preferredLocale']);

    // === INICIALIZAR IDIOMA ===
    const savedLocale = data.preferredLocale || 'en';
    if (languageSelect) {
        languageSelect.value = savedLocale;

        // Listener para cambio de idioma en tiempo real
        languageSelect.addEventListener('change', async (e) => {
            const newLocale = e.target.value;
            chrome.storage.local.set({ preferredLocale: newLocale });

            // 1. Cargar el nuevo idioma (esto pondrá "Inicializando..." por un milisegundo)
            await loadLanguage(newLocale);

            // 2. CORRECCIÓN: Forzar actualización inmediata del estado visual
            // Preguntamos al Toggle si está prendido
            const isEnabled = document.getElementById('toggleEnabled').checked;

            // Si está prendido, preguntamos al motor si el audio fluye
            if (isEnabled) {
                chrome.runtime.sendMessage({ type: 'TARGET_OFFSCREEN_PING' }, (response) => {
                    const success = response && response.success;
                    updateStatusUI(success, true); // Esto corregirá el texto a "Activo"
                });
            } else {
                // Si está apagado, simplemente actualizamos a "Desactivado" en el nuevo idioma
                updateStatusUI(false, false);
            }
        });
    }

    // Cargar traducciones iniciales
    await loadLanguage(savedLocale);
    // ==========================

    const savedTabId = data.capturingTabId;
    const isEnabledGlobal = data.isEnabled !== false;

    // Cargar sliders visualmente
    sliderConfigs.forEach(config => {
        const saved = data[config.storageKey] ?? config.default;
        const slider = document.getElementById(config.id);
        slider.value = saved;
        updateDisplay(config.id, config.display, saved, config.multiplier, config.suffix);
    });

    // Lógica de Conflicto
    if (isEnabledGlobal && savedTabId && savedTabId !== currentTab.id) {
        conflictPanel.style.display = 'block';
        toggle.checked = false;
        
        // === CORRECCIÓN AQUÍ ===
        // Usamos la nueva clave "status_conflict" ("Controlando otra pestaña")
        document.getElementById('statusMessage').textContent = currentMessages.status_conflict ? currentMessages.status_conflict.message : "Controlling another tab";
        // =======================

        document.querySelectorAll('input[type="range"]').forEach(s => s.disabled = true);
        document.getElementById('resetButton').disabled = true;

        // ... resto del código ...
        takeOverBtn.addEventListener('click', () => {
            conflictPanel.style.display = 'none';
            document.querySelectorAll('input[type="range"]').forEach(s => s.disabled = false);
            document.getElementById('resetButton').disabled = false;

            send({ type: 'STOP_CAPTURE' });
            setTimeout(() => {
                toggle.checked = true;
                chrome.storage.local.set({ isEnabled: true });
                startCaptureProcess();
            }, 200);
        });

    } else {
        if (toggle) toggle.checked = isEnabledGlobal;

        if (isEnabledGlobal) {
            chrome.runtime.sendMessage({ type: 'TARGET_OFFSCREEN_PING' }, (response) => {
                if (response && response.success) {
                    updateStatusUI(true, true);
                    // Opcional: syncAudioEngine();
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
            document.querySelectorAll('input[type="range"]').forEach(s => s.disabled = false);
            chrome.storage.local.set({ isEnabled: true });
            updateStatusUI(false, true);
            setTimeout(() => startCaptureProcess(), 50);
        } else {
            syncAudioEngine();
        }
    });

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'STATUS_UPDATE') {
            chrome.storage.local.get('isEnabled', (data) => {
                const currentEnabled = data.isEnabled !== false;
                if (msg.success && currentEnabled) {
                    if (pollingInterval) clearInterval(pollingInterval);
                    updateStatusUI(true, true);
                    syncAudioEngine();
                }
            });
        }
    });
});