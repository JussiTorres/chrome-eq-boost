/**
 * Chrome EQ & Volume Boost
 * Copyright (c) 2025-2026 Jussi Torres
 * Licensed under the MIT License.
 *
 * Developed by Jussi Torres
 */

export const SLIDER_CONFIGS = [{
    id: "volumeSlider",
    display: "volumeValue",
    type: "UPDATE_GAIN",
    storageKey: "volumeLevel",
    default: 1,
    multiplier: 100,
    suffix: "%"
}, {
    id: "bassSlider",
    display: "bassValue",
    type: "UPDATE_BASS",
    storageKey: "bassLevel",
    default: 0,
    multiplier: 1,
    suffix: " dB"
}, {
    id: "midSlider",
    display: "midValue",
    type: "UPDATE_MID",
    storageKey: "midLevel",
    default: 0,
    multiplier: 1,
    suffix: " dB"
}, {
    id: "trebleSlider",
    display: "trebleValue",
    type: "UPDATE_TREBLE",
    storageKey: "trebleLevel",
    default: 0,
    multiplier: 1,
    suffix: " dB"
}];

export const DEFAULTS = {
    pollingRate: 500,
    silenceTimeout: 2000
};

export const PRESET_THEMES = {
    "Crimson Abyss": {
        bgBody: "#0d0014",
        bgCard: "#3d0000",
        accentColor: "#ff9696"
    },
    "White Eclipse": {
        bgBody: "#000000",
        bgCard: "#000000",
        accentColor: "#ffffff"
    },
    "Rosita": {
        bgBody: "#ffdddd",
        bgCard: "#ffbbbb",
        accentColor: "#2A0815"
    },
    // --- NEW: COOL & HIGH-ENERGY AESTHETICS ---
    "Ultraviolet": {
        bgBody: "#070312",
        bgCard: "#130a2a",
        accentColor: "#d8b4fe"
    },
    "Solar Flare": {
        bgBody: "#0f0014",
        bgCard: "#2f0019",
        accentColor: "#ffb84d"
    },
    "Cream Dusk": {
        bgBody: "#fdfaf0",
        bgCard: "#f5f0e0",
        accentColor: "#7c3aed"
    }
};

// ==========================================================================
// IMMERSIVE AUDIOPHILE PRESETS (Engineered for depth, power & clarity)
// Calibrated for 80 Hz Lowshelf / 2500 Hz Peaking / 8000 Hz Highshelf
// ==========================================================================
export const DEFAULT_PRESETS = {
    // Reference standard for untampered studio playback
    "Flat": { volume: 1.0, bass: 0.0, mids: 0.0, treble: 0.0 },

    // --- UNIVERSAL MAINSTREAM GENRES ---
    // Polished commercial vibrancy with punchy rhythm and sparkling vocal clarity
    "Pop": { volume: 1.0, bass: 6.5, mids: 2.0, treble: 6.5 },

    // Powerful, driving rhythm section with biting mid-range guitar crunch
    "Rock": { volume: 1.0, bass: 6.0, mids: 3.0, treble: 6.0 },

    // Heavy, rolling 808 sub-rumble paired with crisp modern hi-hat air
    "R&B / Hip-Hop": { volume: 1.0, bass: 7.5, mids: 1.5, treble: 7.0 },

    // Massive sub-bass punch and sparkling highs for modern synths and drops
    "Electronic": { volume: 1.0, bass: 7.0, mids: 1.0, treble: 7.5 },

    // Heavy, punchy dembow bounce, clear forward vocals, and crisp percussion snap
    "Reggaeton": { volume: 1.0, bass: 6.5, mids: 2.5, treble: 6.5 },

    // Uncompromised heavy low-end with subtle top-end sheen for spatial clarity
    "Deep Bass": { volume: 1.0, bass: 8.0, mids: 0.0, treble: 3.5 },

    // --- GLOBAL & SPECIALIZED GENRES ---
    // Warm, textured atmosphere designed for synths, reverb, and vocal intimacy
    "Indie / Alt": { volume: 1.0, bass: 5.5, mids: 1.5, treble: 6.5 },

    // High-energy sparkle, agile bass, and forward vocals for dense, fast-paced tracks
    "Vocaloid / J-Pop": { volume: 1.0, bass: 5.0, mids: 4.5, treble: 8.0 },

    // Rich upright bass warmth, articulate brass mids, and detailed cymbal brushwork
    "Jazz / Blues": { volume: 1.0, bass: 4.5, mids: 2.0, treble: 6.0 },

    // Brings out the organic resonance of wooden instruments and string shimmer
    "Acoustic": { volume: 1.0, bass: 2.0, mids: 4.0, treble: 6.5 },

    // Natural concert hall acoustics and dynamic headroom for orchestral fidelity
    "Classical": { volume: 1.0, bass: 4.0, mids: 1.5, treble: 7.0 },

    // --- UNDERGROUND & CONTEMPORARY GENRES ---
    // Punchy 4/4 kick foundation, organic polyrhythmic percussion, and open club highs
    "House / Afro House": { volume: 1.0, bass: 7.0, mids: 1.5, treble: 7.5 },

    // Driving metallic bass guitar, hollowed cold vocals, and sharp drum machine snap
    "Post-Punk": { volume: 1.0, bass: 6.0, mids: 1.0, treble: 6.5 },

    // Deep resonant acoustic bass chords, ethereal strings, and expansive cinematic reverb
    // "Dethwave": { volume: 1.0, bass: 6.0, mids: 3.0, treble: 7.0 },

    // Tight 808 punch, controlled low-end saturation, and razor-sharp cowbell highs
    "Phonk": { volume: 1.0, bass: 5.0, mids: 0.0, treble: 7.0 },

    // --- MASTERING & FUNCTIONAL UTILITIES ---
    // Balanced audiophile contour with expansive sub-rumble, pure natural mids, and airy top-end shimmer
    "Hi-Fi Master": { volume: 1.0, bass: 6.5, mids: 0.0, treble: 7.5 },

    // Deep theatrical sub-rumble, forward dialogue intelligibility, and crisp cinematic foley air
    "Cinema": { volume: 1.0, bass: 6.5, mids: 2.5, treble: 6.5 },

    // High-pass vocal clarity for podcasts and essays; eliminates mic boom while enhancing speech articulation
    "Vocal Booster": { volume: 1.0, bass: -3.0, mids: 3.5, treble: 4.5 },

    // Warm, fatigue-free tonal profile for late-night study and quiet background listening
    "Late Night": { volume: 0.85, bass: 1.0, mids: 0.0, treble: -2.5 }
};