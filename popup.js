// popup.js - VERSIÓN ESTABLE (Fix Toggle Takeover + Startup UI)

const sliderConfigs = [
    { id: 'volumeSlider', display: 'volumeValue', type: 'UPDATE_GAIN', storageKey: 'volumeLevel', default: 1.0, multiplier: 100, suffix: '%' },
    { id: 'bassSlider', display: 'bassValue', type: 'UPDATE_BASS', storageKey: 'bassLevel', default: 0.0, multiplier: 1, suffix: ' dB' },
    { id: 'midSlider', display: 'midValue', type: 'UPDATE_MID', storageKey: 'midLevel', default: 0.0, multiplier: 1, suffix: ' dB' },
    { id: 'trebleSlider', display: 'trebleValue', type: 'UPDATE_TREBLE', storageKey: 'trebleLevel', default: 0.0, multiplier: 1, suffix: ' dB' }
];

let currentMessages = {};
let pollingInterval = null;

// === LÓGICA DE TRADUCCIÓN (i18n) ===
async function loadLanguage(locale) {
    try {
        const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
        const response = await fetch(url);
        currentMessages = await response.json();
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

function send(msg) {
    chrome.runtime.sendMessage(msg).catch(() => { });
}

function updateDisplay(sliderId, displayId, value, multiplier, suffix) {
    const display = document.getElementById(displayId);
    const numericValue = parseFloat(value) || 0;
    if (display) {
        display.textContent = (multiplier === 100)
            ? `${Math.round(numericValue * multiplier)}%`
            : `${numericValue.toFixed(1)}${suffix}`;
    }
}

function syncAudioEngine() {
    sliderConfigs.forEach(config => {
        const slider = document.getElementById(config.id);
        if (slider && !slider.disabled) {
            send({ type: config.type, value: parseFloat(slider.value) });
        }
    });
}

// === UI UPDATE ROBUSTO ===
function updateStatusUI(success, isEnabled, hasAudio = false) {
    const status = document.getElementById('statusMessage');
    const sliders = document.querySelectorAll('input[type="range"]');
    const toggle = document.getElementById('toggleEnabled');
    const toggleLabel = document.querySelector('.toggle-label');

    // === NUEVO: Referencia al botón de reset ===
    const resetBtn = document.getElementById('resetButton');

    // SIEMPRE visible. Nunca display: none.
    status.style.display = 'block';

    if (toggle) toggle.checked = isEnabled;

    // --- CASO 1: APAGADO ---
    if (!isEnabled) {
        const disabledMsg = currentMessages.status_disabled ? currentMessages.status_disabled.message : "Extension disabled.";
        status.textContent = disabledMsg;
        status.style.color = '#9ca3af'; // Gris

        if (toggleLabel) {
            toggleLabel.textContent = disabledMsg.replace(/\.$/, "");
            toggleLabel.style.color = "#6b7280";
        }
        sliders.forEach(s => s.disabled = true);

        // === NUEVO: Bloquear el botón de reset ===
        if (resetBtn) resetBtn.disabled = true;

        return;
    }

    // --- CASO 2: ENCENDIDO ---
    const conflictPanel = document.getElementById('tabConflictPanel');

    // Si no hay conflicto visible, habilitamos todo
    if (conflictPanel.style.display === 'none') {
        sliders.forEach(s => s.disabled = false);
        // === NUEVO: Habilitar el botón de reset ===
        if (resetBtn) resetBtn.disabled = false;
    }

    if (toggleLabel) {
        toggleLabel.textContent = currentMessages.toggle_label ? currentMessages.toggle_label.message : "Extension Enabled";
        toggleLabel.style.color = "#1e3a8a"; // Azul
    }

    if (success) {
        if (hasAudio) {
            // VERDE: Todo perfecto
            status.textContent = currentMessages.status_active ? currentMessages.status_active.message : "Equalizer Active";
            status.style.color = '#22c55e';
        } else {
            // NARANJA: Conectado pero silencio
            const waitMsg = currentMessages.status_waiting ? currentMessages.status_waiting.message : "Waiting for audio...";
            status.textContent = waitMsg;
            status.style.color = '#f59e0b';
        }
    } else {
        // AZUL/NARANJA: Inicializando o Fallo Ping
        const initMsg = currentMessages.status_loading ? currentMessages.status_loading.message : "Initializing...";
        status.textContent = initMsg;
        status.style.color = '#3b82f6';
    }
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    let attempts = 0;

    pollingInterval = setInterval(() => {
        attempts++;
        chrome.runtime.sendMessage({ type: 'TARGET_OFFSCREEN_PING' }, (response) => {

            // === NUEVO: DETECTOR DE MUERTE EN VIVO ===
            // Si hay error, no hay respuesta, o la respuesta dice "no success"...
            if (chrome.runtime.lastError || !response || !response.success) {

                // Solo actuamos si ya pasaron los primeros segundos (para evitar falsos positivos al arrancar)
                if (attempts > 2) {
                    console.log("El audio dejó de responder en vivo (Muerte Súbita). Apagando...");

                    // 1. Detenemos el monitoreo
                    clearInterval(pollingInterval);

                    // 2. Limpiamos la memoria para que al reabrir esté correcto
                    chrome.storage.local.set({ isEnabled: false, capturingTabId: null });

                    // 3. Apagamos la UI en tu cara
                    const toggle = document.getElementById('toggleEnabled');
                    if (toggle) toggle.checked = false;
                    updateStatusUI(false, false);
                }
                return;
            }

            // === SI ESTÁ VIVO ===
            // Actualizamos si está "Waiting..." o "Active" según si detecta sonido
            updateStatusUI(true, true, response.audioDetected);

            // Sincronizamos sliders al inicio por si acaso
            if (attempts < 3) syncAudioEngine();
        });
    }, 1000); // Revisa cada 1 segundo
}

async function startCaptureProcess() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // UI Feedback inmediato
    updateStatusUI(false, true);
    startPolling();

    chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId: tab.id });
}

