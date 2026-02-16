import { storage } from './storageHelpers.js';

export const themeEngine = {
    init(isDark) {
        if (isDark === undefined) {
            isDark = false; // Default to Light Mode
            storage.set("darkMode", isDark);
        }
        this.apply(isDark);
        return isDark;
    },

    apply(isDark) {
        document.body.classList.toggle("dark-mode", isDark);
        // Sync the toggle switch if it exists
        const toggle = document.getElementById("darkModeToggle");
        if (toggle) toggle.checked = isDark;
    },

    // Added onThemeChange callback to refresh UI status instantly
    setupListener(onThemeChange) {
        const toggle = document.getElementById("darkModeToggle");
        if (toggle) {
            toggle.addEventListener("change", (e) => {
                const enabled = e.target.checked;
                this.apply(enabled);
                storage.set("darkMode", enabled);
                
                // Trigger the refresh if the extension is active
                if (onThemeChange) onThemeChange();
            });
        }
    }
};