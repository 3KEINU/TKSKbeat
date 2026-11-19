import {
  BPM,
  AUDIO_SAMPLES,
  harmonyAtStep,
  isHarmonyChangeStep,
  LOOP_STEPS,
  stepsUntilHarmonyChange,
  STEPS_PER_BAR,
  STEPS_PER_BEAT,
  TITLE_SAMPLE_ID
} from "./constants-r14.js";
import { MIDI_PATTERNS } from "./midi-patterns-r14.js";
import {
  SOUND_PARTS,
  createDefaultSoundSettings,
  validateSoundSettings
} from "./sound-editor-settings-r17.js";

const PART_NAME_BY_CODE = Object.freeze({ b: "bass", c: "chord", a: "arp", l: "lead" });

function midiToFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

const MOBILE_SPEAKER_SETTINGS = {
  chordGainBoostEnabled: true,
  chordShortNoteExtensionEnabled: true,
  bassShortNoteExtensionEnabled: true,
  bassHarmonicEnabled: true,
  chordHarmonicEnabled: false,
  compressorEnabled: true,
  legacyChordPeakGain: 0.026,
  chordPeakGain: 0.045,
  bassPeakGain: 0.085,
  arpPeakGain: 0.021,
  leadPeakGain: 0.047,
  shortNoteMinimumSeconds: 0.11,
  midiDurationRatio: 0.92,
  oscillatorAttackSeconds: 0.008,
  oscillatorMaximumReleaseSeconds: 0.08,
  overlapGuardRatio: 0.98,
  bassHarmonicSemitones: 12,
  bassHarmonicPeakGain: 0.015,
  bassHarmonicLowpassHz: 1800,
  chordHarmonicGainRatio: 0.1,
  chordHarmonicLowpassHz: 2400
};

export const AUDIO_ENGINE_PRESETS = Object.freeze({
  mobileSpeaker: Object.freeze({ ...MOBILE_SPEAKER_SETTINGS }),
  r15Legacy: Object.freeze({
    ...MOBILE_SPEAKER_SETTINGS,
    chordGainBoostEnabled: false,
    chordShortNoteExtensionEnabled: false,
    bassShortNoteExtensionEnabled: false,
    bassHarmonicEnabled: false,
    chordHarmonicEnabled: false,
    compressorEnabled: true
  })
});

export function createAudioEngineSettings(preset = "mobileSpeaker", overrides = {}) {
  const base = typeof preset === "string"
    ? AUDIO_ENGINE_PRESETS[preset] ?? AUDIO_ENGINE_PRESETS.mobileSpeaker
    : preset;
  return { ...AUDIO_ENGINE_PRESETS.mobileSpeaker, ...base, ...overrides };
}

export function isShortNoteExtensionEnabled(part, settings) {
  if (part === "b") return settings.bassShortNoteExtensionEnabled;
  if (part === "c") return settings.chordShortNoteExtensionEnabled;
  return false;
}

export function resolveMidiDurationSeconds({
  part,
  durationSteps,
  stepDuration,
  maximumDurationSeconds = Number.POSITIVE_INFINITY,
  settings = AUDIO_ENGINE_PRESETS.mobileSpeaker,
  soundConfig
}) {
  const gateRatio = soundConfig ? soundConfig.gatePercent / 100 : settings.midiDurationRatio;
  const baseDuration = Math.max(0.045, durationSteps * stepDuration * gateRatio);
  if (!isShortNoteExtensionEnabled(part, settings)) return baseDuration;
  const extendedDuration = Math.max(baseDuration, settings.shortNoteMinimumSeconds);
  return Math.min(extendedDuration, maximumDurationSeconds);
}

export function resolveTrackPeakGain(part, settings = AUDIO_ENGINE_PRESETS.mobileSpeaker) {
  if (part === "b") return settings.bassPeakGain;
  if (part === "c") {
    return settings.chordGainBoostEnabled ? settings.chordPeakGain : settings.legacyChordPeakGain;
  }
  if (part === "a") return settings.arpPeakGain;
  if (part === "l") return settings.leadPeakGain;
  return 0.04;
}

