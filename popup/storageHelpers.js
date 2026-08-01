/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

export const storage = {
    async getAll() {
        // Al pasar 'null', Chrome devuelve TODAS las llaves guardadas.
        // Así nunca más olvidarás agregar una variable a la lista.
        return await chrome.storage.local.get(null);
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