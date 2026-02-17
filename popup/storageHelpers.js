/**
 * chrome-eq-boost/popup/storageHelpers.js
 */
// storageHelpers.js
export const storage = {
    async getAll() {
        return await chrome.storage.local.get([
            "darkMode", "preferredLocale", "volumeLevel",
            "bassLevel", "midLevel", "trebleLevel",
            "isEnabled", "capturingTabId", "marqueeEnabled",
            "customThemeEnabled", "customTheme", "savedThemes",
            "activeThemeName" 
        ]);
    },

    async set(key, value) {
        // MUST return the promise for 'await' in the editor to work
        return await chrome.storage.local.set({ [key]: value });
    },

    async setMultiple(obj) {
        // MUST return the promise for 'await' in the editor to work
        return await chrome.storage.local.set(obj);
    }
};