export function stepsUntilNextPartOnset(pattern, part, step) {
  for (let offset = 1; step + offset < LOOP_STEPS; offset += 1) {
    const events = pattern.eventsByStep[step + offset] ?? [];
    if (events.some(([eventPart]) => eventPart === part)) return offset;
  }
  return LOOP_STEPS - step;
}

export class AudioEngine {
  constructor({ getMusicState, onStep, onBarBoundary, onAnalyserReady, audioSettings, partSoundSettings }) {
    this.getMusicState = getMusicState;
    this.onStep = onStep;
    this.onBarBoundary = onBarBoundary;
    this.onAnalyserReady = onAnalyserReady;
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.analyser = null;
    this.noiseBuffer = null;
    this.padBuffers = new Map();
    this.padSamplesPromise = null;
    this.padSampleBytesPromise = this.fetchPadSampleBytes();
    this.playing = false;
    this.originTime = 0;
    this.nextStepTime = 0;
    this.nextAbsoluteStep = 0;
    this.timer = null;
    this.voices = new Set();
    this.livePadVoices = new Map();
    this.midiPartVoices = new Map();
    this.partSoundSettings = partSoundSettings ? validateSoundSettings(partSoundSettings) : null;
    this.partOutputGraphs = new Map();
    this.audioSettings = createAudioEngineSettings("mobileSpeaker", audioSettings);
    this.stepDuration = 60 / BPM / STEPS_PER_BEAT;
  }

  connectOutputGraph() {
    if (!this.master || !this.context) return;
    try { this.master.disconnect(); } catch {}
    try { this.compressor?.disconnect(); } catch {}
    try { this.analyser?.disconnect(); } catch {}
    const finalOutput = this.analyser ?? this.context.destination;
    if (this.audioSettings.compressorEnabled) {
      this.master.connect(this.compressor).connect(finalOutput);
    } else {
      this.master.connect(finalOutput);
    }
    if (this.analyser) this.analyser.connect(this.context.destination);
  }

  setAudioSettings(overrides = {}) {
    Object.assign(this.audioSettings, overrides);
    this.connectOutputGraph();
    return this.getAudioSettings();
  }

  useAudioSettingsPreset(name) {
    this.audioSettings = createAudioEngineSettings(name);
    this.connectOutputGraph();
    return this.getAudioSettings();
  }

  getAudioSettings() {
    return { ...this.audioSettings };
  }

  getAudioDiagnostics() {
    return {
      settings: this.getAudioSettings(),
      analyserAvailable: Boolean(this.analyser),
      compressorReductionDb: this.audioSettings.compressorEnabled && this.compressor
        ? this.compressor.reduction
        : 0
    };
  }

  setPartSoundSettings(settings) {
    this.partSoundSettings = validateSoundSettings(settings);
    this.updatePartOutputGraphs();
    return this.getPartSoundSettings();
  }

  resetPartSoundSettings() {
    return this.setPartSoundSettings(createDefaultSoundSettings());
  }

  getPartSoundSettings() {
    return this.partSoundSettings ? validateSoundSettings(this.partSoundSettings) : null;
  }

  setAudioParam(param, value) {
    if (!this.context) {
      param.value = value;
      return;
    }
    const time = this.context.currentTime;
    try {
      param.cancelScheduledValues(time);
      param.setTargetAtTime(value, time, 0.008);
    } catch {
      param.value = value;
    }
  }

  ensurePartOutputGraph(partName) {
    if (!this.context || !this.master) return null;
    let graph = this.partOutputGraphs.get(partName);
    if (graph) return graph;
    const input = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const low = this.context.createBiquadFilter();
    const mid = this.context.createBiquadFilter();
    const high = this.context.createBiquadFilter();
    filter.type = "lowpass";
    low.type = "lowshelf";
    low.frequency.value = 100;
    mid.type = "peaking";
    mid.frequency.value = 1000;
    mid.Q.value = 1;
    high.type = "highshelf";
    high.frequency.value = 4000;
    graph = { input, filter, low, mid, high };
    this.partOutputGraphs.set(partName, graph);
    return graph;
  }

