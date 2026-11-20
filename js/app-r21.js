import { AudioEngine } from "./audio-engine-r18.js";
import {
  harmonyAtStep,
  LOOP_STEPS,
  MAX_PAD_EVENTS,
  PAD_LABELS,
  PAD_SAMPLES,
  TRACK_PARTS,
  STEPS_PER_BAR
} from "./constants-r14.js";
import { MIDI_PATTERN_OPTIONS } from "./midi-patterns-r14.js";
import { initializeSoundEditor } from "./sound-editor-ui-r17.js";
import { createDefaultSoundSettings } from "./sound-editor-settings-r17.js";
import { createSpectrumAnalyzer } from "./spectrum-analyzer-r19.js";
import {
  createTutorialGuideState,
  tutorialGuideMessage,
  updateTutorialGuide
} from "./tutorial-guide-r17.js";
import { buildShareUrl, readMusicStateFromHash } from "./codec-r14.js";
import {
  beginRecordingSession,
  createInitialMusicState,
  mod,
  prepareTrackForInput,
  quantizeAbsoluteStep,
  upsertPadEvent
} from "./model-r14.js";

const elements = {
  body: document.body,
  spectrum: document.querySelector("#lcd-spectrum"),
  lcdStatus: document.querySelector("#lcd-status"),
  lcdCharacter: document.querySelector("#lcd-character"),
  position: document.querySelector("#position-display"),
  meter: document.querySelector("#meter-fill"),
  play: document.querySelector("#play-button"),
  rec: document.querySelector("#rec-button"),
  finish: document.querySelector("#finish-button"),
  operationGrid: document.querySelector("#operation-grid"),
  playIcon: document.querySelector("#play-button .control-icon"),
  playLabel: document.querySelector("#play-button .control-label"),
  recIcon: document.querySelector("#rec-button .control-icon"),
  recLabel: document.querySelector("#rec-button .control-label"),
  titleSound: document.querySelector("#title-sound"),
  creditButton: document.querySelector("#credit-button"),
  creditsDialog: document.querySelector("#credits-dialog"),
  padGrid: document.querySelector("#pad-grid"),
  padCount: document.querySelector("#pad-count"),
  result: document.querySelector("#result"),
  resultCopy: document.querySelector("#result-copy"),
  resultVisualBackground: document.querySelector("#result-visual-background"),
  resultVisual: document.querySelector("#result-visual"),
  resultVisualSticker: document.querySelector("#result-visual-sticker"),
  resultVisualCaption: document.querySelector("#result-visual-caption"),
  resultPlay: document.querySelector("#result-play"),
  copyLink: document.querySelector("#copy-link"),
  backToEdit: document.querySelector("#back-to-edit"),
  newBeat: document.querySelector("#new-beat"),
  tabs: [...document.querySelectorAll("[data-tab]")],
  tabPanels: [...document.querySelectorAll("[role='tabpanel']")],
  trackPatterns: Object.fromEntries(TRACK_PARTS.map((part) => [part, document.querySelector(`#${part}-pattern`)]))
};

