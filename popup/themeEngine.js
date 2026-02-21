/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

import { storage } from './storageHelpers.js';

// Fallback colors to prevent the "Flash-back" bug when storage is in flux
const DEFAULT_CUSTOM = {
    bgBody: '#f7f9fb',
    bgCard: '#ffffff',
    accentColor: '#3b82f6',
    textPrimary: '#3b82f6'
};

function adjustBrightness(hex, percent) {
    hex = hex.replace(/^\s*#|\s*$/g, '');
    if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
    const num = parseInt(hex, 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

function hexToRgba(hex, alpha) {
    hex = hex.replace(/^\s*#|\s*$/g, '');
    if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- NEW HELPER: Calculates Black or White text based on background ---
function getContrastColor(hex) {
    hex = hex.replace(/^\s*#|\s*$/g, '');
    if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // Calculate YIQ brightness (Human Eye perception)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

export const themeEngine = {
    init(data) {
        // Priority: Custom Theme > Dark Mode > Default
        const mode = data.customThemeEnabled ? 'custom' : (data.darkMode ? 'dark' : 'default');
        this.apply(mode, data.customTheme);
    },

    apply(mode, customTheme = null) {
        const root = document.documentElement;
        const body = document.body;

        // Safety check: Use provided theme, or fallback to default custom colors
        const t = (mode === 'custom') ? (customTheme || DEFAULT_CUSTOM) : null;

        root.removeAttribute('style');
        body.classList.remove('dark-mode', 'custom-theme', 'default-theme');

        if (mode === 'custom' && t) {
            body.classList.add('custom-theme');

            root.style.setProperty('--bg-body', t.bgBody);
            root.style.setProperty('--bg-card', t.bgCard);
            root.style.setProperty('--text-primary', t.textPrimary);
            root.style.setProperty('--primary', t.accentColor);

            root.style.setProperty('--bg-hover', adjustBrightness(t.bgCard, -5));
            root.style.setProperty('--primary-hover', adjustBrightness(t.accentColor, -20));
            root.style.setProperty('--shadow-soft', hexToRgba(t.accentColor, 0.15));
            root.style.setProperty('--bg-disabled', hexToRgba(t.textPrimary, 0.14));
            root.style.setProperty('--border-light', hexToRgba(t.textPrimary, 0.15));
            root.style.setProperty('--slider-track', hexToRgba(t.textPrimary, 0.2));
            root.style.setProperty('--slider-thumb', t.accentColor);

            root.style.setProperty('--text-heading', t.accentColor);
            root.style.setProperty('--text-muted', t.textPrimary);
            root.style.setProperty('--text-label', t.textPrimary);
            root.style.setProperty('--text-section', t.textPrimary);
            root.style.setProperty('--text-value', t.textPrimary);

            root.style.setProperty('--status-success', t.accentColor);
            root.style.setProperty('--status-warning', t.accentColor);
            root.style.setProperty('--status-danger', t.accentColor);
            root.style.setProperty('--danger', t.accentColor);

            root.style.setProperty('--text-loading', t.accentColor);
            root.style.setProperty('--text-waiting', t.accentColor);
            root.style.setProperty('--text-active', t.accentColor);
            root.style.setProperty('--text-conflict', t.accentColor);

            // --- THE FIX: Intelligent Button Text Color ---
            // If the accent is bright (like White), this returns Black.
            root.style.setProperty('--text-button', getContrastColor(t.accentColor));

        } else if (mode === 'dark') {
            body.classList.add('dark-mode');
            // Standard themes use standard White text on colored buttons
            root.style.removeProperty('--text-button');
        } else {
            body.classList.add('default-theme');
            // Standard themes use standard White text on colored buttons
            root.style.removeProperty('--text-button');
        }
    }
};