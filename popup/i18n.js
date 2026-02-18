/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025 Jussi Torres
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

    // Auto-detect logic
    detectLocale(savedLocale) {
        if (savedLocale) return savedLocale;

        const supported = [
            "en", "es", "pt_BR", "de", "fr", "it", "pl", "ru", "uk", "tr",
            "id", "ja", "ko", "hi", "zh_CN", "zh_TW",
            "th", "vi", "fil", "km", "lt", "nl"
        ];
        // Match browser language to supported extension locales
        const uiLang = chrome.i18n.getUILanguage().replace('-', '_');
        return supported.includes(uiLang) ? uiLang : supported.find(l => l === uiLang.split('_')[0]) || "en";
    }
};