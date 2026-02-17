/**
 * chrome-eq-boost/popup/themeEditor.js
 * Handles the Custom Theme Creator UI logic with Intelligent States
 */
import { storage } from './storageHelpers.js';
import { themeEngine } from './themeEngine.js';
import { PRESET_THEMES } from './constants.js';

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
            // Verify: Does the stored name actually match the stored colors?
            // If yes, select it. If no (dirty exit), leave as default.
            const storedThemeJson = JSON.stringify(this.normalizeTheme(libraryThemes[data.activeThemeName]));
            const currentJson = JSON.stringify(this.normalizeTheme(currentCustomTheme));

            if (storedThemeJson === currentJson) {
                els.select.value = data.activeThemeName;
            }
        } else {
            // If no active name, check if colors happen to match a preset
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

    // --- INTELLIGENT HELPERS ---

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

        // --- INTELLIGENT DROPDOWN SYNC ---

        // 1. CHECK VALIDITY: Does the current dropdown name match the current colors?
        const currentSelection = els.select.value;
        const selectionIsValid = currentSelection &&
            libraryThemes[currentSelection] &&
            JSON.stringify(this.normalizeTheme(libraryThemes[currentSelection])) === currentJson;

        if (selectionIsValid) {
            // We are perfectly synced. Ensure storage knows this name is the "active" one.
            await storage.set("activeThemeName", currentSelection);
            return;
        }

        // 2. CHECK MATCH: If not valid, do we strictly match another theme in the library?
        // (e.g., user dialed the colors back to match "Rosita")
        const match = Object.keys(libraryThemes).find(name =>
            JSON.stringify(this.normalizeTheme(libraryThemes[name])) === currentJson
        );

        if (match) {
            // YES: Snap the dropdown to the matching theme
            els.select.value = match;
            await storage.set("activeThemeName", match);
        } else {
            // NO: We are in a "Dirty/Modified" state.
            // behavior: KEEP the dropdown visual (e.g. "Rosita") so user knows what they are editing.
            // But CLEAR the storage name, so if they reload, it defaults to "Select a theme..."
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

    // --- CORE LOGIC ---

    setupListeners(els) {
        // 1. Picker to Hex Sync + LIVE PERSISTENCE
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

        // 2. Hex to Picker Sync + LIVE PERSISTENCE
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

        // Main Custom Theme Toggle Logic
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

        // Smart Save logic
        els.saveBtn.addEventListener("click", async () => {
            const name = els.nameInput.value.trim();
            if (!name) { els.nameInput.focus(); return; }

            // Simple safety check for reserved words
            if (["__proto__", "constructor", "prototype"].includes(name)) {
                alert("Invalid theme name.");
                return;
            }

            const currentValues = this.normalizeTheme(this.getCurrentPickerValues());
            const currentJson = JSON.stringify(currentValues);

            if (libraryThemes[name]) {
                if (currentJson === originalThemeState) {
                    this.flashButtonText("saveThemeBtn", "No changes", "Save");
                    return;
                }
                els.modalConfirm.textContent = "Replace";
                els.modalCancel.classList.remove("hidden");
                this.showModal(els, "Overwrite Theme?", `"${name}" already exists. Replace it?`, async () => {
                    await this.performSave(els, name, libraryThemes, currentValues);
                });
            } else {
                await this.performSave(els, name, libraryThemes, currentValues);
            }
        });

        // Smart Reset logic
        els.resetBtn.addEventListener("click", () => {
            const currentJson = JSON.stringify(this.normalizeTheme(this.getCurrentPickerValues()));

            // 1. Check if there's actually anything to reset
            if (currentJson === originalThemeState) {
                this.flashButtonText("resetThemeBtn", "Already Default", "Reset to Defaults");
                return;
            }

            // 2. Perform the reset
            const baseline = JSON.parse(originalThemeState);
            this.updatePickerUI(baseline);
            currentCustomTheme = { ...baseline };
            themeEngine.apply('custom', currentCustomTheme);

            // 3. THE FIX: Show success feedback
            // This changes the text to "Reset Successful!" for 1.5s, then restores "Reset to Defaults"
            this.flashButtonText("resetThemeBtn", "Reset Successful!", "Reset to Defaults");

            // 4. Update other buttons (Save button needs to know we just reset)
            this.updateButtonStates();
        });

        els.deleteBtn.addEventListener("click", () => {
            const name = els.select.value;
            if (!name || name === "Select a theme...") return;

            this.showModal(els, "Delete Theme?", `Permanently delete "${name}"?`, async () => {
                // 1. Delete from memory & storage
                delete libraryThemes[name];
                await storage.set("savedThemes", libraryThemes);

                // 2. Refresh the dropdown list
                await this.refreshThemeList(els.select);

                // 3. INTELLIGENT SWITCH: Jump to the first available theme
                const remainingNames = Object.keys(libraryThemes);

                if (remainingNames.length > 0) {
                    const nextName = remainingNames[0]; // Grab the first one (e.g., "Crimson Abyss")
                    const nextTheme = libraryThemes[nextName];

                    // Update Memory
                    currentCustomTheme = { ...nextTheme };

                    // Update Storage (So it remembers this new selection)
                    await storage.setMultiple({
                        "customTheme": currentCustomTheme,
                        "activeThemeName": nextName
                    });

                    // Update UI (Dropdown, Color Pickers, Visuals)
                    els.select.value = nextName;
                    this.updatePickerUI(nextTheme);
                    themeEngine.apply('custom', currentCustomTheme);

                    // Reset the "Save" button state (Clean slate)
                    originalThemeState = JSON.stringify(this.normalizeTheme(nextTheme));
                } else {
                    // Fallback if user somehow deleted EVERYTHING (rare)
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
        this.flashButtonText("saveThemeBtn", "Saved!", "Save");
        themeEngine.apply('custom', themeToSave);
        this.updateButtonStates();
    },

    showModal(els, title, msg, onConfirm) {
        els.modalConfirm.textContent = "Confirm";
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
        select.innerHTML = '<option value="" disabled selected>Select a theme...</option>';
        Object.keys(libraryThemes).forEach(name => {
            const opt = document.createElement("option");
            opt.value = name; opt.textContent = name;
            select.appendChild(opt);
        });
    }
};