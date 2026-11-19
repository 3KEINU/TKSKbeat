import {
  FORMAT_VERSION,
  DEFAULT_TRACK_PATTERNS,
  LOOP_STEPS,
  MAX_DURATION,
  MAX_PAD_EVENTS,
  MAX_RIBBON_EVENTS,
  PAD_COUNT,
  MIDI_PATTERN_IDS,
  PRESET_IDS,
  RIBBON_NOTES,
  TRACK_PARTS
} from "./constants-r14.js";

export function createInitialMusicState() {
  return {
    version: FORMAT_VERSION,
    presets: {
      drumId: "drum-a",
      bassId: "bass-a",
      backingId: "backing-a",
      sequenceId: "midi-loop-1"
    },
    trackPatterns: { ...DEFAULT_TRACK_PATTERNS },
    padMode: "one-shot",
    padEvents: [],
    ribbonEvents: []
  };
}

export function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function quantizeAbsoluteStep(step) {
  if (!Number.isFinite(step)) return 0;
  return Math.floor(step + 0.5);
}

export function quantizedRange(startAbsoluteStep, endAbsoluteStep) {
  const quantizedStart = quantizeAbsoluteStep(startAbsoluteStep);
  const quantizedEnd = quantizeAbsoluteStep(endAbsoluteStep);
  return {
    startStep: mod(quantizedStart, LOOP_STEPS),
    duration: Math.min(MAX_DURATION, Math.max(1, quantizedEnd - quantizedStart))
  };
}

function runtimeTime(event) {
  return Number.isFinite(event._inputTime) ? event._inputTime : Number.NEGATIVE_INFINITY;
}

export function stripRuntimeFields(event) {
  const { _inputTime, ...serializable } = event;
  return serializable;
}

export function upsertPadEvent(events, incoming) {
  const index = events.findIndex((event) => event.step === incoming.step && event.padId === incoming.padId);
  if (index >= 0) {
    if (runtimeTime(incoming) >= runtimeTime(events[index])) {
      const next = events.slice();
      next[index] = incoming;
      return { events: next, full: false, replaced: true };
    }
    return { events, full: false, replaced: false };
  }

  if (events.length >= MAX_PAD_EVENTS) return { events, full: true, replaced: false };
  return { events: [...events, incoming], full: false, replaced: false };
}

export function beginRecordingSession(mode) {
  return {
    mode,
    cleared: { pad: false }
  };
}

export function prepareTrackForInput(state, session) {
  if (session.mode !== "overwrite" || session.cleared.pad) {
    return { state, session };
  }

  const nextState = {
    ...state,
    padEvents: []
  };
  const nextSession = {
    ...session,
    cleared: { ...session.cleared, pad: true }
  };
  return { state: nextState, session: nextSession };
}

export function serializableMusicState(state) {
  return {
    version: FORMAT_VERSION,
    presets: { ...state.presets },
    trackPatterns: { ...DEFAULT_TRACK_PATTERNS, ...state.trackPatterns },
    padMode: "one-shot",
    padEvents: state.padEvents.map(stripRuntimeFields),
    ribbonEvents: []
  };
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function isValidMusicState(value) {
  if (!value || value.version !== FORMAT_VERSION) return false;
  if (!value.presets || !PRESET_IDS.drum.has(value.presets.drumId)) return false;
  if (!PRESET_IDS.bass.has(value.presets.bassId)) return false;
  if (!PRESET_IDS.backing.has(value.presets.backingId)) return false;
  if (!PRESET_IDS.sequence.has(value.presets.sequenceId)) return false;
  if (value.trackPatterns !== undefined) {
    if (!value.trackPatterns || typeof value.trackPatterns !== "object") return false;
    for (const part of TRACK_PARTS) {
      if (!MIDI_PATTERN_IDS.has(value.trackPatterns[part])) return false;
    }
  }
  if (value.padMode !== "one-shot" && value.padMode !== "gate") return false;
  if (!Array.isArray(value.padEvents) || value.padEvents.length > MAX_PAD_EVENTS) return false;
  if (!Array.isArray(value.ribbonEvents) || value.ribbonEvents.length > MAX_RIBBON_EVENTS) return false;

  const padKeys = new Set();
  for (const event of value.padEvents) {
    if (!isIntegerInRange(event.step, 0, LOOP_STEPS - 1)) return false;
    if (!isIntegerInRange(event.padId, 0, PAD_COUNT - 1)) return false;
    if (event.duration !== undefined && !isIntegerInRange(event.duration, 1, MAX_DURATION)) return false;
    const key = `${event.step}:${event.padId}`;
    if (padKeys.has(key)) return false;
    padKeys.add(key);
  }

  const ribbonKeys = new Set();
  for (const event of value.ribbonEvents) {
    if (!isIntegerInRange(event.startStep, 0, LOOP_STEPS - 1)) return false;
    if (!isIntegerInRange(event.duration, 1, MAX_DURATION)) return false;
    if (!RIBBON_NOTES.includes(event.pitch)) return false;
    if (ribbonKeys.has(event.startStep)) return false;
    ribbonKeys.add(event.startStep);
  }

  return true;
}

export function normalizeMusicState(state) {
  return {
    ...state,
    presets: { ...state.presets },
    trackPatterns: { ...DEFAULT_TRACK_PATTERNS, ...state.trackPatterns },
    padMode: "one-shot",
    ribbonEvents: []
  };
}