  updatePartOutputGraphs() {
    if (!this.context || !this.master || !this.partSoundSettings) return;
    for (const partName of SOUND_PARTS) {
      const config = this.partSoundSettings.parts[partName];
      const graph = this.ensurePartOutputGraph(partName);
      for (const node of Object.values(graph)) {
        try { node.disconnect(); } catch {}
      }
      this.setAudioParam(graph.filter.frequency, config.cutoffHz);
      this.setAudioParam(graph.filter.Q, config.resonanceQ);
      this.setAudioParam(graph.low.gain, config.eqLowDb);
      this.setAudioParam(graph.mid.gain, config.eqMidDb);
      this.setAudioParam(graph.high.gain, config.eqHighDb);
      if (config.filterEnabled) graph.input.connect(graph.filter).connect(graph.low);
      else graph.input.connect(graph.low);
      graph.low.connect(graph.mid).connect(graph.high).connect(this.master);
    }
  }

  getPartDestination(partCode) {
    if (!this.partSoundSettings) return this.master;
    const partName = PART_NAME_BY_CODE[partCode];
    return partName ? this.ensurePartOutputGraph(partName)?.input ?? this.master : this.master;
  }

  async ensureReady() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error("Web Audio API is not supported.");
      this.context = new Context({ latencyHint: "interactive" });
      this.master = this.context.createGain();
      this.master.gain.value = 0.72;
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.18;
      try {
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0;
      } catch (error) {
        console.error("Oscilloscope analyser unavailable", error);
        this.analyser = null;
      }
      this.connectOutputGraph();
      this.updatePartOutputGraphs();
      this.noiseBuffer = this.createNoiseBuffer();
      try {
        this.onAnalyserReady?.(this.analyser);
      } catch (error) {
        console.error("Oscilloscope initialization failed", error);
      }
    }
    if (this.context.state === "suspended") await this.context.resume();
    await this.loadPadSamples();
  }

  fetchPadSampleBytes() {
    return Promise.all(AUDIO_SAMPLES.map(async (sample, padId) => {
      try {
        const url = new URL(`../audio/pads/${sample.file}`, import.meta.url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return { padId, bytes: await response.arrayBuffer() };
      } catch (error) {
        console.error(`Pad sample fetch failed: ${sample.file}`, error);
        return { padId, bytes: null };
      }
    }));
  }

  async loadPadSamples() {
    if (this.padSamplesPromise) return this.padSamplesPromise;
    this.padSamplesPromise = (async () => {
      const samples = await this.padSampleBytesPromise;
      await Promise.all(samples.map(async ({ padId, bytes }) => {
        if (!bytes) return;
        try {
          this.padBuffers.set(padId, await this.context.decodeAudioData(bytes.slice(0)));
        } catch (error) {
          console.error(`Pad sample decode failed: ${AUDIO_SAMPLES[padId].file}`, error);
        }
      }));
    })();
    return this.padSamplesPromise;
  }

  createNoiseBuffer() {
    const length = Math.floor(this.context.sampleRate * 0.5);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    return buffer;
  }

  trackVoice(sources, gain, onEnded) {
    const gains = Array.isArray(gain) ? gain : [gain];
    const voice = {
      stop: (time = this.context.currentTime) => {
        const stopTime = Math.max(time, this.context.currentTime);
        for (const voiceGain of gains) {
          try {
            voiceGain.gain.cancelScheduledValues(stopTime);
            voiceGain.gain.setTargetAtTime(0.0001, stopTime, 0.008);
          } catch {}
        }
        for (const source of sources) {
          try { source.stop(stopTime + 0.05); } catch {}
        }
      }
    };
    this.voices.add(voice);
    const lastSource = sources.at(-1);
    if (lastSource) {
      lastSource.addEventListener("ended", () => {
        this.voices.delete(voice);
        onEnded?.(voice);
      }, { once: true });
    }
    return voice;
  }

  envelope(gain, time, peak, attack, duration, release = 0.08, options = null) {
    const safeTime = Math.max(time, this.context.currentTime);
    if (options) {
      if (peak <= 0) {
        gain.gain.setValueAtTime(0, safeTime);
        gain.gain.setValueAtTime(0, safeTime + duration);
        return;
      }
      const attackSeconds = Math.max(0, options.attackMs / 1000);
      const decaySeconds = Math.max(0, options.decayMs / 1000);
      const releaseSeconds = options.releaseMode === "manual"
        ? Math.min(duration, Math.max(0, options.releaseMs / 1000))
        : Math.min(this.audioSettings.oscillatorMaximumReleaseSeconds, duration / 2);
      const releaseStart = Math.max(safeTime, safeTime + duration - releaseSeconds);
      const availableBeforeRelease = Math.max(0, releaseStart - safeTime);
      const requestedRiseAndDecay = attackSeconds + decaySeconds;
      const phaseScale = requestedRiseAndDecay > availableBeforeRelease && requestedRiseAndDecay > 0
        ? availableBeforeRelease / requestedRiseAndDecay
        : 1;
      const attackEnd = safeTime + attackSeconds * phaseScale;
      const decayEnd = attackEnd + decaySeconds * phaseScale;
      const peakValue = Math.max(0.0001, peak);
      const sustainValue = Math.max(0.0001, peak * options.sustainPercent / 100);
      gain.gain.setValueAtTime(0.0001, safeTime);
      if (attackEnd > safeTime) gain.gain.exponentialRampToValueAtTime(peakValue, attackEnd);
      else gain.gain.setValueAtTime(peakValue, safeTime);
      if (decayEnd > attackEnd) gain.gain.exponentialRampToValueAtTime(sustainValue, decayEnd);
      else gain.gain.setValueAtTime(sustainValue, attackEnd);
      gain.gain.setValueAtTime(sustainValue, releaseStart);
      if (releaseSeconds > 0) gain.gain.exponentialRampToValueAtTime(0.0001, safeTime + duration);
      else gain.gain.setValueAtTime(0.0001, safeTime + duration);
      return;
    }
    gain.gain.setValueAtTime(0.0001, safeTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), safeTime + attack);
    gain.gain.setValueAtTime(Math.max(0.001, peak), safeTime + Math.max(attack, duration - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, safeTime + duration);
  }

  layeredOscillatorVoice({ layers, time, duration, destination = this.master, onEnded, envelopeOptions = null }) {
    const oscillators = [];
    const gains = [];
    for (const layer of layers) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = layer.type ?? "sine";
      oscillator.frequency.setValueAtTime(layer.frequency, time);
      if (layer.lowpassHz) {
        const filter = this.context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(layer.lowpassHz, time);
        oscillator.connect(filter).connect(gain).connect(destination);
      } else {
        oscillator.connect(gain).connect(destination);
      }
      this.envelope(
        gain,
        time,
        layer.peak,
        this.audioSettings.oscillatorAttackSeconds,
        duration,
        Math.min(this.audioSettings.oscillatorMaximumReleaseSeconds, duration / 2),
        envelopeOptions
      );
      oscillator.start(time);
      oscillator.stop(time + duration + 0.06);
      oscillators.push(oscillator);
      gains.push(gain);
    }
    return this.trackVoice(oscillators, gains, onEnded);
  }

  oscillatorVoice({ frequency, time, duration, type = "sine", peak = 0.16, destination = this.master }) {
    return this.layeredOscillatorVoice({
      layers: [{ frequency, type, peak }],
      time,
      duration,
      destination
    });
  }

  playKick(time, accent = 1) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.setValueAtTime(145, time);
    oscillator.frequency.exponentialRampToValueAtTime(46, time + 0.12);
    oscillator.connect(gain).connect(this.master);
    this.envelope(gain, time, 0.28 * accent, 0.002, 0.2, 0.1);
    oscillator.start(time);
    oscillator.stop(time + 0.24);
    this.trackVoice([oscillator], gain);
  }

  playNoise(time, duration, peak, highpass = 900) {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "highpass";
    filter.frequency.value = highpass;
    source.connect(filter).connect(gain).connect(this.master);
    this.envelope(gain, time, peak, 0.002, duration, duration * 0.8);
    source.start(time);
    source.stop(time + duration + 0.02);
    this.trackVoice([source], gain);
  }

  playDrums(step, time, presetId) {
    const beatStep = step % STEPS_PER_BAR;
    const eighth = beatStep % 2 === 0;
    const beat = beatStep % STEPS_PER_BEAT === 0;

    if (presetId === "drum-a") {
      if (beatStep === 0 || beatStep === 8 || beatStep === 10) this.playKick(time, beatStep === 0 ? 1.1 : 0.85);
      if (beatStep === 4 || beatStep === 12) this.playNoise(time, 0.14, 0.14, 700);
      if (eighth) this.playNoise(time, 0.045, 0.038, 4800);
    } else if (presetId === "drum-b") {
      if ([0, 6, 10].includes(beatStep)) this.playKick(time, 0.9);
      if ([4, 12, 15].includes(beatStep)) this.playNoise(time, 0.11, 0.12, 1000);
      if (beatStep % 4 === 2) this.playNoise(time, 0.04, 0.045, 5200);
    } else {
      if (beat) this.playKick(time, beatStep === 0 ? 1 : 0.65);
      if ([2, 6, 10, 14].includes(beatStep)) this.playNoise(time, 0.07, 0.075, 1500);
      if (eighth) this.playNoise(time, 0.035, 0.025, 6000);
    }
  }

  playBass(step, time, presetId) {
    const stepInBar = step % STEPS_PER_BAR;
    const patterns = {
      "bass-a": [0, 8],
      "bass-b": [0, 3, 8, 11],
      "bass-c": [0, 4, 7, 10, 14]
    };
    if (!patterns[presetId].includes(stepInBar) && !isHarmonyChangeStep(step)) return;
    const harmony = harmonyAtStep(step);
    const note = harmony.root + (presetId === "bass-c" && stepInBar >= 10 ? 7 : 0);
    this.oscillatorVoice({
      frequency: midiToFrequency(note),
      time,
      duration: this.stepDuration * (presetId === "bass-a" ? 3.2 : 1.6),
      type: "triangle",
      peak: 0.12
    });
  }

  playBacking(step, time, presetId) {
    const stepInBar = step % STEPS_PER_BAR;
    const harmonyChanged = isHarmonyChangeStep(step);
    const shouldPlay = presetId === "backing-a"
      ? harmonyChanged
      : presetId === "backing-b"
        ? harmonyChanged || [0, 8].includes(stepInBar)
        : harmonyChanged || [2, 6, 10, 14].includes(stepInBar);
    if (!shouldPlay) return;

    const desiredDurationSteps = presetId === "backing-a"
      ? stepsUntilHarmonyChange(step) - 0.5
      : presetId === "backing-b" ? 2.4 : 1.2;
    const durationSteps = Math.max(0.5, Math.min(desiredDurationSteps, stepsUntilHarmonyChange(step) - 0.1));
    const duration = this.stepDuration * durationSteps;
    const type = presetId === "backing-b" ? "sine" : presetId === "backing-c" ? "square" : "triangle";
    const harmony = harmonyAtStep(step);
    for (const [index, note] of harmony.notes.entries()) {
      this.oscillatorVoice({
        frequency: midiToFrequency(note + 12),
        time: time + index * 0.008,
        duration,
        type,
        peak: presetId === "backing-c" ? 0.025 : 0.035
      });
    }
  }

  playMidiDrum(note, time, velocity) {
    const level = Math.max(0.05, velocity / 127);
    if (note === 35 || note === 36) {
      this.playKick(time, level);
      return;
    }
    if (note === 38 || note === 39 || note === 40) {
      this.playNoise(time, 0.12, 0.13 * level, 720);
      return;
    }
    if (note === 42 || note === 44) {
      this.playNoise(time, 0.038, 0.045 * level, 5200);
      return;
    }
    if (note === 46 || note === 49) {
      this.playNoise(time, note === 49 ? 0.32 : 0.14, 0.065 * level, 3800);
      return;
    }
    this.playNoise(time, 0.075, 0.07 * level, 1300 + (note - 36) * 180);
  }

  playMidiNote(part, note, time, durationSteps, velocity, presets, maximumDurationSeconds, onEnded) {
    if (part === "d") {
      this.playMidiDrum(note, time, velocity);
      return;
    }

    const level = Math.max(0.06, velocity / 127);
    const partName = PART_NAME_BY_CODE[part];
    const soundConfig = partName ? this.partSoundSettings?.parts[partName] : null;
    const duration = resolveMidiDurationSeconds({
      part,
      durationSteps,
      stepDuration: this.stepDuration,
      maximumDurationSeconds,
      settings: this.audioSettings,
      soundConfig
    });
    let type = "sine";
    if (part === "b") {
      type = presets.bassId === "bass-b" ? "sawtooth" : presets.bassId === "bass-c" ? "square" : "triangle";
    } else if (part === "c") {
      type = presets.backingId === "backing-b" ? "sine" : presets.backingId === "backing-c" ? "square" : "triangle";
    } else if (part === "l") {
      type = "triangle";
    }

    if (soundConfig) type = soundConfig.waveform;
    const peak = soundConfig?.gain ?? resolveTrackPeakGain(part, this.audioSettings);
    const frequency = midiToFrequency(note);
    const layers = [{ frequency, type, peak: peak * level }];
    if (part === "b" && this.audioSettings.bassHarmonicEnabled) {
      layers.push({
        frequency: frequency * 2 ** (this.audioSettings.bassHarmonicSemitones / 12),
        type: "sawtooth",
        peak: (soundConfig
          ? peak * (this.audioSettings.bassHarmonicPeakGain / this.audioSettings.bassPeakGain)
          : this.audioSettings.bassHarmonicPeakGain) * level,
        lowpassHz: this.audioSettings.bassHarmonicLowpassHz
      });
    }
    if (part === "c" && this.audioSettings.chordHarmonicEnabled) {
      layers.push({
        frequency,
        type: "sawtooth",
        peak: peak * this.audioSettings.chordHarmonicGainRatio * level,
        lowpassHz: this.audioSettings.chordHarmonicLowpassHz
      });
    }

    return this.layeredOscillatorVoice({
      layers,
      time,
      duration,
      destination: typeof this.getPartDestination === "function" ? this.getPartDestination(part) : this.master,
      onEnded,
      envelopeOptions: soundConfig
    });
  }

  stopMidiPartVoices(part, time) {
    const activeVoices = this.midiPartVoices.get(part);
    if (!activeVoices) return;
    for (const voice of activeVoices) voice.stop(time);
    activeVoices.clear();
  }

  trackMidiPartVoice(part, voice) {
    if (!voice) return;
    let activeVoices = this.midiPartVoices.get(part);
    if (!activeVoices) {
      activeVoices = new Set();
      this.midiPartVoices.set(part, activeVoices);
    }
    activeVoices.add(voice);
  }

  playMidiTracks(step, time, trackPatterns, presets) {
    const partCodes = { drum: "d", bass: "b", chord: "c", arp: "a", lead: "l" };
    for (const [track, partCode] of Object.entries(partCodes)) {
      const patternId = trackPatterns?.[track] ?? "midi-loop-1";
      const pattern = MIDI_PATTERNS[patternId] ?? MIDI_PATTERNS["midi-loop-1"];
      const events = pattern.eventsByStep[step] ?? [];
      const partEvents = events.filter(([part]) => part === partCode);
      const extensionEnabled = isShortNoteExtensionEnabled(partCode, this.audioSettings);
      let maximumDurationSeconds = Number.POSITIVE_INFINITY;
      if (extensionEnabled && partEvents.length > 0) {
        this.stopMidiPartVoices(partCode, time);
        maximumDurationSeconds = stepsUntilNextPartOnset(pattern, partCode, step)
          * this.stepDuration
          * this.audioSettings.overlapGuardRatio;
      }
      for (const [part, note, durationSteps, velocity] of partEvents) {
        let voice;
        const onEnded = extensionEnabled
          ? () => this.midiPartVoices.get(part)?.delete(voice)
          : undefined;
        voice = this.playMidiNote(
          part,
          note,
          time,
          durationSteps,
          velocity,
          presets,
          maximumDurationSeconds,
          onEnded
        );
        if (extensionEnabled) this.trackMidiPartVoice(part, voice);
      }
    }
  }

  createFallbackPadVoice(padId, time, duration, sustained, onEnded) {
    const frequency = [196, 247, 294, 370, 440, 523, 659, 784][padId];
    const oscillator = this.context.createOscillator();
    const modulator = this.context.createOscillator();
    const modGain = this.context.createGain();
    const gain = this.context.createGain();
    oscillator.type = padId % 3 === 0 ? "square" : padId % 3 === 1 ? "triangle" : "sawtooth";
    oscillator.frequency.value = frequency;
    modulator.frequency.value = 7 + padId;
    modGain.gain.value = 5 + padId * 1.5;
    modulator.connect(modGain).connect(oscillator.frequency);
    oscillator.connect(gain).connect(this.master);
    const voiceDuration = sustained ? Math.max(duration, 0.08) : 0.16 + (padId % 4) * 0.055;
    this.envelope(gain, time, 0.09, 0.004, voiceDuration, sustained ? 0.04 : 0.08);
    oscillator.start(time);
    modulator.start(time);
    oscillator.stop(time + voiceDuration + 0.06);
    modulator.stop(time + voiceDuration + 0.06);
    return this.trackVoice([oscillator, modulator], gain, onEnded);
  }

  createPadVoice(padId, time, duration, sustained) {
    const buffer = this.padBuffers.get(padId);
    const clearCurrentVoice = (endedVoice) => {
      if (this.livePadVoices.get(padId) === endedVoice) this.livePadVoices.delete(padId);
    };
    if (!buffer) {
      const fallbackVoice = this.createFallbackPadVoice(padId, time, duration, sustained, clearCurrentVoice);
      this.livePadVoices.set(padId, fallbackVoice);
      return fallbackVoice;
    }

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.82, Math.max(time, this.context.currentTime));
    source.connect(gain).connect(this.master);
    source.start(time);
    if (sustained) source.stop(time + Math.min(duration, buffer.duration));

    let voice;
    voice = this.trackVoice([source], gain, clearCurrentVoice);
    this.livePadVoices.set(padId, voice);
    return voice;
  }

  playPad(padId, time) {
    const oldVoice = this.livePadVoices.get(padId);
    if (oldVoice) oldVoice.stop(time);
    return this.createPadVoice(padId, time, 0, false);
  }

  async triggerLivePad(padId) {
    await this.ensureReady();
    const time = this.context.currentTime;
    const oldVoice = this.livePadVoices.get(padId);
    if (oldVoice) oldVoice.stop(time);
    return this.createPadVoice(padId, time, 0, false);
  }

  async triggerTitleSample() {
    return this.triggerLivePad(TITLE_SAMPLE_ID);
  }

  async triggerCountInClick(accent = false) {
    await this.ensureReady();
    return this.oscillatorVoice({
      frequency: accent ? 1320 : 990,
      time: this.context.currentTime,
      duration: 0.055,
      type: "square",
      peak: accent ? 0.09 : 0.065
    });
  }

  scheduleRecordedEvents(step, time, state) {
    for (const event of state.padEvents) {
      if (event.step === step) this.playPad(event.padId, time);
    }
  }

  scheduleStep(absoluteStep, time) {
    const step = absoluteStep % LOOP_STEPS;
    if (step % STEPS_PER_BAR === 0) this.onBarBoundary?.(step / STEPS_PER_BAR);
    const state = this.getMusicState();
    this.playMidiTracks(step, time, state.trackPatterns, state.presets);
    this.scheduleRecordedEvents(step, time, state);

    const delay = Math.max(0, (time - this.context.currentTime) * 1000);
    window.setTimeout(() => {
      if (this.playing) this.onStep?.(step);
    }, delay);
  }

  schedulerTick() {
    if (!this.playing) return;
    const horizon = this.context.currentTime + 0.12;
    while (this.nextStepTime < horizon) {
      this.scheduleStep(this.nextAbsoluteStep, this.nextStepTime);
      this.nextAbsoluteStep += 1;
      this.nextStepTime += this.stepDuration;
    }
  }

  async play() {
    await this.ensureReady();
    this.stop({ resetDisplay: false });
    this.playing = true;
    this.originTime = this.context.currentTime + 0.08;
    this.nextStepTime = this.originTime;
    this.nextAbsoluteStep = 0;
    this.timer = window.setInterval(() => this.schedulerTick(), 25);
    this.schedulerTick();
  }

  stop({ resetDisplay = true } = {}) {
    this.playing = false;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
    this.livePadVoices.clear();
    this.midiPartVoices.clear();
    if (resetDisplay) this.onStep?.(0);
  }

  currentAbsoluteStepFloat() {
    if (!this.playing || !this.context) return 0;
    return Math.max(0, (this.context.currentTime - this.originTime) / this.stepDuration);
  }
}