const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const hasSharedState = hashParams.has("s");
const loadedState = readMusicStateFromHash();
const openedFromShare = Boolean(loadedState);
const MELODY_VISUALS = Object.freeze({
  "midi-loop-1": {
    src: "./images/characters/melody-loop-1-r11.png",
    alt: "基本姿のTKSKbird",
    label: "メロディ • LOOP 1",
    scale: 0.78,
    position: "50% 51%"
  },
  "midi-loop-2": {
    src: "./images/characters/melody-loop-2-r11.png",
    alt: "ストリート衣装で歌うTKSKbird",
    label: "メロディ • LOOP 2",
    scale: 0.84,
    position: "50% 52%"
  },
  "midi-loop-3": {
    src: "./images/characters/melody-loop-3-r15.png",
    alt: "妖精衣装のTKSKbird",
    label: "メロディ • LOOP 3",
    scale: 0.82,
    position: "52% 51%"
  },
  "midi-loop-4": {
    src: "./images/characters/melody-loop-4-r15.png",
    alt: "歌舞伎衣装のTKSKbird",
    label: "メロディ • LOOP 4",
    scale: 0.86,
    position: "50% 52%"
  },
  "midi-loop-5": {
    src: "./images/characters/melody-loop-5-r15.png",
    alt: "パーティー衣装のTKSKbird",
    label: "メロディ • LOOP 5",
    scale: 0.9,
    position: "50% 52%"
  }
});
const CHORD_BACKGROUNDS = Object.freeze({
  "midi-loop-1": {
    src: "./images/backgrounds/chord-loop-1-r20.png",
    label: "コード • LOOP 1"
  },
  "midi-loop-2": {
    src: "./images/backgrounds/chord-loop-2-r20.png",
    label: "コード • LOOP 2"
  },
  "midi-loop-3": {
    src: "./images/backgrounds/chord-loop-3-r20.png",
    label: "コード • LOOP 3"
  },
  "midi-loop-4": {
    src: "./images/backgrounds/chord-loop-4-r20.png",
    label: "コード • LOOP 4"
  },
  "midi-loop-5": {
    src: "./images/backgrounds/chord-loop-5-r20.png",
    label: "コード • LOOP 5"
  }
});
const BASS_STICKERS = Object.freeze({
  "midi-loop-1": {
    src: "./images/stickers/bass-loop-1-r21.png",
    alt: "GOOD VIBESステッカー",
    label: "ベース • LOOP 1",
    width: "24%",
    left: "5%",
    top: "6%",
    rotate: "-7deg"
  },
  "midi-loop-2": {
    src: "./images/stickers/bass-loop-2-r21.png",
    alt: "HAVE A GOOD DAYステッカー",
    label: "ベース • LOOP 2",
    width: "25%",
    left: "70%",
    top: "7%",
    rotate: "6deg"
  },
  "midi-loop-3": {
    src: "./images/stickers/bass-loop-3-r21.png",
    alt: "POSITIVE ENERGYステッカー",
    label: "ベース • LOOP 3",
    width: "38%",
    left: "4%",
    top: "5%",
    rotate: "-4deg"
  },
  "midi-loop-4": {
    src: "./images/stickers/bass-loop-4-r21.png",
    alt: "GOOD VIBES ONLYステッカー",
    label: "ベース • LOOP 4",
    width: "27%",
    left: "5%",
    top: "68%",
    rotate: "-5deg"
  },
  "midi-loop-5": {
    src: "./images/stickers/bass-loop-5-r21.png",
    alt: "虹のステッカー",
    label: "ベース • LOOP 5",
    width: "30%",
    left: "66%",
    top: "5%",
    rotate: "5deg"
  }
});
let musicState = loadedState ?? createInitialMusicState();
let activeTrackPatterns = { ...musicState.trackPatterns };
let finished = Boolean(loadedState);
let playing = false;
let recording = false;
let recordMode = "overdub";
let recordingSession = null;
let activeTab = "pico";
let countingIn = false;
let countInToken = 0;
let lcdMessage = loadedState ? "SHARED BEAT • PRESS PLAY" : hasSharedState ? "LINK ERROR • NEW SESSION" : "READY • PRESS PLAY";
let messageTimer = null;
let voiceExitTimer = null;
let tutorialGuideState = createTutorialGuideState();
let soundEditor = null;
const VOICE_EXIT_DELAY_MS = 3000;
const spectrumAnalyzer = createSpectrumAnalyzer(elements.spectrum);

const engine = new AudioEngine({
  getMusicState: () => ({ ...musicState, trackPatterns: activeTrackPatterns }),
  partSoundSettings: createDefaultSoundSettings(),
  onAnalyserReady: (analyser) => spectrumAnalyzer.attach(analyser),
  onStep: updatePosition,
  onBarBoundary: () => {
    activeTrackPatterns = { ...musicState.trackPatterns };
    renderTrackPatterns();
  }
});

