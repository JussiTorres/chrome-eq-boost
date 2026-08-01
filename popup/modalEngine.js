/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

import { i18n } from './i18n.js';

let activeConfirmAction = null;
let previousFocusElement = null;

// Cached DOM Elements
const els = {
    overlay: null,
    title: null,
    message: null,
    confirmBtn: null,
    cancelBtn: null
};

export const confirmModal = {
    // --- 1. INITIALIZATION & EVENT BINDING ---
    init() {
        els.overlay = document.getElementById('customModal');
        els.title = document.getElementById('modalTitle');
        els.message = document.getElementById('modalMessage');
        els.confirmBtn = document.getElementById('modalConfirmBtn');
        els.cancelBtn = document.getElementById('modalCancelBtn');

        if (!els.overlay) return;

        // Bind Cancel Button
        els.cancelBtn?.addEventListener('click', () => this.close());

        // Bind Confirm Button
        els.confirmBtn?.addEventListener('click', () => {
            if (activeConfirmAction) activeConfirmAction();
            this.close();
        });

        // Backdrop Click-Outside-to-Close
        els.overlay.addEventListener('click', (e) => {
            if (e.target === els.overlay) {
                this.close();
            }
        });

        // Global Keyboard Navigation (Escape key to dismiss)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !els.overlay.classList.contains('hidden')) {
                this.close();
            }
        });
    },

    // --- 2. OPEN MODAL EXECUTION ---
    open({ title, message, confirmText, cancelText, onConfirm }) {
        if (!els.overlay) this.init(); // Self-healing fallback if called before init
        if (!els.overlay) return;

        // Save currently focused UI element for accessibility restoration
        previousFocusElement = document.activeElement;

        // Populate Texts with Localized Fallbacks
        if (els.title) {
            els.title.textContent = title || "Confirm Action";
        }
        if (els.message) {
            els.message.textContent = message || "Are you sure?";
        }
        if (els.confirmBtn) {
            const defaultConfirm = i18n ? (i18n.t("button_confirm") || "Confirm") : "Confirm";
            // Uses provided confirmText, falls back to whatever was manually set, or defaults to i18n
            els.confirmBtn.textContent = confirmText || els.confirmBtn.textContent || defaultConfirm;
        }
        if (els.cancelBtn) {
            const defaultCancel = i18n ? (i18n.t("button_cancel") || "Cancel") : "Cancel";
            els.cancelBtn.textContent = cancelText || defaultCancel;
        }

        // Bind action and reveal overlay
        activeConfirmAction = onConfirm;
        els.overlay.classList.remove('hidden');

        // Focus Trapping: Automatically highlight the confirm button for keyboard navigation
        setTimeout(() => {
            els.confirmBtn?.focus();
        }, 10);
    },

    // --- 3. CLOSE MODAL & STATE CLEANUP ---
    close() {
        if (!els.overlay) return;

        els.overlay.classList.add('hidden');
        activeConfirmAction = null;

        // Restore focus back to the button/input that originally triggered the modal
        if (previousFocusElement && typeof previousFocusElement.focus === 'function') {
            previousFocusElement.focus();
            previousFocusElement = null;
        }
    }
};