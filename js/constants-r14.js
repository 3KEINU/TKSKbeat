export const FORMAT_VERSION = "v2";
export const BPM = 144;
export const STEPS_PER_BEAT = 4;
export const BEATS_PER_BAR = 4;
export const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR;
export const BARS_PER_LOOP = 16;
export const LOOP_STEPS = STEPS_PER_BAR * BARS_PER_LOOP;
export const MAX_DURATION = LOOP_STEPS;
export const MAX_PAD_EVENTS = 256;
export const MAX_RIBBON_EVENTS = 128;
export const TRACK_PARTS = ["drum", "bass", "chord", "arp", "lead"];
export const MIDI_PATTERN_IDS = new Set([
  "midi-loop-1",
  "midi-loop-2",
  "midi-loop-3",
  "midi-loop-4",
  "midi-loop-5"
]);
export const DEFAULT_TRACK_PATTERNS = Object.freeze(Object.fromEntries(
  TRACK_PARTS.map((part) => [part, "midi-loop-1"])
));
export const PAD_SAMPLES = [
  { id: "pad-1", key: "01", label: "DEKIRUZO", file: "pad-1-r9.mp3" },
  { id: "pad-2", key: "02", label: "HINA DREAM", file: "pad-2-r9.mp3" },
  { id: "pad-3", key: "03", label: "TAKATAKA", file: "pad-3-r9.mp3" },
  { id: "pad-4", key: "04", label: "TAKASAKI", file: "pad-4-r9.mp3" },
  { id: "pad-5", key: "05", label: "GENKI", file: "pad-5-r9.mp3" },
  { id: "pad-6", key: "06", label: "HINA KOTO", file: "pad-6-r9.mp3" },
  { id: "pad-7", key: "07", label: "HINA DESU", file: "pad-7-r9.mp3" },
  { id: "pad-8", key: "08", label: "OKASAN", file: "pad-8-r9.mp3" },
  { id: "pad-a", key: "A", label: "DR KICK", file: "pad-a-r9.mp3" },
  { id: "pad-b", key: "B", label: "DR SN", file: "pad-b-r9.mp3" },
  { id: "pad-c", key: "C", label: "DR HH", file: "pad-c-r9.mp3" },
  { id: "pad-d", key: "D", label: "DR CRUSH", file: "pad-d-r9.mp3" }
];
export const PAD_COUNT = PAD_SAMPLES.length;
export const PAD_LABELS = PAD_SAMPLES.map((sample) => sample.label);
export const TITLE_SAMPLE = Object.freeze({ id: "title-z", key: "Z", label: "TKSKBEAT", file: "title-z-r9.mp3" });
export const TITLE_SAMPLE_ID = PAD_COUNT;
export const AUDIO_SAMPLES = Object.freeze([...PAD_SAMPLES, TITLE_SAMPLE]);

export const HARMONY_TIMELINE = [
  { startStep: 0, label: "Ab", root: 44, notes: [56, 60, 63] },
  { startStep: 16, label: "Bb", root: 46, notes: [58, 62, 65] },
  { startStep: 32, label: "Gm7", root: 43, notes: [55, 58, 62, 65] },
  { startStep: 48, label: "Cm7", root: 36, notes: [60, 63, 67, 70] },
  { startStep: 64, label: "Fm7", root: 41, notes: [53, 56, 60, 63] },
  { startStep: 80, label: "Bb7", root: 46, notes: [58, 62, 65, 68] },
  { startStep: 96, label: "Eb", root: 39, notes: [51, 55, 58] },
  { startStep: 112, label: "Eb7", root: 39, notes: [51, 55, 58, 61] },
  { startStep: 128, label: "Ab", root: 44, notes: [56, 60, 63] },
  { startStep: 142, label: "Gm7", root: 43, notes: [55, 58, 62, 65] },
  { startStep: 150, label: "Cm7", root: 36, notes: [60, 63, 67, 70] },
  { startStep: 160, label: "Ab", root: 44, notes: [56, 60, 63] },
  { startStep: 174, label: "Gm7", root: 43, notes: [55, 58, 62, 65] },
  { startStep: 182, label: "Eb7", root: 39, notes: [51, 55, 58, 61] },
  { startStep: 192, label: "Ab", root: 44, notes: [56, 60, 63] },
  { startStep: 206, label: "Gm7", root: 43, notes: [55, 58, 62, 65] },
  { startStep: 214, label: "Gdim", root: 43, notes: [55, 58, 61] },
  { startStep: 224, label: "Ab", root: 44, notes: [56, 60, 63] },
  { startStep: 234, label: "Bb7", root: 46, notes: [58, 62, 65, 68] },
  { startStep: 240, label: "Eb", root: 39, notes: [51, 55, 58] }
];

// 旧名は外部参照との互換用。内容は小節配列ではなくループ全体のタイムライン。
export const CHORD_PROGRESSION = HARMONY_TIMELINE;

const HARMONY_CHANGE_STEPS = new Set(HARMONY_TIMELINE.map((harmony) => harmony.startStep));

function loopStepOf(step) {
  return ((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
}

export function harmonyAtStep(step) {
  const loopStep = loopStepOf(step);
  for (let index = HARMONY_TIMELINE.length - 1; index >= 0; index -= 1) {
    if (loopStep >= HARMONY_TIMELINE[index].startStep) return HARMONY_TIMELINE[index];
  }
  return HARMONY_TIMELINE[0];
}

export function isHarmonyChangeStep(step) {
  return HARMONY_CHANGE_STEPS.has(loopStepOf(step));
}

export function stepsUntilHarmonyChange(step) {
  const loopStep = loopStepOf(step);
  const next = HARMONY_TIMELINE.find((harmony) => harmony.startStep > loopStep);
  return (next?.startStep ?? LOOP_STEPS) - loopStep;
}

// 仮スケール。音楽素材確定後に SPEC.md と合わせて差し替える。
export const RIBBON_NOTES = [60, 62, 64, 67, 69, 72, 74, 76];

export const PRESETS = {
  drum: [
    { id: "drum-a", label: "BOUNCE" },
    { id: "drum-b", label: "SKIP" },
    { id: "drum-c", label: "MARCH" }
  ],
  bass: [
    { id: "bass-a", label: "ROUND" },
    { id: "bass-b", label: "HOP" },
    { id: "bass-c", label: "WALK" }
  ],
  backing: [
    { id: "backing-a", label: "PLASTIC" },
    { id: "backing-b", label: "BELL" },
    { id: "backing-c", label: "PUFF" }
  ],
  sequence: [
    { id: "sequence-a", label: "SPARK" },
    { id: "sequence-b", label: "PIXEL" },
    { id: "sequence-c", label: "TWINKLE" },
    { id: "midi-loop-1", label: "LOOP 1" },
    { id: "midi-loop-2", label: "LOOP 2" },
    { id: "midi-loop-3", label: "LOOP 3" },
    { id: "midi-loop-4", label: "LOOP 4" },
    { id: "midi-loop-5", label: "LOOP 5" }
  ]
};

export const PRESET_IDS = Object.fromEntries(
  Object.entries(PRESETS).map(([part, presets]) => [part, new Set(presets.map((preset) => preset.id))])
);
