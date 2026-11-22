const DEFAULT_PATTERN_ID = "midi-loop-1";
const imageCache = new Map();

const DRUM_STICKER_LAYOUTS_BY_CHORD = Object.freeze({
  "midi-loop-1": Object.freeze({
    "midi-loop-1": { mode: "placed", width: 0.19, left: 0.22, top: 0.025, rotate: -1 },
    "midi-loop-2": { mode: "placed", width: 0.2, left: 0.22, top: 0.025, rotate: 0 },
    "midi-loop-3": { mode: "placed", width: 0.33, left: 0.025, top: 0.025, rotate: -4 },
    "midi-loop-4": { mode: "placed", width: 0.22, left: 0.22, top: 0.025, rotate: 1 },
    "midi-loop-5": { mode: "placed", width: 0.25, left: 0.025, top: 0.025, rotate: -1 }
  }),
  "midi-loop-2": Object.freeze({
    "midi-loop-1": { mode: "placed", width: 0.19, left: 0.025, top: 0.2, rotate: -1 },
    "midi-loop-2": { mode: "placed", width: 0.2, left: 0.025, top: 0.2, rotate: 0 },
    "midi-loop-3": { mode: "placed", width: 0.33, left: 0.025, top: 0.025, rotate: 2 },
    "midi-loop-4": { mode: "placed", width: 0.245, left: 0.025, top: 0.025, rotate: 1 },
    "midi-loop-5": { mode: "placed", width: 0.25, left: 0.025, top: 0.025, rotate: -1 }
  }),
  "midi-loop-3": Object.freeze({
    "midi-loop-1": { mode: "placed", width: 0.19, left: 0.055, top: 0.055, rotate: -13 },
    "midi-loop-2": { mode: "placed", width: 0.2, left: 0.055, top: 0.055, rotate: 0 },
    "midi-loop-3": { mode: "placed", width: 0.33, left: 0.025, top: 0.025, rotate: -4 },
    "midi-loop-4": { mode: "placed", width: 0.22, left: 0.025, top: 0.025, rotate: -5 },
    "midi-loop-5": { mode: "placed", width: 0.25, left: 0.025, top: 0.025, rotate: -1 }
  }),
  "midi-loop-4": Object.freeze({
    "midi-loop-1": { mode: "placed", width: 0.19, left: 0.055, top: 0.055, rotate: -7 },
    "midi-loop-2": { mode: "placed", width: 0.2, left: 0.055, top: 0.055, rotate: 6 },
    "midi-loop-3": { mode: "placed", width: 0.33, left: 0.025, top: 0.025, rotate: -4 },
    "midi-loop-4": { mode: "placed", width: 0.22, left: 0.055, top: 0.055, rotate: -11 },
    "midi-loop-5": { mode: "placed", width: 0.25, left: 0.025, top: 0.025, rotate: -1 }
  }),
  "midi-loop-5": Object.freeze({
    "midi-loop-1": { mode: "placed", width: 0.19, left: 0.22, top: 0.025, rotate: -1 },
    "midi-loop-2": { mode: "placed", width: 0.2, left: 0.055, top: 0.055, rotate: 12 },
    "midi-loop-3": { mode: "placed", width: 0.33, left: 0.025, top: 0.025, rotate: 2 },
    "midi-loop-4": { mode: "placed", width: 0.22, left: 0.22, top: 0.025, rotate: 1 },
    "midi-loop-5": { mode: "placed", width: 0.25, left: 0.025, top: 0.025, rotate: -1 }
  })
});

