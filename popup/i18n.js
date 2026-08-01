/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

let currentMessages = {};

export const i18n = {
    async load(locale) {
        try {
            const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
            const response = await fetch(url);
            currentMessages = await response.json();

            // --- FUSED RTL ENGINE CONFIGURATION ---
            // Handles native text layout direction changes dynamically without structural regressions
            const rtlLocales = ["ar", "he", "fa", "ur"];
            document.documentElement.lang = locale;
            document.documentElement.dir = rtlLocales.includes(locale) ? "rtl" : "ltr";

            this.apply();
        } catch (e) {
            console.error("Error loading language:", e);
        }
    },

    apply() {
        // 1. Standard Text Content
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (currentMessages[key]) {
                el.textContent = currentMessages[key].message;
            }
        });

        // 2. Input Placeholders (Added for Theme Editor)
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            if (currentMessages[key]) {
                el.setAttribute("placeholder", currentMessages[key].message);
            }
        });

        // 3. UI Titles/Tooltips
        document.querySelectorAll("[data-i18n-title]").forEach(el => {
            const key = el.getAttribute("data-i18n-title");
            if (currentMessages[key]) {
                el.setAttribute("title", currentMessages[key].message);
            }
        });

        // 4. Accessibility Aria-Labels
        document.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
            const key = el.getAttribute("data-i18n-aria-label");
            if (currentMessages[key]) {
                el.setAttribute("aria-label", currentMessages[key].message);
            }
        });
    },

    // Get a specific string (safe accessor for JS-driven UI logic)
    t(key) {
        return currentMessages[key] ? currentMessages[key].message : "";
    },

    getPresetName(key) {
        if (!key) return "";

        // 1. Clean the key to match your messages.json format
        const cleanKey = key
            .toLowerCase()
            .replace(/[&/]/g, "")       // Strips '&' and '/'
            .replace(/[^a-z0-9]/g, "_") // Replaces symbols/spaces with '_'
            .replace(/_+/g, "_")        // Collapses multiple underscores
            .replace(/_$/, "");         // Trims trailing underscore

        const i18nKey = "preset_" + cleanKey;

        // 2. Look up in dictionary. 
        // - Built-in presets will match and return translated strings (e.g., "Refuerzo de Voz").
        // - User-saved presets will NOT match and safely return the raw key (e.g., "My Custom Mix").
        return currentMessages[i18nKey] ? currentMessages[i18nKey].message : key;
    },

    // Auto-detect logic
    detectLocale(savedLocale) {
        if (savedLocale) return savedLocale;

        // FUSED: Includes your full stable production locale targets
        const supported = [
            "en", "es", "pt_BR", "de", "fr", "it", "pl", "ru", "uk", "tr",
            "id", "ja", "ko", "hi", "zh_CN", "zh_TW",
            "th", "vi", "fil", "km", "lt", "nl",
            "fi", "sv", "ar", "fa", "he", "ur"
        ];
        // Match browser language to supported extension locales
        const uiLang = chrome.i18n.getUILanguage().replace('-', '_');
        return supported.includes(uiLang) ? uiLang : supported.find(l => l === uiLang.split('_')[0]) || "en";
    }
};