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