export const VISUAL_LAYER_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "chord-background",
    track: "chord",
    zIndex: 0,
    domId: "result-visual-background",
    className: "result-visual-background",
    decorative: true,
    mappings: Object.freeze({
      "midi-loop-1": { src: "./images/backgrounds/chord-loop-1-r20.png", alt: "", layout: { mode: "cover" } },
      "midi-loop-2": { src: "./images/backgrounds/chord-loop-2-r20.png", alt: "", layout: { mode: "cover" } },
      "midi-loop-3": { src: "./images/backgrounds/chord-loop-3-r20.png", alt: "", layout: { mode: "cover" } },
      "midi-loop-4": { src: "./images/backgrounds/chord-loop-4-r20.png", alt: "", layout: { mode: "cover" } },
      "midi-loop-5": { src: "./images/backgrounds/chord-loop-5-r20.png", alt: "", layout: { mode: "cover" } }
    })
  }),
  Object.freeze({
    id: "lead-character",
    track: "lead",
    zIndex: 10,
    domId: "result-visual",
    className: "result-visual-character",
    mappings: Object.freeze({
      "midi-loop-1": { src: "./images/characters/melody-loop-1-r11.png", alt: "基本姿のTKSKbird", layout: { mode: "contain", scale: 0.73, x: 0.45, y: 0.59 } },
      "midi-loop-2": { src: "./images/characters/melody-loop-2-r11.png", alt: "ストリート衣装で歌うTKSKbird", layout: { mode: "contain", scale: 0.79, x: 0.45, y: 0.6 } },
      "midi-loop-3": { src: "./images/characters/melody-loop-3-r15.png", alt: "妖精衣装のTKSKbird", layout: { mode: "contain", scale: 0.77, x: 0.47, y: 0.59 } },
      "midi-loop-4": { src: "./images/characters/melody-loop-4-r15.png", alt: "歌舞伎衣装のTKSKbird", layout: { mode: "contain", scale: 0.81, x: 0.45, y: 0.6 } },
      "midi-loop-5": { src: "./images/characters/melody-loop-5-r15.png", alt: "パーティー衣装のTKSKbird", layout: { mode: "contain", scale: 0.85, x: 0.5, y: 0.6 } }
    })
  }),
  Object.freeze({
    id: "bass-greeting",
    track: "bass",
    zIndex: 20,
    domId: "result-visual-greeting",
    className: "result-visual-greeting",
    mappings: Object.freeze({
      "midi-loop-1": { src: "./images/greetings/birthday-lettering-01-blue-script.png", alt: "青い筆記体のHappy Birthday Dear Hina", layout: { mode: "placed", width: 0.64, left: 0.15, top: 0.62, rotate: 0 } },
      "midi-loop-2": { src: "./images/greetings/birthday-lettering-02-cream-green.png", alt: "クリーム色と緑のHappy Birthday Dear Hina", layout: { mode: "placed", width: 0.64, left: 0.15, top: 0.62, rotate: 0 } },
      "midi-loop-3": { src: "./images/greetings/birthday-lettering-03-orange-ribbon.png", alt: "オレンジ色のリボン型Happy Birthday Dear Hina", layout: { mode: "placed", width: 0.64, left: 0.15, top: 0.62, rotate: 0 } },
      "midi-loop-4": { src: "./images/greetings/birthday-lettering-04-colorful-bubble.png", alt: "カラフルなHappy Birthday Dear Hina", layout: { mode: "placed", width: 0.64, left: 0.15, top: 0.62, rotate: 0 } },
      "midi-loop-5": { src: "./images/greetings/birthday-lettering-05-parliament.png", alt: "オレンジ色と水色のHappy Birthday Dear Hina", layout: { mode: "placed", width: 0.64, left: 0.15, top: 0.62, rotate: 0 } }
    })
  }),
  Object.freeze({
    id: "drum-sticker",
    track: "drum",
    layoutTrack: "chord",
    layouts: DRUM_STICKER_LAYOUTS_BY_CHORD,
    zIndex: 30,
    domId: "result-visual-sticker",
    className: "result-visual-sticker",
    mappings: Object.freeze({
      "midi-loop-1": { src: "./images/stickers/bass-loop-1-r21.png", alt: "GOOD VIBESステッカー" },
      "midi-loop-2": { src: "./images/stickers/bass-loop-2-r21.png", alt: "HAVE A GOOD DAYステッカー" },
      "midi-loop-3": { src: "./images/stickers/bass-loop-3-r21.png", alt: "POSITIVE ENERGYステッカー" },
      "midi-loop-4": { src: "./images/stickers/bass-loop-4-r21.png", alt: "GOOD VIBES ONLYステッカー" },
      "midi-loop-5": { src: "./images/stickers/bass-loop-5-r21.png", alt: "虹のステッカー" }
    })
  }),
  Object.freeze({
    id: "arp-corner-label",
    track: "arp",
    zIndex: 40,
    domId: "result-visual-corner-label",
    className: "result-visual-corner-label",
    mappings: Object.freeze({
      "midi-loop-1": { src: "./images/corner-labels/corner-label-01-mint.png", alt: "ミント色のコーナーラベル", layout: { mode: "placed", width: 0.34, left: 0.635, top: 0.025, rotate: 0 } },
      "midi-loop-2": { src: "./images/corner-labels/corner-label-02-lavender.png", alt: "ラベンダー色のコーナーラベル", layout: { mode: "placed", width: 0.34, left: 0.635, top: 0.025, rotate: 0 } },
      "midi-loop-3": { src: "./images/corner-labels/corner-label-03-blue.png", alt: "水色のコーナーラベル", layout: { mode: "placed", width: 0.34, left: 0.635, top: 0.025, rotate: 0 } },
      "midi-loop-4": { src: "./images/corner-labels/corner-label-04-yellow.png", alt: "黄色のコーナーラベル", layout: { mode: "placed", width: 0.34, left: 0.635, top: 0.025, rotate: 0 } },
      "midi-loop-5": { src: "./images/corner-labels/corner-label-05-pink.png", alt: "ピンク色のコーナーラベル", layout: { mode: "placed", width: 0.34, left: 0.635, top: 0.025, rotate: 0 } }
    })
  })
]);

