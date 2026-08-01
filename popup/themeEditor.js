/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

import { storage } from './storageHelpers.js';
import { themeEngine } from './themeEngine.js';
import { PRESET_THEMES } from './constants.js';
import { i18n } from './i18n.js';

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
        currentCustomTheme = data.customTheme || libraryThemes["Solar Flare"] || {
            bgBody: '#f7f9fb', bgCard: '#ffffff', accentColor: '#3b82f6', textPrimary: '#3b82f6'
        };
        const isCustom = data.customThemeEnabled || false;

        // 3. SET BASELINE
        originalThemeState = JSON.stringify(this.normalizeTheme(currentCustomTheme));

        // 4. SETUP UI STATE
        if (els.customToggle) els.customToggle.checked = isCustom;
        if (isCustom && els.editBtn) els.editBtn.classList.remove("hidden");

        this.updatePickerUI(currentCustomTheme);
        await this.refreshThemeList(els);

        // 5. DROPDOWN SYNC (Prioritize the stored name, but verify integrity)
        let activeNameToSet = "";
        if (data.activeThemeName && libraryThemes[data.activeThemeName]) {
            const storedThemeJson = JSON.stringify(this.normalizeTheme(libraryThemes[data.activeThemeName]));
            const currentJson = JSON.stringify(this.normalizeTheme(currentCustomTheme));

            if (storedThemeJson === currentJson) {
                activeNameToSet = data.activeThemeName;
            }
        } else {
            const currentJson = JSON.stringify(this.normalizeTheme(currentCustomTheme));
            activeNameToSet = Object.keys(libraryThemes).find(name =>
                JSON.stringify(this.normalizeTheme(libraryThemes[name])) === currentJson
            ) || "";
        }

        this.setSelectedThemeUI(els, activeNameToSet);

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

            // Replaced native select with custom dropdown DOM elements
            themeDropdown: document.getElementById("savedThemesDropdown"),
            themeDropdownText: document.getElementById("savedThemesDropdownText"),
            themeOptionsContainer: document.getElementById("savedThemesOptionsContainer"),

            modal: document.getElementById("customModal"),
            modalTitle: document.getElementById("modalTitle"),
            modalMsg: document.getElementById("modalMessage"),
            modalConfirm: document.getElementById("modalConfirmBtn"),
            modalCancel: document.getElementById("modalCancelBtn")
        };
    },

    setSelectedThemeUI(els, themeName) {
        if (!els.themeDropdownText || !els.themeOptionsContainer) return;

        const placeholder = i18n.t("placeholder_select_theme") || "Select a theme...";
        els.themeDropdownText.textContent = themeName || placeholder;

        // Prevent i18n from overwriting an active theme name with the placeholder
        if (themeName) {
            els.themeDropdownText.removeAttribute("data-i18n");
        } else {
            els.themeDropdownText.setAttribute("data-i18n", "placeholder_select_theme");
        }

        els.themeOptionsContainer.querySelectorAll('.option').forEach(opt => {
            if (opt.dataset.value === themeName) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
    },

    async render() {
        const els = this.getElements();
        const data = await storage.getAll();
        const activeName = data.activeThemeName || "";
        this.setSelectedThemeUI(els, activeName);
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
        btn.classList.add("is-flashing"); // Flags the animation state for CSS so prohibited cursor is ignored
        btn.style.opacity = "0.7";

        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
            btn.classList.remove("is-flashing");
            btn.style.opacity = "1";
            this.updateButtonStates();
        }, 1500);
    },

    async updateButtonStates() {
        const els = this.getElements();
        const current = this.normalizeTheme(this.getCurrentPickerValues());
        const currentJson = JSON.stringify(current);

        // REMOVED: Disabling logic for saveBtn and resetBtn.
        // Both buttons remain clickable at all times so user actions (like focusing the input box or early returns) work seamlessly without showing a prohibited cursor!

        const placeholder = i18n.t("placeholder_select_theme") || "Select a theme...";
        const currentSelection = els.themeDropdownText?.textContent === placeholder ? "" : els.themeDropdownText?.textContent;

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
            this.setSelectedThemeUI(els, match);
            await storage.set("activeThemeName", match);
        } else {
            this.setSelectedThemeUI(els, "");
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
                const placeholder = i18n.t("placeholder_select_theme") || "Select a theme...";
                const selectedName = els.themeDropdownText?.textContent === placeholder ? "" : els.themeDropdownText?.textContent;

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

        // --- Shared Save Handler (Used by Button Click & Enter Key) ---
        const handleSave = async () => {
            // PATCH: Ignore Enter key spam if a save is already in progress
            if (els.saveBtn.disabled) return;

            const name = els.nameInput.value.trim();
            if (!name) { els.nameInput.focus(); return; }

            if (["__proto__", "constructor", "prototype"].includes(name)) {
                alert(i18n.t("alert_invalid_name"));
                return;
            }

            const currentValues = this.normalizeTheme(this.getCurrentPickerValues());
            const currentJson = JSON.stringify(currentValues);

            if (libraryThemes[name]) {
                if (currentJson === originalThemeState) {
                    this.flashButtonText("saveThemeBtn", i18n.t("feedback_no_changes") || "No changes!", i18n.t("button_save") || "Save");
                    return;
                }

                const titleText = i18n.t("modal_theme_overwrite_title") || "Overwrite Theme?";
                const msgText = (i18n.t("modal_theme_overwrite_msg") || `The theme '${name}' already exists. Replace it?`).replace("{{NAME}}", name);
                const btnText = i18n.t("button_replace") || "Replace";

                this.showModal(els, titleText, msgText, btnText, async () => {
                    await this.performSave(els, name, libraryThemes, currentValues);
                });
            } else {
                await this.performSave(els, name, libraryThemes, currentValues);
            }
        };

        // 1. Trigger save via Button Click
        els.saveBtn.addEventListener("click", handleSave);

        // 2. Trigger save via Enter Key in the theme name input box
        els.nameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault(); // Stops form submission / page jumps
                els.nameInput.blur(); // Drops the focus ring just like clicking with a mouse
                handleSave();
            }
        });

        // 3. STEP 2: Update button state immediately as the user types
        els.nameInput.addEventListener("input", () => {
            this.updateButtonStates();
        });

        els.resetBtn.addEventListener("click", () => {
            const currentJson = JSON.stringify(this.normalizeTheme(this.getCurrentPickerValues()));

            if (currentJson === originalThemeState) {
                return; // Do nothing when no changes have been made
            }

            const baseline = JSON.parse(originalThemeState);
            this.updatePickerUI(baseline);
            currentCustomTheme = { ...baseline };
            themeEngine.apply('custom', currentCustomTheme);

            this.flashButtonText("resetThemeBtn", i18n.t("feedback_reset_success") || "Reset!", i18n.t("button_reset_defaults") || "Reset to Defaults");

            this.updateButtonStates();
        });

        els.deleteBtn.addEventListener("click", () => {
            const placeholder = i18n.t("placeholder_select_theme") || "Select a theme...";
            const name = els.themeDropdownText?.textContent === placeholder ? "" : els.themeDropdownText?.textContent;
            if (!name) return;

            const titleText = i18n.t("modal_theme_delete_title") || "Delete Theme?";
            const msgText = (i18n.t("modal_theme_delete_msg") || `Are you sure you want to permanently delete '${name}'?`).replace("{{NAME}}", name);
            const btnText = i18n.t("button_delete") || "Delete";

            this.showModal(
                els,
                titleText,
                msgText,
                btnText,
                async () => {
                    // 1. Delete from memory & storage
                    delete libraryThemes[name];
                    await storage.set("savedThemes", libraryThemes);

                    // 2. Refresh the dropdown list
                    await this.refreshThemeList(els);

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

                        this.setSelectedThemeUI(els, nextName);
                        this.updatePickerUI(nextTheme);
                        themeEngine.apply('custom', currentCustomTheme);

                        originalThemeState = JSON.stringify(this.normalizeTheme(nextTheme));
                    } else {
                        this.setSelectedThemeUI(els, "");
                        await storage.set("activeThemeName", "");
                    }

                    this.updateButtonStates();
                }
            );
        });

        els.closeBtn.addEventListener("click", () => {
            els.panel.classList.add("hidden");
            els.settingsPanel.classList.remove("hidden");
        });

        els.editBtn.addEventListener("click", () => {
            els.settingsPanel.classList.add("hidden");
            els.panel.classList.remove("hidden");
        });
    },

    async performSave(els, name, themes, themeToSave) {
        // PATCH: Lock the UI immediately to prevent rapid-fire race conditions
        if (els.saveBtn) els.saveBtn.disabled = true;

        themes[name] = themeToSave;
        libraryThemes = themes;

        await storage.setMultiple({
            "savedThemes": themes,
            "customTheme": themeToSave,
            "activeThemeName": name
        });

        originalThemeState = JSON.stringify(this.normalizeTheme(themeToSave));
        await this.refreshThemeList(els);
        this.setSelectedThemeUI(els, name);
        els.nameInput.value = "";

        // The flasher handles the unlock after the animation
        this.flashButtonText("saveThemeBtn", i18n.t("feedback_saved") || "Saved!", i18n.t("button_save") || "Save");
        themeEngine.apply('custom', themeToSave);
        this.updateButtonStates();
    },

    showModal(els, title, msg, confirmText, onConfirm) {
        els.modalConfirm.textContent = confirmText || i18n.t("button_confirm");
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

    async refreshThemeList(els) {
        const data = await storage.getAll();
        libraryThemes = data.savedThemes || {};

        if (!els.themeOptionsContainer) return;
        els.themeOptionsContainer.innerHTML = '';

        Object.keys(libraryThemes).forEach(name => {
            const optDiv = document.createElement("div");
            optDiv.className = "option";
            optDiv.dataset.value = name;
            optDiv.textContent = name;

            optDiv.addEventListener("click", async () => {
                const selected = libraryThemes[name];
                currentCustomTheme = { ...selected };

                await storage.setMultiple({
                    "customTheme": currentCustomTheme,
                    "activeThemeName": name
                });

                this.setSelectedThemeUI(els, name);
                if (els.themeDropdown) els.themeDropdown.removeAttribute("open");

                this.updatePickerUI(selected);
                originalThemeState = JSON.stringify(this.normalizeTheme(selected));
                themeEngine.apply('custom', currentCustomTheme);
                this.updateButtonStates();
            });

            els.themeOptionsContainer.appendChild(optDiv);
        });
    }
};