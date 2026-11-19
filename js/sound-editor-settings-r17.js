export const SOUND_SETTINGS_VERSION = 1;

export const SOUND_PARTS = Object.freeze(["bass", "chord", "arp", "lead"]);
export const SOUND_PART_LABELS = Object.freeze({
  bass: "Bass",
  chord: "Chord",
  arp: "Arp",
  lead: "Lead"
});

export const WAVEFORMS = Object.freeze(["sine", "triangle", "sawtooth", "square"]);

export const SOUND_PARAMETER_DEFINITIONS = Object.freeze({
  gain: Object.freeze({ label: "Gain", min: 0, max: 0.2, step: 0.001, decimals: 3 }),
  attackMs: Object.freeze({ label: "Attack", unit: "ms", min: 0, max: 100, step: 1, decimals: 0 }),
  decayMs: Object.freeze({ label: "Decay", unit: "ms", min: 0, max: 500, step: 1, decimals: 0 }),
  sustainPercent: Object.freeze({ label: "Sustain", unit: "%", min: 0, max: 100, step: 1, decimals: 0 }),
  releaseMs: Object.freeze({ label: "Release", unit: "ms", min: 0, max: 500, step: 1, decimals: 0 }),
  gatePercent: Object.freeze({ label: "Gate", unit: "%", min: 50, max: 120, step: 1, decimals: 0 }),
  cutoffHz: Object.freeze({ label: "Cutoff", unit: "Hz", min: 50, max: 16000, step: 1, decimals: 0, scale: "log" }),
  resonanceQ: Object.freeze({ label: "Resonance", unit: "Q", min: 0.1, max: 15, step: 0.1, decimals: 1 }),
  eqLowDb: Object.freeze({ label: "EQ Low (100Hz)", unit: "dB", min: -12, max: 12, step: 0.5, decimals: 1 }),
  eqMidDb: Object.freeze({ label: "EQ Mid (1kHz)", unit: "dB", min: -12, max: 12, step: 0.5, decimals: 1 }),
  eqHighDb: Object.freeze({ label: "EQ High (4kHz)", unit: "dB", min: -12, max: 12, step: 0.5, decimals: 1 })
});

const BASE_PART_SETTINGS = Object.freeze({
  attackMs: 8,
  decayMs: 0,
  sustainPercent: 100,
  releaseMode: "auto",
  releaseMs: 80,
  gatePercent: 92,
  filterEnabled: false,
  cutoffHz: 16000,
  resonanceQ: 0.1,
  eqLowDb: 0,
  eqMidDb: 0,
  eqHighDb: 0
});

const DEFAULT_PARTS = Object.freeze({
  bass: Object.freeze({
    ...BASE_PART_SETTINGS,
    attackMs: 5,
    decayMs: 5,
    gatePercent: 120,
    filterEnabled: true,
    cutoffHz: 5000,
    resonanceQ: 4,
    eqLowDb: 1,
    eqMidDb: 1.5,
    eqHighDb: -1,
    waveform: "sawtooth",
    gain: 0.15
  }),
  chord: Object.freeze({
    ...BASE_PART_SETTINGS,
    attackMs: 10,
    decayMs: 10,
    gatePercent: 105,
    filterEnabled: true,
    cutoffHz: 6000,
    resonanceQ: 4,
    eqLowDb: 0,
    eqMidDb: -3,
    eqHighDb: -2,
    waveform: "square",
    gain: 0.09
  }),
  arp: Object.freeze({
    ...BASE_PART_SETTINGS,
    attackMs: 0,
    decayMs: 0,
    sustainPercent: 80,
    gatePercent: 120,
    filterEnabled: true,
    cutoffHz: 16000,
    resonanceQ: 15,
    eqLowDb: -4,
    eqMidDb: 1,
    eqHighDb: 3.5,
    waveform: "sine",
    gain: 0.1
  }),
  lead: Object.freeze({
    ...BASE_PART_SETTINGS,
    attackMs: 0,
    decayMs: 0,
    sustainPercent: 95,
    gatePercent: 115,
    filterEnabled: true,
    cutoffHz: 7000,
    resonanceQ: 9,
    eqLowDb: -2,
    eqMidDb: 3.5,
    eqHighDb: 1,
    waveform: "triangle",
    gain: 0.17
  })
});