// === INICIO ===
document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('toggleEnabled');
    const conflictPanel = document.getElementById('tabConflictPanel');
    const takeOverBtn = document.getElementById('takeOverBtn');

    // Settings UI
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const languageSelect = document.getElementById('languageSelect');

    settingsBtn.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
    closeSettingsBtn.addEventListener('click', () => settingsPanel.classList.add('hidden'));

    // Datos Iniciales
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const data = await chrome.storage.local.get(['volumeLevel', 'bassLevel', 'midLevel', 'trebleLevel', 'isEnabled', 'capturingTabId', 'preferredLocale']);

    // Idioma
    const savedLocale = data.preferredLocale || 'en';
    if (languageSelect) {
        languageSelect.value = savedLocale;
        languageSelect.addEventListener('change', async (e) => {
            const newLocale = e.target.value;
            chrome.storage.local.set({ preferredLocale: newLocale });
            await loadLanguage(newLocale);

            // Refrescar estado visual
            const isEnabled = toggle.checked;
            if (isEnabled) {
                chrome.runtime.sendMessage({ type: 'TARGET_OFFSCREEN_PING' }, (r) => {
                    updateStatusUI(r?.success, true, r?.audioDetected);
                });
            } else {
                updateStatusUI(false, false);
            }
        });
    }
    await loadLanguage(savedLocale);

    const savedTabId = data.capturingTabId;
    const isEnabledGlobal = data.isEnabled !== false;

    // Cargar Sliders
    sliderConfigs.forEach(config => {
        const saved = data[config.storageKey] ?? config.default;
        const slider = document.getElementById(config.id);
        slider.value = saved;
        updateDisplay(config.id, config.display, saved, config.multiplier, config.suffix);

        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            updateDisplay(config.id, config.display, val, config.multiplier, config.suffix);
            send({ type: config.type, value: val });
            chrome.storage.local.set({ [config.storageKey]: val });
        });
    });

    // === LÓGICA DE CONFLICTO Y TAKEOVER ===
    // Verificar si realmente hay conflicto (haciendo Ping)
    let isConflict = false;
    if (isEnabledGlobal && savedTabId && savedTabId !== currentTab.id) {
        // Hacemos ping para ver si la OTRA pestaña sigue viva
        chrome.runtime.sendMessage({ type: 'TARGET_OFFSCREEN_PING' }, (response) => {
            if (response && response.success) {
                // CONFLICTO REAL
                isConflict = true;
                conflictPanel.style.display = 'block';
                toggle.checked = false;

                const toggleLabel = document.querySelector('.toggle-label');
                if (toggleLabel) {
                    toggleLabel.textContent = currentMessages.status_disabled ? currentMessages.status_disabled.message.replace(/\.$/, "") : "Disabled";
                    toggleLabel.style.color = "#6b7280";
                }

                document.getElementById('statusMessage').textContent = currentMessages.status_conflict ? currentMessages.status_conflict.message : "Controlling another tab";

                // Bloqueamos los sliders
                document.querySelectorAll('input[type="range"]').forEach(s => s.disabled = true);

                // === NUEVO: Bloquear TAMBIÉN el botón de reset en modo conflicto ===
                document.getElementById('resetButton').disabled = true;
                // ==================================================================

                // Configurar Botón Amarillo
                takeOverBtn.onclick = performTakeOver;

            } else {
                // CONFLICTO FANTASMA (Chrome mató el audio anterior) -> Limpieza
                console.log("Ghost state detectado. Limpiando...");
                chrome.storage.local.set({ isEnabled: false, capturingTabId: null });
                conflictPanel.style.display = 'none';
                updateStatusUI(false, false);
            }
        });
    } else {
        // === MODO NORMAL (Pestaña Original) ===

        if (isEnabledGlobal) {
            // La memoria dice "ON", pero somos desconfiados.
            // 1. Mostramos "Initializing..." brevemente mientras verificamos.
            updateStatusUI(false, true);

            // 2. VERIFICACIÓN DE VIDA (Ping)
            chrome.runtime.sendMessage({ type: 'TARGET_OFFSCREEN_PING' }, (response) => {
                if (chrome.runtime.lastError || !response || !response.success) {
                    // === GHOST DETECTADO 👻 ===
                    // Chrome mató el audio mientras no mirábamos.
                    console.log("Audio muerto detectado al abrir. Reseteando a OFF.");

                    // Limpieza inmediata
                    chrome.storage.local.set({ isEnabled: false, capturingTabId: null });

                    // Apagamos la UI en la cara del usuario
                    toggle.checked = false;
                    updateStatusUI(false, false);

                } else {
                    // === ESTADO REAL ===
                    // El audio sigue vivo. Todo correcto.
                    // Iniciamos el monitoreo constante
                    updateStatusUI(true, true, response.audioDetected);
                    startPolling();
                }
            });
        } else {
            // Estaba apagado en memoria. Todo normal.
            updateStatusUI(false, false);
        }
    }

    // === FUNCIÓN TAKEOVER CENTRALIZADA ===
    function performTakeOver() {
        conflictPanel.style.display = 'none';
        document.querySelectorAll('input[type="range"]').forEach(s => s.disabled = false);

        // === NUEVO: Desbloquear botón al tomar control ===
        document.getElementById('resetButton').disabled = false;
        // =================================================

        // 1. Detener el anterior
        send({ type: 'STOP_CAPTURE' });

        // 2. Esperar un poco y arrancar el nuevo
        setTimeout(() => {
            toggle.checked = true;
            chrome.storage.local.set({ isEnabled: true });
            startCaptureProcess();
        }, 200);
    }

    // === TOGGLE LISTENER (EL ARREGLO PRINCIPAL) ===
    if (toggle) {
        toggle.addEventListener('change', () => {
            const wantsToEnable = toggle.checked;

            if (wantsToEnable) {
                // El usuario encendió el interruptor.
                // ¿Hay un conflicto activo (otra pestaña dueña)?
                if (conflictPanel.style.display === 'block') {
                    // SI: Actuar como "Take Over"
                    performTakeOver();
                } else {
                    // NO: Encendido normal
                    chrome.storage.local.set({ isEnabled: true });
                    send({ type: 'STOP_CAPTURE' }); // Seguridad
                    setTimeout(() => startCaptureProcess(), 100);
                }
            } else {
                // El usuario apagó el interruptor
                if (pollingInterval) clearInterval(pollingInterval);
                conflictPanel.style.display = 'none';
                send({ type: 'STOP_CAPTURE' });
                send({ type: 'TOGGLE_ENABLED', value: false });
                updateStatusUI(false, false);
                chrome.storage.local.set({ isEnabled: false });
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
    });

    // Listener para apagado automático desde Service Worker
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.isEnabled) {
            const isNowEnabled = changes.isEnabled.newValue;
            if (toggle) {
                toggle.checked = isNowEnabled;
                updateStatusUI(isNowEnabled, isNowEnabled);
            }
            if (!isNowEnabled && pollingInterval) clearInterval(pollingInterval);
        }
    });
});