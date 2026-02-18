/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

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