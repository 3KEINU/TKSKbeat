import {
  SOUND_PARAMETER_DEFINITIONS,
  SOUND_PART_LABELS,
  SOUND_PARTS,
  WAVEFORMS,
  clampSoundParameter,
  createDefaultSoundSettings,
  parseSoundSettingsJson,
  sliderToSoundValue,
  soundValueToSlider,
  stringifySoundSettings,
  validateSoundSettings
} from "./sound-editor-settings-r17.js";

const STORAGE_KEY = "tkskbeat.debugSoundSettings.v1";

function createElement(tagName, attributes = {}, text = "") {
  const element = document.createElement(tagName);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === "className") element.className = value;
    else if (name === "dataset") Object.assign(element.dataset, value);
    else if (name in element) element[name] = value;
    else element.setAttribute(name, value);
  }
  if (text) element.textContent = text;
  return element;
}

function formatValue(key, value) {
  return Number(value).toFixed(SOUND_PARAMETER_DEFINITIONS[key].decimals);
}

function isDebugSoundEditorEnabled() {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

export function initializeSoundEditor({ engine, announce = () => {} }) {
  if (!isDebugSoundEditorEnabled()) return null;

  let settings = createDefaultSoundSettings();
  let activePart = "bass";
  let statusTimer = null;
  const controls = new Map();

  const panel = createElement("section", {
    className: "sound-editor panel",
    id: "sound-editor",
    "aria-labelledby": "sound-editor-heading"
  });
  const headingRow = createElement("div", { className: "sound-editor-heading" });
  headingRow.append(
    createElement("div", {}, ""),
    createElement("span", { className: "sound-editor-badge" }, "DEBUG ONLY")
  );
  headingRow.firstElementChild.append(
    createElement("h2", { id: "sound-editor-heading" }, "サウンドエディタ"),
    createElement("small", {}, "Bass / Chord / Arp / Lead")
  );
  panel.append(headingRow);

  const partTabs = createElement("div", { className: "sound-editor-tabs", role: "tablist", "aria-label": "編集するパート" });
  for (const part of SOUND_PARTS) {
    const button = createElement("button", {
      type: "button",
      role: "tab",
      dataset: { soundPart: part },
      "aria-selected": part === activePart ? "true" : "false"
    }, SOUND_PART_LABELS[part]);
    button.addEventListener("click", () => {
      activePart = part;
      render();
    });
    partTabs.append(button);
  }
  panel.append(partTabs);

  const selectGrid = createElement("div", { className: "sound-editor-selects" });
  const waveformLabel = createElement("label", {}, "Waveform");
  const waveform = createElement("select", { id: "sound-waveform" });
  for (const value of WAVEFORMS) {
    waveform.append(createElement("option", { value }, value[0].toUpperCase() + value.slice(1)));
  }
  waveformLabel.append(waveform);
  const releaseModeLabel = createElement("label", {}, "Release mode");
  const releaseMode = createElement("select", { id: "sound-release-mode" });
  releaseMode.append(
    createElement("option", { value: "auto" }, "Auto（音価の半分・最大80ms）"),
    createElement("option", { value: "manual" }, "Manual（固定ms）")
  );
  releaseModeLabel.append(releaseMode);
  const filterLabel = createElement("label", { className: "sound-editor-check" });
  const filterEnabled = createElement("input", { type: "checkbox", id: "sound-filter-enabled" });
  filterLabel.append(filterEnabled, document.createTextNode(" ローパスフィルター ON"));
  selectGrid.append(waveformLabel, releaseModeLabel, filterLabel);
  panel.append(selectGrid);

  const parameterGrid = createElement("div", { className: "sound-editor-parameters" });
  for (const [key, definition] of Object.entries(SOUND_PARAMETER_DEFINITIONS)) {
    const row = createElement("div", { className: "sound-editor-parameter", dataset: { parameter: key } });
    const label = createElement("label", { htmlFor: `sound-${key}-number` }, definition.label);
    if (definition.unit) label.append(createElement("small", {}, ` ${definition.unit}`));
    const slider = createElement("input", {
      type: "range",
      id: `sound-${key}-range`,
      min: definition.scale === "log" ? 0 : definition.min,
      max: definition.scale === "log" ? 1000 : definition.max,
      step: definition.scale === "log" ? 1 : definition.step
    });
    const number = createElement("input", {
      type: "number",
      id: `sound-${key}-number`,
      min: definition.min,
      max: definition.max,
      step: definition.step,
      inputMode: "decimal"
    });
    controls.set(key, { row, slider, number });
    row.append(label, slider, number);
    parameterGrid.append(row);
  }
  panel.append(parameterGrid);

  const textAreaLabel = createElement("label", { className: "sound-editor-json-label", htmlFor: "sound-editor-json" }, "設定JSON");
  const textArea = createElement("textarea", {
    id: "sound-editor-json",
    rows: 7,
    spellcheck: false,
    placeholder: "「設定をコピー」で出力、または受け取ったJSONを貼り付け"
  });
  const actions = createElement("div", { className: "sound-editor-actions" });
  const copyButton = createElement("button", { type: "button" }, "設定をコピー");
  const importButton = createElement("button", { type: "button" }, "設定を読み込む");
  const resetButton = createElement("button", { type: "button", className: "sound-editor-reset" }, "初期値に戻す");
  actions.append(copyButton, importButton, resetButton);
  const status = createElement("p", { className: "sound-editor-status", role: "status", "aria-live": "polite" });
  panel.append(textAreaLabel, textArea, actions, status);

  const footer = document.querySelector(".shell > footer");
  if (footer) footer.before(panel);
  else document.body.append(panel);

  function showStatus(message, type = "ok") {
    status.textContent = message;
    status.dataset.type = type;
    if (statusTimer) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.textContent = "";
      delete status.dataset.type;
    }, 5000);
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, stringifySoundSettings(settings));
    } catch (error) {
      console.warn("Sound editor settings could not be saved.", error);
    }
  }

  function apply(nextSettings, { message = "", save = true } = {}) {
    const validated = validateSoundSettings(nextSettings);
    engine.setPartSoundSettings(validated);
    settings = validated;
    if (save) persist();
    render();
    if (message) showStatus(message);
    return settings;
  }

  function updatePartValue(key, value) {
    const next = validateSoundSettings(settings);
    next.parts[activePart][key] = value;
    apply(next);
  }

  function resetToMobileSpeaker() {
    engine.useAudioSettingsPreset("mobileSpeaker");
    return apply(createDefaultSoundSettings(), { message: "本番採用済みの音色設定に戻しました。" });
  }

  function render() {
    const partSettings = settings.parts[activePart];
    for (const button of partTabs.querySelectorAll("[data-sound-part]")) {
      button.setAttribute("aria-selected", String(button.dataset.soundPart === activePart));
    }
    waveform.value = partSettings.waveform;
    releaseMode.value = partSettings.releaseMode;
    filterEnabled.checked = partSettings.filterEnabled;
    for (const [key, control] of controls) {
      const value = partSettings[key];
      control.slider.value = String(soundValueToSlider(key, value));
      control.number.value = formatValue(key, value);
      control.number.setAttribute("aria-invalid", "false");
      const disabled = key === "releaseMs" && partSettings.releaseMode === "auto";
      control.slider.disabled = disabled;
      control.number.disabled = disabled;
      control.row.dataset.disabled = String(disabled);
    }
  }

  waveform.addEventListener("change", () => updatePartValue("waveform", waveform.value));
  releaseMode.addEventListener("change", () => updatePartValue("releaseMode", releaseMode.value));
  filterEnabled.addEventListener("change", () => updatePartValue("filterEnabled", filterEnabled.checked));

  for (const [key, control] of controls) {
    const definition = SOUND_PARAMETER_DEFINITIONS[key];
    control.slider.addEventListener("input", () => {
      updatePartValue(key, sliderToSoundValue(key, control.slider.value));
    });
    control.number.addEventListener("input", () => {
      const value = Number(control.number.value);
      const valid = control.number.value !== "" && Number.isFinite(value)
        && value >= definition.min && value <= definition.max;
      control.number.setAttribute("aria-invalid", String(!valid));
    });
    control.number.addEventListener("change", () => {
      const value = Number(control.number.value);
      if (control.number.value === "" || !Number.isFinite(value)) {
        render();
        showStatus(`${definition.label} は数値で入力してください。`, "error");
        return;
      }
      const clamped = clampSoundParameter(key, value);
      updatePartValue(key, clamped);
      if (clamped !== value) showStatus(`${definition.label} を範囲内の ${formatValue(key, clamped)} に補正しました。`, "warning");
    });
  }

  copyButton.addEventListener("click", async () => {
    const json = stringifySoundSettings(settings);
    textArea.value = json;
    try {
      await navigator.clipboard.writeText(json);
      showStatus("4パートの設定JSONをコピーしました。");
    } catch {
      textArea.focus();
      textArea.select();
      const copied = document.execCommand?.("copy");
      showStatus(copied ? "4パートの設定JSONをコピーしました。" : "JSONを選択しました。手動でコピーしてください。", copied ? "ok" : "warning");
    }
  });

  importButton.addEventListener("click", () => {
    try {
      const imported = parseSoundSettingsJson(textArea.value);
      apply(imported, { message: "4パートの設定を一括で読み込みました。" });
      announce("SOUND SETTINGS LOADED", 1400);
    } catch (error) {
      showStatus(error.message, "error");
    }
  });

  resetButton.addEventListener("click", () => {
    resetToMobileSpeaker();
    textArea.value = "";
    announce("SOUND SETTINGS RESET", 1400);
  });

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      apply(parseSoundSettingsJson(stored), { save: false });
      showStatus("前回のローカル調整値を復元しました。");
    } else {
      apply(settings, { save: false });
    }
  } catch (error) {
    console.warn("Stored sound editor settings were ignored.", error);
    apply(settings, { save: false });
    showStatus(`保存済み設定を読み込めませんでした: ${error.message}`, "error");
  }

  return Object.freeze({
    getSettings: () => validateSoundSettings(settings),
    setSettings: (nextSettings) => apply(nextSettings, { message: "設定を反映しました。" }),
    reset: resetToMobileSpeaker,
    exportJson: () => stringifySoundSettings(settings),
    element: panel
  });
}


