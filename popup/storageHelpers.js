export const storage = {
    async getAll() {
        return await chrome.storage.local.get([
            "darkMode", "preferredLocale", "volumeLevel",
            "bassLevel", "midLevel", "trebleLevel",
            "isEnabled", "capturingTabId", "marqueeEnabled"
        ]);
    },
    
    set(key, value) {
        chrome.storage.local.set({ [key]: value });
    },
    
    // Helper for bulk updates if needed
    setMultiple(obj) {
        chrome.storage.local.set(obj);
    }
};