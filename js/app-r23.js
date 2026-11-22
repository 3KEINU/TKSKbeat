import { AudioEngine } from "./audio-engine-r18.js";
import {
  LOOP_STEPS,
  MAX_PAD_EVENTS,
  PAD_LABELS,
  PAD_SAMPLES,
  TRACK_PARTS
} from "./constants-r14.js";
import { MIDI_PATTERN_OPTIONS } from "./midi-patterns-r14.js";
import { initializeSoundEditor } from "./sound-editor-ui-r17.js";
import { createDefaultSoundSettings } from "./sound-editor-settings-r17.js";
import { createSpectrumAnalyzer } from "./spectrum-analyzer-r19.js";
import {
  createTutorialGuideState,
  tutorialGuideMessage,
  updateTutorialGuide
} from "./tutorial-guide-r22.js";
import { advanceRecordingLoopGuide, createRecordingLoopGuide } from "./recording-loop-guide-r22.js";
import { buildShareUrl, readMusicStateFromHash } from "./codec-r14.js";
import {
  createJacketPngFile,
  renderVisualStage,
  resolveVisualLayers,
  VISUAL_LAYER_DEFINITIONS
} from "./visual-composition-r23.js";
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
  resultError: document.querySelector("#result-error"),
  resultVisualStage: document.querySelector("#result-visual-stage"),
  resultPlay: document.querySelector("#result-play"),
  resultPlayIcon: document.querySelector("#result-play-icon"),
  resultPlayLabel: document.querySelector("#result-play-label"),
  shareImage: document.querySelector("#share-image"),
  backToEdit: document.querySelector("#back-to-edit"),
  newBeat: document.querySelector("#new-beat"),
  tabs: [...document.querySelectorAll("[data-tab]")],
  tabPanels: [...document.querySelectorAll("[role='tabpanel']")],
  trackPatternGroups: Object.fromEntries(TRACK_PARTS.map((part) => [
    part,
    document.querySelector(`[data-track-part="${part}"] .track-pattern-buttons`)
  ]))
};

const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const hasSharedState = hashParams.has("s");
const loadedState = readMusicStateFromHash();
const openedFromShare = Boolean(loadedState);
const SHARE_TEXT = "陽菜ちゃん、お誕生日おめでとう！\nピコピコ鳴るやつ作ってみた！\n\n#TKSKbeat\n#高咲陽菜生誕祭2026";
let musicState = loadedState ?? createInitialMusicState();
let activeTrackPatterns = { ...musicState.trackPatterns };
let finished = Boolean(loadedState);
let playing = false;
let recording = false;
let recordMode = "overdub";
let recordingSession = null;
let recordingLoopGuide = null;
let lastPlaybackStep = 0;
let activeTab = "pico";
let countingIn = false;
let countInToken = 0;
let lcdMessage = loadedState ? "SHARED BEAT • PRESS PLAY" : hasSharedState ? "LINK ERROR • NEW SESSION" : "READY • PRESS PLAY";
let messageTimer = null;
let voiceExitTimer = null;
let tutorialGuideState = createTutorialGuideState();
let soundEditor = null;
let shareFilePromise = null;
let shareFilePatternKey = "";
const VOICE_EXIT_DELAY_MS = 3000;
const BEAT_FACE_DURATION_MS = 120;
let beatFaceTimer = null;
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