export function resolveVisualLayers(trackPatterns, definitions = VISUAL_LAYER_DEFINITIONS) {
  return definitions
    .map((definition) => {
      const patternId = trackPatterns?.[definition.track] ?? DEFAULT_PATTERN_ID;
      const mapping = definition.mappings[patternId] ?? definition.mappings[DEFAULT_PATTERN_ID];
      if (!mapping) return null;
      const layoutPatternId = trackPatterns?.[definition.layoutTrack] ?? DEFAULT_PATTERN_ID;
      const layout = definition.layouts?.[layoutPatternId]?.[patternId] ?? mapping.layout;
      if (!layout) return null;
      return {
        id: definition.id,
        track: definition.track,
        patternId,
        zIndex: definition.zIndex,
        domId: definition.domId ?? "",
        className: definition.className ?? "",
        decorative: Boolean(definition.decorative),
        opacity: mapping.opacity ?? 1,
        ...mapping,
        layout
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.zIndex - right.zIndex);
}

function setLayerStyle(image, layer) {
  const layout = layer.layout;
  image.dataset.layerMode = layout.mode;
  image.style.zIndex = String(layer.zIndex);
  image.style.setProperty("--layer-opacity", layer.opacity);
  if (layout.mode === "contain") {
    image.style.setProperty("--layer-scale", layout.scale ?? 1);
    image.style.setProperty("--layer-position", `${(layout.x ?? 0.5) * 100}% ${(layout.y ?? 0.5) * 100}%`);
  } else if (layout.mode === "placed") {
    image.style.setProperty("--layer-width", `${(layout.width ?? 0.25) * 100}%`);
    image.style.setProperty("--layer-left", `${(layout.left ?? 0) * 100}%`);
    image.style.setProperty("--layer-top", `${(layout.top ?? 0) * 100}%`);
    image.style.setProperty("--layer-rotate", `${layout.rotate ?? 0}deg`);
  }
}

export function renderVisualStage(stage, trackPatterns, definitions = VISUAL_LAYER_DEFINITIONS) {
  const layers = resolveVisualLayers(trackPatterns, definitions);
  const existing = new Map([...stage.querySelectorAll("[data-visual-layer-id]")]
    .map((node) => [node.dataset.visualLayerId, node]));
  const activeIds = new Set(layers.map((layer) => layer.id));
  for (const [id, node] of existing) {
    if (!activeIds.has(id)) node.remove();
  }
  for (const layer of layers) {
    let image = existing.get(layer.id);
    if (!image) image = document.createElement("img");
    image.dataset.visualLayerId = layer.id;
    image.className = `result-visual-layer ${layer.className}`.trim();
    if (layer.domId) image.id = layer.domId;
    if (image.getAttribute("src") !== layer.src) image.src = layer.src;
    image.alt = layer.decorative ? "" : layer.alt;
    if (layer.decorative) image.setAttribute("aria-hidden", "true");
    else image.removeAttribute("aria-hidden");
    setLayerStyle(image, layer);
    stage.append(image);
  }
  return layers;
}

function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`画像を読み込めません: ${src}`));
    image.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

