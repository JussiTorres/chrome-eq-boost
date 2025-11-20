// A persistent object to hold our audio nodes and state
const audioState = {
    context: null,
    source: null,
    gainNode: null,
    compressorNode: null, 
    mediaElement: null,
    bassFilter: null,
    midFilter: null,
    trebleFilter: null
};

// --- CONSTANTES PARA EL REINTENTO DE INICIALIZACIÓN ---
const MAX_RETRIES = 10; // Intentará hasta 10 veces
const RETRY_DELAY_MS = 500; // Esperará 500ms entre cada intento
let retryCount = 0;
// --------------------------------------------------------


// Función para reanudar el AudioContext al interactuar con el usuario (necesario en Chrome)
function resumeContextOnInteraction() {
    if (audioState.context && audioState.context.state === 'suspended') {
        audioState.context.resume();
        console.log("AudioContext resumed due to user interaction.");
    }
}

// Escuchar un clic en cualquier parte del documento
document.addEventListener('click', resumeContextOnInteraction, { once: true });


// Función para crear nodos de filtro Biquad
function createFilter(type, frequency, gain = 0.0) {
    const filter = audioState.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, audioState.context.currentTime);
    filter.gain.setValueAtTime(gain, audioState.context.currentTime);
    if (type === 'peaking') {
        filter.Q.setValueAtTime(1.0, audioState.context.currentTime);
    }
    return filter;
}

// --------------------------------------------------------------------
// Función clave: Conecta o desconecta la cadena de EQ (Bypass)
// --------------------------------------------------------------------
function bypassAudioGraph(isEnabled) {
    if (!audioState.source || !audioState.context || !audioState.compressorNode) {
        console.warn("Audio Boost Extension: Grafo de audio no inicializado. No se puede hacer bypass.");
        return;
    }

    // 1. Desconectar todo primero para asegurar un estado limpio
    audioState.source.disconnect();
    
    // Desconectar los filtros de la cadena
    audioState.gainNode.disconnect();
    audioState.compressorNode.disconnect();

    if (isEnabled) {
        // 2. Modo EQ Habilitado (Conectar la cadena de procesamiento)
        audioState.source
            .connect(audioState.bassFilter)
            .connect(audioState.midFilter)
            .connect(audioState.trebleFilter)
            .connect(audioState.gainNode)
            .connect(audioState.compressorNode)
            .connect(audioState.context.destination);
        
        console.log("Audio Boost Extension: EQ Habilitado.");
    } else {
        // 3. Modo Bypass (Conexión directa)
        audioState.source.connect(audioState.context.destination);
        console.log("Audio Boost Extension: EQ Deshabilitado (Bypass).");
    }
}


// --------------------------------------------------------------------
// Función de inicialización central con reporte de estado
// --------------------------------------------------------------------
function initAudioGraph(loadSettings = true) {
    // 1. Buscar elemento multimedia
    const mediaElement = document.querySelector('video') || document.querySelector('audio');
    
    if (!mediaElement) {
        // Si no se encuentra, retorna el estado de fallo
        return { success: false, message: "Grafo inactivo: No se encontró media (<video>/<audio>)." };
    }

    // 2. Prevenir doble inicialización
    if (audioState.context) {
        return { 
            success: true, 
            message: "Grafo de audio activo.",
            isEnabled: audioState.source.isConnected(audioState.bassFilter)
        };
    }
    
    console.log("Audio Boost Extension: Inicializando Grafo de Audio...");

    try {
        // 3. Setup Context
        audioState.context = new (window.AudioContext || window.webkitAudioContext)();
        audioState.mediaElement = mediaElement;

        // 4. Create Source Node
        audioState.source = audioState.context.createMediaElementSource(mediaElement);
        
        // 5. Create EQ Filters
        audioState.bassFilter = createFilter('lowshelf', 100);
        audioState.midFilter = createFilter('peaking', 1000);
        audioState.trebleFilter = createFilter('highshelf', 8000);

        // 6. Create Gain (Preamp)
        audioState.gainNode = audioState.context.createGain();

        // 7. Create Compressor (Limiter)
        audioState.compressorNode = audioState.context.createDynamicsCompressor();
        audioState.compressorNode.threshold.setValueAtTime(-6, audioState.context.currentTime); 
        audioState.compressorNode.ratio.setValueAtTime(20, audioState.context.currentTime);

        // 8. Load saved settings and connect the chain
        if (loadSettings) {
            loadSavedSettings();
        }

        // Por defecto, conectar la cadena completa hasta que se carguen las settings
        audioState.source
            .connect(audioState.bassFilter)
            .connect(audioState.midFilter)
            .connect(audioState.trebleFilter)
            .connect(audioState.gainNode)
            .connect(audioState.compressorNode)
            .connect(audioState.context.destination);

        return { success: true, message: "Grafo de audio activo.", isEnabled: true };
    } catch (e) {
        console.error("Audio Boost Extension: Error al inicializar el AudioGraph:", e);
        return { success: false, message: `Error al iniciar el audio: ${e.message}` };
    }
}


