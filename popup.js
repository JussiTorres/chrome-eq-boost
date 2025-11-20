// popup.js

// Función genérica para obtener la pestaña activa y enviar un mensaje
function sendMessageToContent(type, value, callback = null) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: type,
                value: value !== undefined ? value.toString() : undefined
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error al enviar mensaje a content script:", chrome.runtime.lastError.message);
                    if (callback) callback(null);
                } else if (callback) {
                    callback(response);
                }
            });
        } else {
            if (callback) callback(null);
        }
    });
}

// Función para actualizar el mensaje de estado en la interfaz del popup
function updateStatusMessage(success, message, isEnabled = null) {
    const statusElement = document.getElementById('statusMessage');
    const toggle = document.getElementById('toggleEnabled');
    const allSliders = document.querySelectorAll('input[type="range"]');
    
    if (!statusElement) return;

    statusElement.textContent = message;
    
    if (success) {
        statusElement.style.color = isEnabled ? '#22c55e' : '#3b82f6';

        // Habilitar todos los controles si hay éxito (ya sea activo o inactivo)
        allSliders.forEach(slider => slider.disabled = !isEnabled);
        if (toggle) toggle.disabled = false; // MANTENER EL TOGGLE SIEMPRE HABILITADO
        
    } else {
        // Rojo para errores o inactivo. El toggle debe seguir funcionando.
        statusElement.style.color = '#ef4444'; 
        
        // Deshabilitar SOLO los sliders de volumen/EQ si hay un error
        allSliders.forEach(slider => slider.disabled = true);
        
        // *** CAMBIO CRUCIAL: MANTENER EL TOGGLE HABILITADO PARA PODER MANEJAR EL ESTADO ***
        if (toggle) toggle.disabled = false;
    }
    
    if (isEnabled !== null && toggle) {
        toggle.checked = isEnabled;
    }
}


// Función que maneja la lógica de un slider individual
function setupSlider(sliderId, displayId, messageType, storageKey) {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    
    const defaultValue = (storageKey === 'volumeLevel') ? 1.0 : 0.0;
    
    // 1. Cargar valor guardado y el estado del toggle
    chrome.storage.local.get([storageKey, 'isEnabled'], (data) => {
        const savedValue = data[storageKey] !== undefined ? parseFloat(data[storageKey]) : defaultValue;
        const isEnabled = data.isEnabled !== false;
        
        slider.value = savedValue;
        
        // El estado de 'disabled' se establecerá más tarde en updateStatusMessage
        
        // Formato de visualización
        const formatValue = (storageKey === 'volumeLevel') ? 
                            `${Math.round(savedValue * 100)}%` : 
                            `${savedValue.toFixed(1)} dB`;
        display.textContent = formatValue;
        
        sendMessageToContent(messageType, savedValue); 
    });


    // *** Listeners para cambios en los sliders ***
    slider.addEventListener('input', () => {
        const value = parseFloat(slider.value);
        
        // El sliderId debe ser usado para determinar el formato, no storageId
        const isVolume = sliderId === 'volumeSlider'; 
        const formatValue = isVolume ? 
                            `${Math.round(value * 100)}%` : 
                            `${value.toFixed(1)} dB`;
        display.textContent = formatValue;

        // Enviar valor a content.js
        sendMessageToContent(messageType, value);
    });
}


document.addEventListener('DOMContentLoaded', () => {
    // Definiciones de los sliders
    const sliderConfigs = [
        { id: 'volumeSlider', display: 'volumeValue', type: 'UPDATE_GAIN', storage: 'volumeLevel', default: 1.0 },
        { id: 'bassSlider', display: 'bassValue', type: 'UPDATE_BASS', storage: 'bassLevel', default: 0.0 },
        { id: 'midSlider', display: 'midValue', type: 'UPDATE_MID', storage: 'midLevel', default: 0.0 },
        { id: 'trebleSlider', display: 'trebleValue', type: 'UPDATE_TREBLE', storage: 'trebleLevel', default: 0.0 }
    ];

    const allSliders = sliderConfigs.map(config => document.getElementById(config.id)).filter(s => s);
    const toggle = document.getElementById('toggleEnabled');

    // 1. Configurar cada slider
    sliderConfigs.forEach(config => {
        setupSlider(config.id, config.display, config.type, config.storage);
    });


    // *** 2. Lógica del Toggle de Habilitación/Deshabilitación ***
    // Cargar estado inicial del toggle
    chrome.storage.local.get('isEnabled', (data) => {
        const isEnabled = data.isEnabled !== false;
        if(toggle) toggle.checked = isEnabled;
        
        // El estado de 'disabled' para los sliders se gestiona al final
    });


    // Listener para el cambio del toggle
    if(toggle) {
        toggle.addEventListener('change', () => {
            const isEnabled = toggle.checked;
            
            // Deshabilitar/Habilitar Sliders en el popup
            allSliders.forEach(slider => slider.disabled = !isEnabled);
            
            // Guardar estado y enviar mensaje a content.js
            chrome.storage.local.set({ 'isEnabled': isEnabled });
            sendMessageToContent('TOGGLE_ENABLED', isEnabled);

            // Actualizar mensaje de estado localmente
            const message = isEnabled ? 'Extensión lista y activa.' : 'Extensión lista y desactivada.';
            updateStatusMessage(true, message, isEnabled);
        });
    }
    

    // *** 3. Lógica del Botón de Restablecimiento ***
    document.getElementById('resetButton').addEventListener('click', () => {
        // 1. Establecer los valores predeterminados en la interfaz y en content.js
        sliderConfigs.forEach(config => {
            const slider = document.getElementById(config.id);
            const display = document.getElementById(config.display);

            // Actualizar interfaz
            slider.value = config.default;
            const formatValue = (config.id === 'volumeSlider') ? 
                                `${Math.round(config.default * 100)}%` : 
                                `${config.default} dB`;
            display.textContent = formatValue;

            // Enviar a content.js para aplicar y guardar
            sendMessageToContent(config.type, config.default);
        });
        
        // 2. Asegurar que el toggle de habilitación esté activo al resetear
        if (toggle && !toggle.checked) {
            toggle.checked = true;
            allSliders.forEach(slider => slider.disabled = false);
            chrome.storage.local.set({ 'isEnabled': true });
            sendMessageToContent('TOGGLE_ENABLED', true);
        }

        updateStatusMessage(true, 'Ajustes restablecidos a valores predeterminados.', toggle.checked);
    });

    // *** 4. Consulta de estado al Content Script al finalizar la carga ***
    setTimeout(() => {
        sendMessageToContent('GET_STATUS', undefined, (response) => {
            if (!response) {
                updateStatusMessage(false, 'Extensión inactiva: Recarga la página o asegúrate de estar en una pestaña con contenido multimedia.');
                return;
            }
            
            if (response.success) {
                updateStatusMessage(true, response.message, response.isEnabled);
            } else {
                updateStatusMessage(false, response.message);
            }
        });
    }, 100);
});