// Developer-only A/B controls. These do not add settings to the public UI.
window.__TKSKBEAT_AUDIO_DEBUG__ = Object.freeze({
  getSettings: () => engine.getAudioSettings(),
  setSettings: (overrides) => engine.setAudioSettings(overrides),
  useMobileSpeakerPreset: () => engine.useAudioSettingsPreset("mobileSpeaker"),
  useR15LegacyPreset: () => engine.useAudioSettingsPreset("r15Legacy"),
  getDiagnostics: () => engine.getAudioDiagnostics(),
  getSpectrumAnalyzerDiagnostics: () => spectrumAnalyzer.getDiagnostics(),
  getSoundSettings: () => soundEditor?.getSettings() ?? null,
  setSoundSettings: (settings) => soundEditor?.setSettings(settings) ?? null,
  resetSoundSettings: () => soundEditor?.reset() ?? null,
  exportSoundSettingsJson: () => soundEditor?.exportJson() ?? null
});

function clearMessageTimer() {
  if (!messageTimer) return;
  window.clearTimeout(messageTimer);
  messageTimer = null;
}

function clearVoiceExitTimer() {
  if (!voiceExitTimer) return;
  window.clearTimeout(voiceExitTimer);
  voiceExitTimer = null;
}

function currentGuideMessage() {
  if (recording && activeTab !== "voice") return `${recordModeLabel()} • 録音中`;
  return tutorialGuideMessage(tutorialGuideState);
}

function showGuideMessage() {
  if (countingIn || finished) return;
  clearMessageTimer();
  lcdMessage = currentGuideMessage();
  elements.lcdStatus.textContent = lcdMessage;
}

function transitionGuide(event, display = true) {
  tutorialGuideState = updateTutorialGuide(tutorialGuideState, event);
  if (display) showGuideMessage();
}

function scheduleVoiceExitGuide() {
  clearVoiceExitTimer();
  if (activeTab !== "voice" || tutorialGuideState.voice.stage !== 5) return;
  voiceExitTimer = window.setTimeout(() => {
    voiceExitTimer = null;
    if (activeTab !== "voice" || recording || countingIn) return;
    transitionGuide({ type: "voice-exit-ready" });
  }, VOICE_EXIT_DELAY_MS);
}

