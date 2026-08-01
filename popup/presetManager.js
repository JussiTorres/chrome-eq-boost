/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

import { storage } from './storageHelpers.js';
import { i18n } from './i18n.js';
import { DEFAULT_PRESETS } from './constants.js';
import { confirmModal } from './modalEngine.js';

let libraryPresets = {};
let currentActivePreset = "";
let isDirty = false;

export const presetManager = {
    // --- 1. INITIALIZATION & STORAGE BOOTSTRAP ---
    async init() {
        const els = this.getElements();
        const data = await storage.getAll();

        // Safety Net: Catch corrupted data structures (e.g., arrays or strings stored by mistake)
        let savedPresets = data.savedPresets;
        if (savedPresets && (typeof savedPresets !== 'object' || Array.isArray(savedPresets))) {
            console.warn("Corrupted presets found in storage. Resetting to defaults.");
            savedPresets = {};
        }
        if (!savedPresets) savedPresets = {};

        // Safe Deletion Registry: Tracks default presets the user explicitly deleted
        const hiddenBuiltInIds = Array.isArray(data.hiddenBuiltInIds) ? data.hiddenBuiltInIds : [];
        let needsUpdate = false;

        // Force-merge default presets ONLY if they haven't been explicitly deleted by the user
        Object.keys(DEFAULT_PRESETS).forEach(name => {
            if (!savedPresets[name] && !hiddenBuiltInIds.includes(name)) {
                savedPresets[name] = { ...DEFAULT_PRESETS[name] };
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            await storage.setMultiple({ savedPresets });
        }

        // Lock state in memory
        libraryPresets = savedPresets;
        currentActivePreset = data.activePresetName || "";

        // Render UI
        this.refreshPresetList(els.presetOptionsContainer);
        this.syncDropdownLabel(els.presetDropdownText);
        this.setupListeners(els);

        setTimeout(() => this.checkDirtyState(), 50);
    },

    // --- 2. DYNAMIC I18N RENDERER (Called by popup.js on locale switch) ---
    render() {
        const els = this.getElements();
        if (els.presetOptionsContainer) {
            this.refreshPresetList(els.presetOptionsContainer);
        }
        if (els.presetDropdownText) {
            this.syncDropdownLabel(els.presetDropdownText);
        }
    },

    // --- 3. DOM ELEMENT ACCESSORS ---
    getElements() {
        return {
            presetDropdown: document.getElementById("presetDropdown"),
            presetDropdownText: document.getElementById("presetDropdownText"),
            presetOptionsContainer: document.getElementById("presetOptionsContainer"),

            nameInput: document.getElementById("presetNameInput"),
            saveBtn: document.getElementById("savePresetBtn"),
            updateBtn: document.getElementById("updatePresetBtn"),
            deleteBtn: document.getElementById("deletePresetBtn"),
            revertBtn: document.getElementById("revertPresetBtn"),
            newBtn: document.getElementById("newPresetBtn"),
            resetBtn: document.getElementById("resetButton"),

            volume: document.getElementById("volumeSlider"),
            bass: document.getElementById("bassSlider"),
            mids: document.getElementById("midSlider"),
            treble: document.getElementById("trebleSlider")
        };
    },

    getCurrentSliderValues() {
        const els = this.getElements();
        return {
            volume: parseFloat(els.volume.value),
            bass: parseFloat(els.bass.value),
            mids: parseFloat(els.mids.value),
            treble: parseFloat(els.treble.value)
        };
    },

    // --- 4. STATE VALIDATION & DIRTY CHECKING ---
    checkDirtyState() {
        if (!currentActivePreset || !libraryPresets[currentActivePreset]) {
            this.setDirty(false);
            return;
        }

        const current = this.getCurrentSliderValues();
        const saved = libraryPresets[currentActivePreset];

        const hasChanged =
            Math.abs(current.volume - saved.volume) > 0.01 ||
            Math.abs(current.bass - saved.bass) > 0.1 ||
            Math.abs(current.mids - saved.mids) > 0.1 ||
            Math.abs(current.treble - saved.treble) > 0.1;

        this.setDirty(hasChanged);
    },

    setDirty(dirty) {
        isDirty = dirty;
        const els = this.getElements();

        if (els.presetDropdownText && currentActivePreset) {
            const displayTitle = i18n.getPresetName(currentActivePreset);
            els.presetDropdownText.textContent = isDirty ? `${displayTitle} *` : displayTitle;
        }

        if (els.updateBtn) els.updateBtn.disabled = !isDirty;
        if (els.revertBtn) els.revertBtn.disabled = !isDirty;

        // REMOVED: The SMART LOCK block that disabled saveBtn when input was empty.
        // Now saveBtn stays enabled so clicking it when empty focuses the input box!
    },

    // --- 5. EVENT LISTENERS & MODAL HANDLERS ---
    setupListeners(els) {
        // Track live slider inputs
        [els.volume, els.bass, els.mids, els.treble].forEach(slider => {
            if (slider) slider.addEventListener("input", () => this.checkDirtyState());
        });

        // LIVE TYPING LISTENER: Updates Save button state instantly as the user types
        if (els.nameInput) {
            els.nameInput.addEventListener("input", () => {
                this.checkDirtyState();
            });
        }

        // Dropdown selection handler
        els.presetOptionsContainer.addEventListener("click", async (e) => {
            const optionDiv = e.target.closest(".option");
            if (!optionDiv) return;

            // Strict data-value accessor: immune to language translation changes
            const name = optionDiv.dataset.value;
            if (libraryPresets[name]) {
                currentActivePreset = name;
                await storage.setMultiple({ activePresetName: name });

                this.syncDropdownLabel(els.presetDropdownText);
                els.presetDropdown.removeAttribute("open");

                this.applyPresetValues(libraryPresets[name]);
                this.refreshPresetList(els.presetOptionsContainer);
                this.checkDirtyState();
            }
        });

        // Revert changes button
        if (els.revertBtn) {
            els.revertBtn.addEventListener("click", () => {
                if (els.revertBtn.disabled) return;
                const targetValues = (currentActivePreset && libraryPresets[currentActivePreset])
                    ? libraryPresets[currentActivePreset]
                    : { volume: 1.0, bass: 0.0, mids: 0.0, treble: 0.0 };

                this.applyPresetValues(targetValues);
                this.checkDirtyState();
            });
        }

        // Create new preset button
        if (els.newBtn) {
            els.newBtn.addEventListener("click", async () => {
                this.applyPresetValues({ volume: 1.0, bass: 0.0, mids: 0.0, treble: 0.0 });
                currentActivePreset = "";
                await storage.setMultiple({ activePresetName: "" });

                this.syncDropdownLabel(els.presetDropdownText);
                els.nameInput.value = "";
                els.nameInput.focus();

                this.refreshPresetList(els.presetOptionsContainer);
                this.checkDirtyState();
            });
        }

        // Global EQ reset button hook
        if (els.resetBtn) {
            els.resetBtn.addEventListener("click", async () => {
                this.applyPresetValues({ volume: 1.0, bass: 0.0, mids: 0.0, treble: 0.0 });
                currentActivePreset = "";
                await storage.setMultiple({ activePresetName: "" });

                this.syncDropdownLabel(els.presetDropdownText);
                this.refreshPresetList(els.presetOptionsContainer);
                this.checkDirtyState();
            });
        }

        // --- Shared Save Handler (Used by Button Click & Enter Key) ---
        const handleSave = async () => {
            // PATCH: Ignore Enter key spam if a save is already in progress
            if (els.saveBtn.disabled) return;

            const name = els.nameInput.value.trim();
            if (!name) {
                els.nameInput.focus();
                return;
            }

            const currentValues = this.getCurrentSliderValues();

            if (libraryPresets[name]) {
                this.openConfirmModal("overwrite", name, async () => {
                    await this.performSave(els, name, currentValues);
                });
            } else {
                await this.performSave(els, name, currentValues);
            }
        };

        // 1. Trigger save via Button Click
        els.saveBtn.addEventListener("click", handleSave);

        // 2. Trigger save via Enter Key in the input box
        els.nameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault(); // Stops default form submission or page jumps
                els.nameInput.blur(); // Dismisses the focus ring to match the feel of a physical click
                handleSave();
            }
        });

        // Update active preset button
        els.updateBtn.addEventListener("click", () => {
            if (!isDirty || !currentActivePreset) return;
            const currentValues = this.getCurrentSliderValues();
            const name = currentActivePreset;

            this.openConfirmModal("overwrite", name, async () => {
                els.updateBtn.blur();
                await this.performSave(els, name, currentValues);
                // REMOVED: this.flashSuccessStyle(els.updateBtn);
            });
        });

        // Delete active preset button (with built-in preset blacklist protection!)
        els.deleteBtn.addEventListener("click", () => {
            const name = currentActivePreset;
            if (!name || !libraryPresets[name]) return;

            this.openConfirmModal("delete", name, async () => {
                const isBuiltIn = Object.prototype.hasOwnProperty.call(DEFAULT_PRESETS, name);
                delete libraryPresets[name];
                currentActivePreset = "";

                const updates = {
                    savedPresets: libraryPresets,
                    activePresetName: ""
                };

                // If deleting a default preset, blacklist its ID so it doesn't resurrect on reload
                if (isBuiltIn) {
                    const data = await storage.getAll();
                    const hidden = Array.isArray(data.hiddenBuiltInIds) ? data.hiddenBuiltInIds : [];
                    if (!hidden.includes(name)) {
                        hidden.push(name);
                        updates.hiddenBuiltInIds = hidden;
                    }
                }

                await storage.setMultiple(updates);
                this.syncDropdownLabel(els.presetDropdownText);
                this.refreshPresetList(els.presetOptionsContainer);
                this.checkDirtyState();
            });
        });
    },

    // --- 6. CORE OPERATIONS & HELPERS ---
    async performSave(els, name, presetData) {
        // PATCH: Lock the UI immediately to prevent rapid-fire race conditions
        if (els.saveBtn) els.saveBtn.disabled = true;

        libraryPresets[name] = presetData;
        currentActivePreset = name;

        await storage.setMultiple({
            savedPresets: libraryPresets,
            activePresetName: name
        });

        this.refreshPresetList(els.presetOptionsContainer);
        this.syncDropdownLabel(els.presetDropdownText);
        els.nameInput.value = "";

        this.checkDirtyState();

        // Let the flasher handle the unlock after the animation finishes
        this.flashButtonText("savePresetBtn", i18n.t("feedback_saved") || "Saved!", i18n.t("button_save") || "Save");
    },

    applyPresetValues(preset) {
        const els = this.getElements();
        if (els.volume) els.volume.value = preset.volume;
        if (els.bass) els.bass.value = preset.bass;
        if (els.mids) els.mids.value = preset.mids;
        if (els.treble) els.treble.value = preset.treble;

        ['volume', 'bass', 'mids', 'treble'].forEach(id => {
            if (els[id]) els[id].dispatchEvent(new Event('input', { bubbles: true }));
        });
    },

    refreshPresetList(container) {
        if (!container) return;
        container.innerHTML = "";

        const presetNames = Object.keys(libraryPresets);
        const dropdownBtn = document.getElementById("presetDropdown");
        const summaryBtn = dropdownBtn ? dropdownBtn.querySelector("summary") : null;

        // Guard: If no presets exist, hide container and disable only the summary box
        if (presetNames.length === 0) {
            container.style.display = "none";
            if (dropdownBtn) {
                dropdownBtn.removeAttribute("open"); // Force close if open
                // CRITICAL: Clear parent-level opacity so it never double-fades!
                dropdownBtn.style.opacity = "";
                dropdownBtn.style.pointerEvents = "";
            }
            if (summaryBtn) {
                summaryBtn.setAttribute("disabled", "true");
                summaryBtn.style.pointerEvents = "none";
            }
            return;
        }

        // Otherwise, restore active interactive state
        container.style.display = "";
        if (dropdownBtn) {
            dropdownBtn.style.opacity = "";
            dropdownBtn.style.pointerEvents = "";
        }
        if (summaryBtn) {
            summaryBtn.removeAttribute("disabled");
            summaryBtn.style.pointerEvents = "";
        }

        // Populate standard items
        presetNames.forEach(name => {
            const opt = document.createElement("div");
            opt.className = "option";
            opt.dataset.value = name;
            opt.textContent = i18n.getPresetName(name);

            if (name === currentActivePreset) {
                opt.classList.add("selected");
            }
            container.appendChild(opt);
        });
    },

    syncDropdownLabel(labelEl) {
        if (!labelEl) return;
        if (currentActivePreset && libraryPresets[currentActivePreset]) {
            const displayTitle = i18n.getPresetName(currentActivePreset);
            labelEl.textContent = isDirty ? `${displayTitle} *` : displayTitle;
            labelEl.removeAttribute("data-i18n");
        } else {
            labelEl.textContent = i18n.t("placeholder_select_preset") || "Select preset...";
            labelEl.setAttribute("data-i18n", "placeholder_select_preset");
        }
    },

    openConfirmModal(type, targetName, onConfirmCallback) {
        const displayTitle = i18n.getPresetName(targetName);
        const isOverwrite = type === "overwrite";

        const titleKey = isOverwrite ? "modal_preset_overwrite_title" : "modal_preset_delete_title";
        const msgKey = isOverwrite ? "modal_preset_overwrite_msg" : "modal_preset_delete_msg";
        const btnKey = isOverwrite ? "button_replace" : "button_delete";

        const fallbackTitle = isOverwrite ? "Overwrite Preset?" : "Delete Preset?";
        const fallbackMsg = isOverwrite
            ? `Are you sure you want to overwrite '${displayTitle}' with your current settings?`
            : `Are you sure you want to permanently delete '${displayTitle}'?`;
        const fallbackBtn = isOverwrite ? "Replace" : "Delete";

        const titleText = i18n.t(titleKey) || fallbackTitle;
        const msgText = (i18n.t(msgKey) || fallbackMsg).replace("{{NAME}}", displayTitle);

        const confirmBtn = document.getElementById("modalConfirmBtn");
        if (confirmBtn) confirmBtn.textContent = i18n.t(btnKey) || fallbackBtn;

        confirmModal.open({
            title: titleText,
            message: msgText,
            onConfirm: onConfirmCallback
        });
    },

    flashButtonText(btnId, tempText, originalText) {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        btn.textContent = tempText;
        btn.disabled = true;
        btn.classList.add("is-flashing"); // Flags the animation state for CSS
        btn.style.opacity = "0.7";

        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
            btn.classList.remove("is-flashing");
            btn.style.opacity = "1";
        }, 1500);
    }
};