// Función para cargar los valores de EQ y volumen desde el almacenamiento
function loadSavedSettings() {
    chrome.storage.local.get(['bassLevel', 'midLevel', 'trebleLevel', 'volumeLevel', 'isEnabled'], (data) => {
        
        const isEnabled = data.isEnabled !== false; // Default is true

        if (audioState.bassFilter) {
            audioState.bassFilter.gain.value = parseFloat(data.bassLevel || 0.0);
            audioState.midFilter.gain.value = parseFloat(data.midLevel || 0.0);
            audioState.trebleFilter.gain.value = parseFloat(data.trebleLevel || 0.0);
        }
        if (audioState.gainNode) {
            audioState.gainNode.gain.value = parseFloat(data.volumeLevel || 1.0);
        }

        // Aplicar el estado de habilitado/deshabilitado
        bypassAudioGraph(isEnabled);
        
        console.log("Audio Boost Extension: Ajustes cargados y aplicados.");
    });
}

// --------------------------------------------------------------------
// *** NUEVA FUNCIÓN: REINTENTO ASÍNCRONO PARA ESTABILIDAD ***
// --------------------------------------------------------------------
function retryInitAudioGraph() {
    const status = initAudioGraph();

    if (status.success) {
        console.log("Audio Boost Extension: Inicialización completada (Intento: " + (retryCount + 1) + ")");
        // Si tiene éxito, restablecer el contador de reintentos
        retryCount = 0;
        return; 
    }

    if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.warn(`Audio Boost Extension: No se encontró media. Reintentando en ${RETRY_DELAY_MS}ms. Intento ${retryCount}/${MAX_RETRIES}`);
        
        // Usar setTimeout para reintentar de forma asíncrona
        setTimeout(retryInitAudioGraph, RETRY_DELAY_MS);
    } else {
        console.error("Audio Boost Extension: Máximo de reintentos alcanzado. El grafo no pudo inicializarse.");
        // El script se detiene aquí y el popup mostrará el estado "inactivo"
    }
}


// *** Communication Listener (Mensajería desde el Popup) ***

chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        const newValue = request.value;

        switch (request.type) {
            case "GET_STATUS":
                // Corregido: Ahora se llama a initAudioGraph, que también intentará encontrar el medio
                // si no estaba inicializado (es decir, actuará como un intento más).
                const statusResult = initAudioGraph(false); 
                
                // Si la inicialización fue exitosa, verificar el estado de conexión
                if (statusResult.success && audioState.source) {
                    statusResult.isEnabled = audioState.source.isConnected(audioState.bassFilter);
                }

                sendResponse(statusResult);
                return true; // Indica que la respuesta será asíncrona

            case "UPDATE_GAIN":
                if (audioState.gainNode) {
                    audioState.gainNode.gain.value = parseFloat(newValue);
                    chrome.storage.local.set({ 'volumeLevel': newValue });
                }
                break;

            case "UPDATE_BASS":
                if (audioState.bassFilter) {
                    audioState.bassFilter.gain.value = parseFloat(newValue);
                    chrome.storage.local.set({ 'bassLevel': newValue });
                }
                break;

            case "UPDATE_MID":
                if (audioState.midFilter) {
                    audioState.midFilter.gain.value = parseFloat(newValue);
                    chrome.storage.local.set({ 'midLevel': newValue });
                }
                break;

            case "UPDATE_TREBLE":
                if (audioState.trebleFilter) {
                    audioState.trebleFilter.gain.value = parseFloat(newValue);
                    chrome.storage.local.set({ 'trebleLevel': newValue });
                }
                break;
            
            case "TOGGLE_ENABLED":
                // El valor es un string 'true' o 'false'
                const isEnabled = newValue === 'true';
                bypassAudioGraph(isEnabled);
                chrome.storage.local.set({ 'isEnabled': isEnabled });
                break;
        }
    }
);

// --------------------------------------------------------------------
// *** LLAMADA DE INICIO (USANDO REINTENTO) ***
// --------------------------------------------------------------------
retryInitAudioGraph();