function switchTab(tabName, focus = false) {
  if (!elements.tabs.some((tab) => tab.dataset.tab === tabName)) return;
  clearVoiceExitTimer();
  activeTab = tabName;
  transitionGuide({
    type: "enter-tab",
    tab: tabName,
    playing,
    recording
  }, false);
  for (const tab of elements.tabs) {
    const selected = tab.dataset.tab === activeTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  for (const panel of elements.tabPanels) {
    panel.hidden = panel.id !== `${activeTab}-panel`;
  }
  elements.operationGrid.dataset.activeTab = activeTab;
  elements.rec.hidden = activeTab !== "voice";
  showGuideMessage();
}

function recordModeLabel() {
  return recordMode === "overwrite" ? "やり直し" : "つぎたし";
}

function announce(message, timeout = 1600) {
  lcdMessage = message;
  elements.lcdStatus.textContent = message;
  clearMessageTimer();
  if (timeout) {
    messageTimer = window.setTimeout(() => {
      messageTimer = null;
      if (countingIn) {
        lcdMessage = "COUNT IN";
        elements.lcdStatus.textContent = lcdMessage;
        return;
      }
      showGuideMessage();
    }, timeout);
  }
}

function bop() {
  elements.lcdCharacter.classList.remove("bop");
  requestAnimationFrame(() => elements.lcdCharacter.classList.add("bop"));
}

function updatePosition(step) {
  const bar = Math.floor(step / STEPS_PER_BAR) + 1;
  const stepInBar = (step % STEPS_PER_BAR) + 1;
  const harmony = harmonyAtStep(step);
  const patternDigits = TRACK_PARTS.map((part) => activeTrackPatterns[part].replace("midi-loop-", "")).join("");
  const patternSummary = /^1+$/.test(patternDigits) ? "ALL 1" : /^2+$/.test(patternDigits) ? "ALL 2" : `MIX ${patternDigits}`;
  elements.position.textContent = `BAR ${bar} · ${harmony.label} · ${patternSummary} · STEP ${String(stepInBar).padStart(2, "0")}`;
  elements.meter.style.width = `${((step + 1) / LOOP_STEPS) * 100}%`;
}

function renderTrackPatterns() {
  for (const [part, select] of Object.entries(elements.trackPatterns)) {
    select.value = musicState.trackPatterns[part];
    select.disabled = finished;
  }
}

function renderResultVisual() {
  const visual = MELODY_VISUALS[musicState.trackPatterns.lead] ?? MELODY_VISUALS["midi-loop-1"];
  const background = CHORD_BACKGROUNDS[musicState.trackPatterns.chord] ?? CHORD_BACKGROUNDS["midi-loop-1"];
  const sticker = BASS_STICKERS[musicState.trackPatterns.bass] ?? BASS_STICKERS["midi-loop-1"];
  if (elements.resultVisualBackground.getAttribute("src") !== background.src) {
    elements.resultVisualBackground.src = background.src;
  }
  if (elements.resultVisual.getAttribute("src") !== visual.src) elements.resultVisual.src = visual.src;
  elements.resultVisual.alt = visual.alt;
  elements.resultVisual.style.setProperty("--character-scale", visual.scale);
  elements.resultVisual.style.setProperty("--character-position", visual.position);
  if (elements.resultVisualSticker.getAttribute("src") !== sticker.src) elements.resultVisualSticker.src = sticker.src;
  elements.resultVisualSticker.alt = sticker.alt;
  elements.resultVisualSticker.style.setProperty("--sticker-width", sticker.width);
  elements.resultVisualSticker.style.setProperty("--sticker-left", sticker.left);
  elements.resultVisualSticker.style.setProperty("--sticker-top", sticker.top);
  elements.resultVisualSticker.style.setProperty("--sticker-rotate", sticker.rotate);
  elements.resultVisualCaption.textContent = `${visual.label} / ${background.label} / ${sticker.label}`;
}

function render() {
  elements.operationGrid.dataset.activeTab = activeTab;
  elements.operationGrid.dataset.recording = String(recording);
  elements.rec.hidden = activeTab !== "voice";
  elements.rec.setAttribute("aria-pressed", String(recording));
  elements.rec.dataset.counting = String(countingIn);
  elements.rec.disabled = finished;
  elements.finish.disabled = finished;
  elements.playIcon.textContent = playing ? "■" : countingIn ? "×" : "▶";
  elements.playLabel.textContent = playing ? "停止" : countingIn ? "中止" : "再生";
  elements.play.setAttribute("aria-label", elements.playLabel.textContent);
  elements.recIcon.textContent = recording ? "■" : countingIn ? "×" : "●";
  elements.recLabel.textContent = recording ? "録音終了" : countingIn ? "中止" : "録音";
  elements.padCount.textContent = musicState.padEvents.length;
  elements.lcdStatus.textContent = lcdMessage;
  elements.result.hidden = !finished;
  elements.backToEdit.hidden = openedFromShare;
  if (finished) renderResultVisual();
  elements.resultPlay.textContent = playing ? "■ STOP" : "▶ PLAY";
  document.querySelectorAll("[data-record-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.recordMode === recordMode));
    button.disabled = finished || recording || countingIn;
  });
  document.querySelectorAll(".pad").forEach((button) => { button.disabled = finished; });
  renderTrackPatterns();
}

function prepareRecordingTrack(track) {
  if (!recording || !recordingSession) return;
  const prepared = prepareTrackForInput(musicState, recordingSession, track);
  musicState = prepared.state;
  recordingSession = prepared.session;
  render();
}