window.__TKSKBEAT_VISUAL_DEBUG__ = Object.freeze({
  layerDefinitions: VISUAL_LAYER_DEFINITIONS,
  resolveLayers: (patterns = musicState.trackPatterns) => resolveVisualLayers(patterns),
  createJacketPngFile: (patterns = musicState.trackPatterns, options) => createJacketPngFile(patterns, options)
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

function resetBeatFace() {
  window.clearTimeout(beatFaceTimer);
  beatFaceTimer = null;
  elements.lcdCharacter.classList.remove("is-beat");
}

function pulseBeatFace() {
  window.clearTimeout(beatFaceTimer);
  elements.lcdCharacter.classList.add("is-beat");
  beatFaceTimer = window.setTimeout(resetBeatFace, BEAT_FACE_DURATION_MS);
}

function bop() {
  elements.lcdCharacter.classList.remove("bop");
  requestAnimationFrame(() => elements.lcdCharacter.classList.add("bop"));
}

function updatePosition(step) {
  lastPlaybackStep = step;
  if (!engine.playing) resetBeatFace();
  else if (step % 4 === 0) pulseBeatFace();
  if (recording && recordingLoopGuide) {
    const advanced = advanceRecordingLoopGuide(recordingLoopGuide, step, LOOP_STEPS);
    recordingLoopGuide = advanced.state;
    if (advanced.shouldAnnounce) transitionGuide({ type: "recording-loop-complete" });
  }
  elements.meter.style.width = `${((step + 1) / LOOP_STEPS) * 100}%`;
}

function renderTrackPatterns() {
  for (const [part, group] of Object.entries(elements.trackPatternGroups)) {
    for (const button of group.querySelectorAll(".track-pattern-button")) {
      const selected = button.dataset.patternId === musicState.trackPatterns[part];
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = finished;
    }
  }
}

function clearResultError() {
  elements.resultError.hidden = true;
  elements.resultError.textContent = "";
}

function showResultError(message) {
  elements.resultError.textContent = message;
  elements.resultError.hidden = false;
}

function renderResultVisual() {
  renderVisualStage(elements.resultVisualStage, musicState.trackPatterns);
}

function ensureShareFile() {
  const patternKey = JSON.stringify(musicState.trackPatterns);
  if (!shareFilePromise || shareFilePatternKey !== patternKey) {
    shareFilePatternKey = patternKey;
    shareFilePromise = createJacketPngFile(musicState.trackPatterns, { size: 1200 });
  }
  return shareFilePromise;
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
  if (finished) {
    renderResultVisual();
    ensureShareFile().catch((error) => console.error(error));
  }
  elements.resultPlayIcon.textContent = playing ? "■" : "▶";
  elements.resultPlayLabel.textContent = playing ? "STOP" : "PLAY";
  elements.resultPlay.setAttribute("aria-label", playing ? "完成したビートを停止" : "完成したビートを再生");
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
  recordingLoopGuide = null;
  transitionGuide({ type: "recording-stopped" });
  scheduleVoiceExitGuide();
  render();
}

function startRecording() {
  clearVoiceExitTimer();
  recording = true;
  recordingSession = beginRecordingSession(recordMode);
  recordingLoopGuide = createRecordingLoopGuide(lastPlaybackStep, LOOP_STEPS);
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
    if (finished) clearResultError();
    announce("LOADING AUDIO...", 0);
    activeTrackPatterns = { ...musicState.trackPatterns };
    await engine.play();
    playing = true;
    if (finished) announce("FINISHED BEAT • PLAYING", 0);
    else transitionGuide({ type: "playback-started" });
    render();
  } catch (error) {
    console.error(error);
    if (finished) showResultError("再生できませんでした。もう一度お試しください。");
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
  clearResultError();
  announce("FINISHED!", 0);
  render();
}

function returnToEditing() {
  if (!finished || openedFromShare) return;
  clearResultError();
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

function publicShareUrl() {
  return buildShareUrl(musicState);
}

function downloadFile(file) {
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function copyShareFallback(text, url) {
  const value = `${text}\n${url}`;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    window.prompt("この投稿文とURLをコピーしてください", value);
  }
}

async function shareJacketImage() {
  const originalLabel = elements.shareImage.textContent;
  clearResultError();
  elements.shareImage.disabled = true;
  elements.shareImage.textContent = "PNG生成中…";
  try {
    const file = await ensureShareFile();
    const url = publicShareUrl();
    const shareData = { files: [file], text: `${SHARE_TEXT}\n${url}` };
    if (navigator.share && navigator.canShare?.({ files: shareData.files })) {
      elements.shareImage.textContent = "共有先を選んでね";
      await navigator.share(shareData);
      return;
    }
    downloadFile(file);
    await copyShareFallback(SHARE_TEXT, url);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      showResultError(`共有できませんでした: ${error?.message ?? "もう一度お試しください"}`);
    }
  } finally {
    elements.shareImage.disabled = false;
    elements.shareImage.textContent = originalLabel;
  }
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

function selectTrackPattern(part, nextPattern) {
  if (nextPattern === musicState.trackPatterns[part]) return;
  musicState = { ...musicState, trackPatterns: { ...musicState.trackPatterns, [part]: nextPattern } };
  if (!playing) activeTrackPatterns = { ...musicState.trackPatterns };
  transitionGuide({ type: "track-changed" });
  render();
}

function createTrackPatternControls() {
  for (const [part, group] of Object.entries(elements.trackPatternGroups)) {
    const trackLabel = group.closest(".track-pattern-row")?.querySelector(".track-pattern-name")?.textContent?.trim() ?? part;
    MIDI_PATTERN_OPTIONS.forEach((preset, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `track-pattern-button pattern-${index + 1}`;
      button.dataset.patternId = preset.id;
      button.setAttribute("aria-label", `${trackLabel} ${index + 1}`);
      button.setAttribute("aria-pressed", "false");
      button.textContent = String(index + 1);
      button.addEventListener("click", () => selectTrackPattern(part, preset.id));
      group.append(button);
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
elements.shareImage.addEventListener("click", shareJacketImage);
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

createTrackPatternControls();
createControls();
soundEditor = initializeSoundEditor({ engine, announce });
switchTab("pico");
updatePosition(0);
render();
document.documentElement.dataset.appReady = "true";
document.documentElement.dataset.release = "r23";