function drawCover(context, image, size) {
  const crop = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = (image.naturalWidth - crop) / 2;
  const sy = (image.naturalHeight - crop) / 2;
  context.drawImage(image, sx, sy, crop, crop, 0, 0, size, size);
}

function drawContain(context, image, layout, size) {
  const scale = layout.scale ?? 1;
  const x = layout.x ?? 0.5;
  const y = layout.y ?? 0.5;
  const containRatio = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const baseWidth = image.naturalWidth * containRatio;
  const baseHeight = image.naturalHeight * containRatio;
  const baseLeft = (size - baseWidth) * x;
  const baseTop = (size - baseHeight) * y;
  const originX = size * x;
  const originY = size * y;
  const left = originX + (baseLeft - originX) * scale;
  const top = originY + (baseTop - originY) * scale;
  context.shadowColor = "rgba(255,248,223,.95)";
  context.shadowBlur = size * 0.007;
  context.drawImage(image, left, top, baseWidth * scale, baseHeight * scale);
}

function drawPlaced(context, image, layout, size) {
  const width = size * (layout.width ?? 0.25);
  const height = width * image.naturalHeight / image.naturalWidth;
  const centerX = size * (layout.left ?? 0) + width / 2;
  const centerY = size * (layout.top ?? 0) + height / 2;
  context.translate(centerX, centerY);
  context.rotate((layout.rotate ?? 0) * Math.PI / 180);
  context.shadowColor = "rgba(32,31,37,.32)";
  context.shadowOffsetX = size * 0.006;
  context.shadowOffsetY = size * 0.009;
  context.drawImage(image, -width / 2, -height / 2, width, height);
}

export async function renderJacketToCanvas(trackPatterns, { size = 1200, canvas, definitions = VISUAL_LAYER_DEFINITIONS } = {}) {
  const target = canvas ?? document.createElement("canvas");
  target.width = size;
  target.height = size;
  const context = target.getContext("2d");
  context.clearRect(0, 0, size, size);
  context.imageSmoothingEnabled = false;
  const layers = resolveVisualLayers(trackPatterns, definitions);
  for (const layer of layers) {
    const image = await loadImage(layer.src);
    context.save();
    context.globalAlpha = layer.opacity;
    if (layer.layout.mode === "cover") drawCover(context, image, size);
    else if (layer.layout.mode === "contain") drawContain(context, image, layer.layout, size);
    else if (layer.layout.mode === "placed") drawPlaced(context, image, layer.layout, size);
    context.restore();
  }
  return target;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("ジャケットPNGを生成できませんでした"));
  }, "image/png"));
}

export async function createJacketPngFile(trackPatterns, options = {}) {
  const canvas = await renderJacketToCanvas(trackPatterns, options);
  const blob = await canvasToPngBlob(canvas);
  return new File([blob], options.fileName ?? "TKSKbeat-jacket.png", { type: "image/png" });
}
