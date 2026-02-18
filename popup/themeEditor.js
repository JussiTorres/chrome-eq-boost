/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

import { storage } from './storageHelpers.js';
import { themeEngine } from './themeEngine.js';
import { PRESET_THEMES } from './constants.js';
import { i18n } from './i18n.js'; //

let currentCustomTheme = {};
let originalThemeState = ""; // The "Brain" baseline for comparison
let libraryThemes = {};      // Cached library for fast UI sync

export const themeEditor = {
    async init() {
        const els = this.getElements();
        const data = await storage.getAll();

        // 1. SEEDING LOGIC
        let savedThemes = data.savedThemes || {};
        let needsUpdate = false;
        Object.keys(PRESET_THEMES).forEach(name => {
            if (!savedThemes[name]) {
                const preset = PRESET_THEMES[name];
                savedThemes[name] = { ...preset, textPrimary: preset.accentColor };
                needsUpdate = true;
            }
        });
        if (needsUpdate) await storage.set("savedThemes", savedThemes);
        libraryThemes = savedThemes;

        // 2. STRENGTHENED LOAD STATE
        currentCustomTheme = data.customTheme || libraryThemes["Crimson Abyss"] || {
            bgBody: '#f7f9fb', bgCard: '#ffffff', accentColor: '#3b82f6', textPrimary: '#3b82f6'
        };
        const isCustom = data.customThemeEnabled || false;

        // 3. SET BASELINE
        originalThemeState = JSON.stringify(this.normalizeTheme(currentCustomTheme));

        // 4. SETUP UI STATE
        if (els.customToggle) els.customToggle.checked = isCustom;
        if (isCustom && els.editBtn) els.editBtn.classList.remove("hidden");

        this.updatePickerUI(currentCustomTheme);
        await this.refreshThemeList(els.select);

        // 5. DROPDOWN SYNC (Prioritize the stored name, but verify integrity)
        if (data.activeThemeName && libraryThemes[data.activeThemeName]) {
            const storedThemeJson = JSON.stringify(this.normalizeTheme(libraryThemes[data.activeThemeName]));
            const currentJson = JSON.stringify(this.normalizeTheme(currentCustomTheme));

            if (storedThemeJson === currentJson) {
                els.select.value = data.activeThemeName;
            }
        } else {
            const currentJson = JSON.stringify(this.normalizeTheme(currentCustomTheme));
            const activeThemeName = Object.keys(libraryThemes).find(name =>
                JSON.stringify(this.normalizeTheme(libraryThemes[name])) === currentJson
            );
            if (activeThemeName) els.select.value = activeThemeName;
        }

        if (isCustom) {
            themeEngine.apply('custom', currentCustomTheme);
        }

        this.updateButtonStates();
        this.setupListeners(els);
    },

    getElements() {
        return {
            customToggle: document.getElementById("customThemeToggle"),
            darkModeToggle: document.getElementById("darkModeToggle"),
            editBtn: document.getElementById("editThemeBtn"),
            panel: document.getElementById("customThemePanel"),
            settingsPanel: document.getElementById("settingsPanel"),
            closeBtn: document.getElementById("closeThemeBtn"),
            saveBtn: document.getElementById("saveThemeBtn"),
            deleteBtn: document.getElementById("deleteThemeBtn"),
            resetBtn: document.getElementById("resetThemeBtn"),
            nameInput: document.getElementById("themeNameInput"),
            select: document.getElementById("savedThemesSelect"),
            modal: document.getElementById("customModal"),
            modalTitle: document.getElementById("modalTitle"),
            modalMsg: document.getElementById("modalMessage"),
            modalConfirm: document.getElementById("modalConfirmBtn"),
            modalCancel: document.getElementById("modalCancelBtn")
        };
    },

    normalizeTheme(theme) {
        return {
            bgBody: (theme.bgBody || "#ffffff").toLowerCase(),
            bgCard: (theme.bgCard || "#ffffff").toLowerCase(),
            accentColor: (theme.accentColor || "#3b82f6").toLowerCase(),
            textPrimary: (theme.accentColor || "#3b82f6").toLowerCase()
        };
    },

    flashButtonText(btnId, tempText, originalText) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.textContent = tempText;
        btn.disabled = true;
        btn.style.opacity = "0.5";
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
            this.updateButtonStates();
        }, 1500);
    },

    async updateButtonStates() {
        const els = this.getElements();
        const current = this.normalizeTheme(this.getCurrentPickerValues());
        const currentJson = JSON.stringify(current);

        const hasChanged = currentJson !== originalThemeState;

        if (els.saveBtn) {
            els.saveBtn.style.opacity = hasChanged ? "1" : "0.6";
            els.saveBtn.style.cursor = hasChanged ? "pointer" : "default";
        }
        if (els.resetBtn) {
            els.resetBtn.style.opacity = hasChanged ? "1" : "0.6";
            els.resetBtn.style.cursor = hasChanged ? "pointer" : "default";
        }

        const currentSelection = els.select.value;
        const selectionIsValid = currentSelection &&
            libraryThemes[currentSelection] &&
            JSON.stringify(this.normalizeTheme(libraryThemes[currentSelection])) === currentJson;

        if (selectionIsValid) {
            await storage.set("activeThemeName", currentSelection);
            return;
        }

        const match = Object.keys(libraryThemes).find(name =>
            JSON.stringify(this.normalizeTheme(libraryThemes[name])) === currentJson
        );

        if (match) {
            els.select.value = match;
            await storage.set("activeThemeName", match);
        } else {
            await storage.set("activeThemeName", "");
        }
    },

    getCurrentPickerValues() {
        const accent = document.getElementById("pickerUnified").value;
        return {
            bgBody: document.getElementById("pickerBgBody").value,
            bgCard: document.getElementById("pickerBgCard").value,
            accentColor: accent,
            textPrimary: accent
        };
    },

    setupListeners(els) {
        ["pickerBgBody", "pickerBgCard", "pickerUnified"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener("input", async (e) => {
                const val = e.target.value;
                const hexId = "hex" + id.replace("picker", "");
                const hexInput = document.getElementById(hexId);
                if (hexInput) hexInput.value = val;

                currentCustomTheme = this.getCurrentPickerValues();
                themeEngine.apply('custom', currentCustomTheme);
                await storage.set("customTheme", currentCustomTheme);

                this.updateButtonStates();
            });
        });

        ["hexBgBody", "hexBgCard", "hexUnified"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener("change", async (e) => {
                let val = e.target.value;
                if (!/^#[0-9A-F]{6}$/i.test(val)) return;

                const pickerId = "picker" + id.replace("hex", "");
                const picker = document.getElementById(pickerId);
                if (picker) picker.value = val;

                currentCustomTheme = this.getCurrentPickerValues();
                themeEngine.apply('custom', currentCustomTheme);
                await storage.set("customTheme", currentCustomTheme);

                this.updateButtonStates();
            });
        });

        els.customToggle.addEventListener("change", async (e) => {
            const enabled = e.target.checked;
            await storage.set("customThemeEnabled", enabled);
            const data = await storage.getAll();
            let savedThemes = data.savedThemes || {};

            if (enabled) {
                const selectedName = els.select.value;
                if (selectedName && savedThemes[selectedName]) {
                    currentCustomTheme = savedThemes[selectedName];
                    await storage.set("customTheme", currentCustomTheme);
                }
                if (els.darkModeToggle) els.darkModeToggle.checked = false;
                els.editBtn.classList.remove("hidden");
                themeEngine.apply('custom', currentCustomTheme);
            } else {
                if (els.darkModeToggle) els.darkModeToggle.checked = !!data.darkMode;
                els.editBtn.classList.add("hidden");
                themeEngine.init(data);
            }
        });

        els.saveBtn.addEventListener("click", async () => {
            const name = els.nameInput.value.trim();
            if (!name) { els.nameInput.focus(); return; }

            if (["__proto__", "constructor", "prototype"].includes(name)) {
                alert(i18n.t("alert_invalid_name")); // Fixed
                return;
            }

            const currentValues = this.normalizeTheme(this.getCurrentPickerValues());
            const currentJson = JSON.stringify(currentValues);

            if (libraryThemes[name]) {
                if (currentJson === originalThemeState) {
                    // Fixed: Use feedback_no_changes key
                    this.flashButtonText("saveThemeBtn", i18n.t("feedback_no_changes"), i18n.t("button_save"));
                    return;
                }
                // Fixed: Use button_replace key
                els.modalConfirm.textContent = i18n.t("button_replace");
                els.modalCancel.classList.remove("hidden");

                const msg = i18n.t("modal_overwrite_msg").replace("{{NAME}}", name);

                this.showModal(els, i18n.t("modal_overwrite_title"), msg, async () => {
                    await this.performSave(els, name, libraryThemes, currentValues);
                });
            } else {
                await this.performSave(els, name, libraryThemes, currentValues);
            }
        });

        els.resetBtn.addEventListener("click", () => {
            const currentJson = JSON.stringify(this.normalizeTheme(this.getCurrentPickerValues()));

            if (currentJson === originalThemeState) {
                // Fixed: Use feedback_already_default key
                this.flashButtonText("resetThemeBtn", i18n.t("feedback_already_default"), i18n.t("button_reset_defaults"));
                return;
            }

            const baseline = JSON.parse(originalThemeState);
            this.updatePickerUI(baseline);
            currentCustomTheme = { ...baseline };
            themeEngine.apply('custom', currentCustomTheme);

            this.flashButtonText("resetThemeBtn", i18n.t("feedback_reset_success"), i18n.t("button_reset_defaults")); //

            this.updateButtonStates();
        });

        els.deleteBtn.addEventListener("click", () => {
            const name = els.select.value;
            const placeholder = i18n.t("placeholder_select_theme");
            if (!name || name === placeholder) return;

            // Line 254: Updated to use $NAME$ for localization replacement
            this.showModal(
                els,
                i18n.t("modal_delete_title"),
                i18n.t("modal_delete_msg").replace("{{NAME}}", `"${name}"`),
                async () => {                // 1. Delete from memory & storage
                    delete libraryThemes[name];
                    await storage.set("savedThemes", libraryThemes);

                    // 2. Refresh the dropdown list
                    await this.refreshThemeList(els.select);

                    // 3. Intelligent switch to the first available theme
                    const remainingNames = Object.keys(libraryThemes);

                    if (remainingNames.length > 0) {
                        const nextName = remainingNames[0];
                        const nextTheme = libraryThemes[nextName];

                        currentCustomTheme = { ...nextTheme };

                        await storage.setMultiple({
                            "customTheme": currentCustomTheme,
                            "activeThemeName": nextName
                        });

                        els.select.value = nextName;
                        this.updatePickerUI(nextTheme);
                        themeEngine.apply('custom', currentCustomTheme);

                        originalThemeState = JSON.stringify(this.normalizeTheme(nextTheme));
                    } else {
                        els.select.value = "";
                        await storage.set("activeThemeName", "");
                    }

                    this.updateButtonStates();
                });
        });

        els.closeBtn.addEventListener("click", () => {
            els.panel.classList.add("hidden");
            els.settingsPanel.classList.remove("hidden");
        });

        els.editBtn.addEventListener("click", () => {
            els.settingsPanel.classList.add("hidden");
            els.panel.classList.remove("hidden");
        });

        els.select.addEventListener("change", async () => {
            const name = els.select.value;
            if (libraryThemes[name]) {
                const selected = libraryThemes[name];
                currentCustomTheme = { ...selected };

                await storage.setMultiple({
                    "customTheme": currentCustomTheme,
                    "activeThemeName": name
                });

                this.updatePickerUI(selected);
                originalThemeState = JSON.stringify(this.normalizeTheme(selected));
                themeEngine.apply('custom', currentCustomTheme);
                this.updateButtonStates();
            }
        });
    },

    async performSave(els, name, themes, themeToSave) {
        themes[name] = themeToSave;
        libraryThemes = themes;

        await storage.setMultiple({
            "savedThemes": themes,
            "customTheme": themeToSave,
            "activeThemeName": name
        });

        originalThemeState = JSON.stringify(this.normalizeTheme(themeToSave));
        await this.refreshThemeList(els.select);
        els.select.value = name;
        els.nameInput.value = "";
        this.flashButtonText("saveThemeBtn", i18n.t("feedback_saved"), i18n.t("button_save")); //
        themeEngine.apply('custom', themeToSave);
        this.updateButtonStates();
    },

    showModal(els, title, msg, onConfirm) {
        els.modalConfirm.textContent = i18n.t("button_confirm"); // Fixed
        els.modalCancel.classList.remove("hidden");
        els.modalTitle.textContent = title;
        els.modalMsg.textContent = msg;
        els.modal.classList.remove("hidden");
        els.modalConfirm.onclick = () => {
            onConfirm();
            els.modal.classList.add("hidden");
        };
        els.modalCancel.onclick = () => els.modal.classList.add("hidden");
    },

    updatePickerUI(theme) {
        const keys = {
            bgBody: "pickerBgBody",
            bgCard: "pickerBgCard",
            accentColor: "pickerUnified"
        };
        Object.keys(keys).forEach(k => {
            const el = document.getElementById(keys[k]);
            const hexValue = (theme[k] || "#000000").toLowerCase();
            if (el) el.value = hexValue;
            const hexId = keys[k].replace("picker", "hex");
            const hexTextEl = document.getElementById(hexId);
            if (hexTextEl) hexTextEl.value = hexValue;
        });
    },

    async refreshThemeList(select) {
        const data = await storage.getAll();
        libraryThemes = data.savedThemes || {};
        const placeholder = i18n.t("placeholder_select_theme"); //
        select.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
        Object.keys(libraryThemes).forEach(name => {
            const opt = document.createElement("option");
            opt.value = name; opt.textContent = name;
            select.appendChild(opt);
        });
    }
};