function addPadEvent(event) {
  const result = upsertPadEvent(musicState.padEvents, event);
  musicState = { ...musicState, padEvents: result.events };
  if (result.full) announce("PAD FULL • STILL PLAYING", 2200);
  render();
}

function recordPadHit(padId, inputTime, absoluteStep) {
  prepareRecordingTrack("pad");
  addPadEvent({
    step: mod(quantizeAbsoluteStep(absoluteStep), LOOP_STEPS),
    padId,
    _inputTime: inputTime
  });
}

function stopRecording() {
  recording = false;
  recordingSession = null;
  transitionGuide({ type: "recording-stopped" });
  scheduleVoiceExitGuide();
  render();
}

function startRecording() {
  clearVoiceExitTimer();
  recording = true;
  recordingSession = beginRecordingSession(recordMode);
  transitionGuide({ type: "recording-started" });
  render();
}

function cancelCountIn(message = "COUNT IN CANCELED") {
  if (!countingIn) return;
  countingIn = false;
  countInToken += 1;
  announce(message, 1200);
  render();
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function startCountIn() {
  const token = ++countInToken;
  const beatMilliseconds = 60000 / 144;
  countingIn = true;
  render();
  try {
    for (let remaining = 4; remaining >= 1; remaining -= 1) {
      if (!countingIn || token !== countInToken) return;
      announce(`COUNT IN • ${remaining}`, 0);
      await engine.triggerCountInClick(remaining === 4);
      await wait(beatMilliseconds);
    }
    if (!countingIn || token !== countInToken) return;
    countingIn = false;
    activeTrackPatterns = { ...musicState.trackPatterns };
    await engine.play();
    playing = true;
    startRecording();
  } catch (error) {
    console.error(error);
    countingIn = false;
    announce("AUDIO ERROR • TAP REC AGAIN", 0);
    render();
  }
}

async function toggleRecording() {
  if (finished) return;
  if (countingIn) {
    cancelCountIn();
    return;
  }
  if (recording) {
    stopRecording();
    return;
  }
  if (playing) {
    startRecording();
    return;
  }
  await startCountIn();
}

async function startPlayback() {
  try {
    announce("LOADING AUDIO...", 0);
    activeTrackPatterns = { ...musicState.trackPatterns };
    await engine.play();
    playing = true;
    if (finished) announce("FINISHED BEAT • PLAYING", 0);
    else transitionGuide({ type: "playback-started" });
    render();
  } catch (error) {
    console.error(error);
    announce("AUDIO ERROR • TAP PLAY AGAIN", 0);
  }
}

function stopPlayback() {
  if (recording) stopRecording();
  engine.stop();
  playing = false;
  if (finished) announce("FINISHED BEAT • READY", 0);
  else showGuideMessage();
  render();
}

async function togglePlayback() {
  if (countingIn) {
    cancelCountIn();
    return;
  }
  if (playing) stopPlayback();
  else await startPlayback();
}

function finishBeat() {
  if (finished) return;
  clearVoiceExitTimer();
  if (countingIn) cancelCountIn();
  if (recording) stopRecording();
  clearVoiceExitTimer();
  finished = true;
  const shareUrl = buildShareUrl(musicState);
  window.history.replaceState(null, "", shareUrl);
  elements.resultCopy.textContent = playing
    ? "編集をロックしました。曲はそのまま再生中！"
    : "完成した16小節を再生してみよう。";
  announce("FINISHED!", 0);
  render();
}

function returnToEditing() {
  if (!finished || openedFromShare) return;
  finished = false;
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(null, "", url.toString());
  transitionGuide({
    type: "enter-tab",
    tab: activeTab,
    playing,
    recording
  });
  render();
}

function createControls() {
  PAD_LABELS.forEach((label, padId) => {
    const sample = PAD_SAMPLES[padId];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pad";
    button.textContent = label;
    button.title = sample.file;
    button.setAttribute("aria-label", `Pad ${sample.key}: ${label}`);
    button.dataset.number = sample.key;
    button.dataset.padId = String(padId);
    button.style.setProperty("--pad-color", ["#ff7aa8", "#ff9d55", "#ffe15b", "#67d8b4", "#55bce7", "#8796ff", "#c78aeb", "#ff6f61", "#6ed5c3", "#7db4ff", "#d4a0ff", "#ff946e"][padId]);

    button.addEventListener("pointerdown", async (event) => {
      if (finished) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      button.classList.add("active");
      bop();
      transitionGuide({ type: "pad-pressed" });
      const inputTime = performance.now();
      const absoluteStart = engine.currentAbsoluteStepFloat();
      if (recording) recordPadHit(padId, inputTime, absoluteStart);
      await engine.triggerLivePad(padId);
    });

    const release = (event) => {
      button.classList.remove("active");
      if (event.pointerId && button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    elements.padGrid.append(button);
  });
}

function createTrackPatternOptions() {
  for (const [part, select] of Object.entries(elements.trackPatterns)) {
    for (const preset of MIDI_PATTERN_OPTIONS) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      select.append(option);
    }
    select.addEventListener("change", (event) => {
      const nextPattern = event.target.value;
      if (nextPattern === musicState.trackPatterns[part]) return;
      musicState = { ...musicState, trackPatterns: { ...musicState.trackPatterns, [part]: nextPattern } };
      if (!playing) activeTrackPatterns = { ...musicState.trackPatterns };
      transitionGuide({ type: "track-changed" });
      render();
    });
  }
}

document.querySelectorAll("[data-record-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    recordMode = button.dataset.recordMode;
    if (activeTab === "voice" && tutorialGuideState.voice.stage === 5) {
      clearVoiceExitTimer();
      transitionGuide({ type: "voice-exit-ready" });
    } else {
      showGuideMessage();
    }
    render();
  });
});

elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    switchTab(tab.dataset.tab === "pico" ? "voice" : "pico", true);
  });
});

elements.play.addEventListener("click", togglePlayback);
elements.rec.addEventListener("click", toggleRecording);
elements.finish.addEventListener("click", finishBeat);
elements.titleSound.addEventListener("click", async () => {
  try {
    bop();
    await engine.triggerTitleSample();
    announce("TKSKBEAT!", 900);
  } catch (error) {
    console.error(error);
    announce("TITLE AUDIO ERROR", 1200);
  }
});
elements.creditButton.addEventListener("click", () => elements.creditsDialog.showModal());
elements.creditsDialog.addEventListener("click", (event) => {
  if (event.target === elements.creditsDialog) elements.creditsDialog.close();
});
elements.resultPlay.addEventListener("click", togglePlayback);
elements.copyLink.addEventListener("click", async () => {
  const url = buildShareUrl(musicState);
  try {
    await navigator.clipboard.writeText(url);
    elements.copyLink.textContent = "COPIED!";
  } catch {
    window.prompt("このURLをコピーしてください", url);
  }
});
elements.backToEdit.addEventListener("click", returnToEditing);
elements.newBeat.addEventListener("click", () => {
  const url = new URL(window.location.href);
  url.hash = "";
  window.location.href = url.toString();
});

document.addEventListener("visibilitychange", () => {
  spectrumAnalyzer.setActive(!document.hidden);
  if (document.hidden && countingIn) cancelCountIn();
  if (document.hidden && playing) stopPlayback();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) spectrumAnalyzer.setActive(false);
  else spectrumAnalyzer.destroy();
});
window.addEventListener("pageshow", () => spectrumAnalyzer.setActive(!document.hidden));

createTrackPatternOptions();
createControls();
soundEditor = initializeSoundEditor({ engine, announce });
switchTab("pico");
updatePosition(0);
render();
document.documentElement.dataset.appReady = "true";
document.documentElement.dataset.release = "r21";








