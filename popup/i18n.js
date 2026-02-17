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
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (currentMessages[key]) {
                el.textContent = currentMessages[key].message;
            }
        });
    },

    // Get a specific string (safe accessor)
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
        const uiLang = chrome.i18n.getUILanguage().replace('-', '_');
        return supported.includes(uiLang) ? uiLang : supported.find(l => l === uiLang.split('_')[0]) || "en";
    }
};