const ROOT_KEYS = new Set(["version", "parts"]);
const PART_KEYS = new Set([
  "waveform",
  "gain",
  "attackMs",
  "decayMs",
  "sustainPercent",
  "releaseMode",
  "releaseMs",
  "gatePercent",
  "filterEnabled",
  "cutoffHz",
  "resonanceQ",
  "eqLowDb",
  "eqMidDb",
  "eqHighDb"
]);

export function createDefaultSoundSettings() {
  return {
    version: SOUND_SETTINGS_VERSION,
    parts: Object.fromEntries(SOUND_PARTS.map((part) => [part, { ...DEFAULT_PARTS[part] }]))
  };
}

function assertPlainObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} はオブジェクトで指定してください。`);
  }
}

function assertKnownKeys(value, allowed, path) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw new TypeError(`${path} に未知の項目があります: ${unknown.join(", ")}`);
}

function validateNumber(value, definition, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${path} は有限の数値で指定してください。`);
  }
  if (value < definition.min || value > definition.max) {
    throw new RangeError(`${path} は ${definition.min}〜${definition.max}${definition.unit ? ` ${definition.unit}` : ""} の範囲で指定してください。`);
  }
  return value;
}

export function validateSoundSettings(value) {
  assertPlainObject(value, "設定");
  assertKnownKeys(value, ROOT_KEYS, "設定");
  if (value.version !== SOUND_SETTINGS_VERSION) {
    throw new TypeError(`未対応の設定バージョンです: ${String(value.version)}`);
  }
  assertPlainObject(value.parts, "parts");
  const unknownParts = Object.keys(value.parts).filter((part) => !SOUND_PARTS.includes(part));
  if (unknownParts.length > 0) throw new TypeError(`未知のパートがあります: ${unknownParts.join(", ")}`);

  const normalized = createDefaultSoundSettings();
  for (const part of SOUND_PARTS) {
    const source = value.parts[part];
    assertPlainObject(source, `parts.${part}`);
    assertKnownKeys(source, PART_KEYS, `parts.${part}`);
    for (const key of PART_KEYS) {
      if (!(key in source)) throw new TypeError(`parts.${part}.${key} がありません。`);
    }
    if (!WAVEFORMS.includes(source.waveform)) {
      throw new TypeError(`parts.${part}.waveform は ${WAVEFORMS.join(" / ")} から選んでください。`);
    }
    if (source.releaseMode !== "auto" && source.releaseMode !== "manual") {
      throw new TypeError(`parts.${part}.releaseMode は auto または manual で指定してください。`);
    }
    if (typeof source.filterEnabled !== "boolean") {
      throw new TypeError(`parts.${part}.filterEnabled は true または false で指定してください。`);
    }
    const target = normalized.parts[part];
    target.waveform = source.waveform;
    target.releaseMode = source.releaseMode;
    target.filterEnabled = source.filterEnabled;
    for (const [key, definition] of Object.entries(SOUND_PARAMETER_DEFINITIONS)) {
      target[key] = validateNumber(source[key], definition, `parts.${part}.${key}`);
    }
  }
  return normalized;
}

export function parseSoundSettingsJson(text) {
  if (typeof text !== "string" || text.trim() === "") throw new TypeError("JSONを入力してください。");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new SyntaxError(`JSONの形式が正しくありません: ${error.message}`);
  }
  return validateSoundSettings(parsed);
}

export function stringifySoundSettings(settings) {
  return JSON.stringify(validateSoundSettings(settings), null, 2);
}

export function clampSoundParameter(key, value) {
  const definition = SOUND_PARAMETER_DEFINITIONS[key];
  if (!definition || !Number.isFinite(value)) return null;
  const clamped = Math.min(definition.max, Math.max(definition.min, value));
  const steps = Math.round((clamped - definition.min) / definition.step);
  const rounded = definition.min + steps * definition.step;
  return Number(rounded.toFixed(definition.decimals));
}

export function soundValueToSlider(key, value) {
  const definition = SOUND_PARAMETER_DEFINITIONS[key];
  if (definition?.scale !== "log") return value;
  return Math.round(1000 * Math.log(value / definition.min) / Math.log(definition.max / definition.min));
}

export function sliderToSoundValue(key, sliderValue) {
  const definition = SOUND_PARAMETER_DEFINITIONS[key];
  if (definition?.scale !== "log") return clampSoundParameter(key, Number(sliderValue));
  const ratio = Math.min(1000, Math.max(0, Number(sliderValue))) / 1000;
  const value = definition.min * (definition.max / definition.min) ** ratio;
  return clampSoundParameter(key, value);
}


