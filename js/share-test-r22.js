const SIZE = 2048;
const LOOPS = [1, 2, 3, 4, 5];
const imageCache = new Map();

const characters = {
  1: { src: "./images/characters/melody-loop-1-r11.png", scale: 0.78, x: 0.5, y: 0.51 },
  2: { src: "./images/characters/melody-loop-2-r11.png", scale: 0.84, x: 0.5, y: 0.52 },
  3: { src: "./images/characters/melody-loop-3-r15.png", scale: 0.82, x: 0.52, y: 0.51 },
  4: { src: "./images/characters/melody-loop-4-r15.png", scale: 0.86, x: 0.5, y: 0.52 },
  5: { src: "./images/characters/melody-loop-5-r15.png", scale: 0.9, x: 0.5, y: 0.52 }
};
const backgrounds = Object.fromEntries(LOOPS.map((loop) => [loop, `./images/backgrounds/chord-loop-${loop}-r20.png`]));
const stickers = {
  1: { src: "./images/stickers/bass-loop-1-r21.png", width: 0.24, left: 0.05, top: 0.06, rotate: -7 },
  2: { src: "./images/stickers/bass-loop-2-r21.png", width: 0.25, left: 0.7, top: 0.07, rotate: 6 },
  3: { src: "./images/stickers/bass-loop-3-r21.png", width: 0.38, left: 0.04, top: 0.05, rotate: -4 },
  4: { src: "./images/stickers/bass-loop-4-r21.png", width: 0.27, left: 0.05, top: 0.68, rotate: -5 },
  5: { src: "./images/stickers/bass-loop-5-r21.png", width: 0.3, left: 0.66, top: 0.05, rotate: 5 }
};

const elements = {
  canvas: document.querySelector("#test-canvas"),
  lead: document.querySelector("#test-lead"),
  chord: document.querySelector("#test-chord"),
  bass: document.querySelector("#test-bass"),
  shareUrl: document.querySelector("#test-share-url"),
  share: document.querySelector("#test-share"),
  download: document.querySelector("#test-download"),
  copyUrl: document.querySelector("#test-copy-url"),
  status: document.querySelector("#test-status")
};

function setStatus(message, kind = "info") {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

function populate(select) {
  for (const loop of LOOPS) {
    const option = document.createElement("option");
    option.value = String(loop);
    option.textContent = `Loop ${loop}`;
    select.append(option);
  }
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

function drawCover(context, image) {
  const crop = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = (image.naturalWidth - crop) / 2;
  const sy = (image.naturalHeight - crop) / 2;
  context.drawImage(image, sx, sy, crop, crop, 0, 0, SIZE, SIZE);
}

function drawCharacter(context, image, config) {
  const drawnSize = SIZE * config.scale;
  const left = SIZE * config.x * (1 - config.scale);
  const top = SIZE * config.y * (1 - config.scale);
  context.save();
  context.shadowColor = "rgba(255,248,223,.95)";
  context.shadowBlur = 14;
  context.drawImage(image, left, top, drawnSize, drawnSize);
  context.restore();
}

function drawSticker(context, image, config) {
  const width = SIZE * config.width;
  const height = width * image.naturalHeight / image.naturalWidth;
  const centerX = SIZE * config.left + width / 2;
  const centerY = SIZE * config.top + height / 2;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(config.rotate * Math.PI / 180);
  context.shadowColor = "rgba(32,31,37,.32)";
  context.shadowOffsetX = 12;
  context.shadowOffsetY = 18;
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}

async function renderJacket() {
  const lead = Number(elements.lead.value);
  const chord = Number(elements.chord.value);
  const bass = Number(elements.bass.value);
  const [background, character, sticker] = await Promise.all([
    loadImage(backgrounds[chord]),
    loadImage(characters[lead].src),
    loadImage(stickers[bass].src)
  ]);
  const context = elements.canvas.getContext("2d");
  context.clearRect(0, 0, SIZE, SIZE);
  context.imageSmoothingEnabled = false;
  drawCover(context, background);
  drawCharacter(context, character, characters[lead]);
  drawSticker(context, sticker, stickers[bass]);
  return elements.canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("PNGを生成できませんでした"));
  }, "image/png"));
}

async function createPngFile() {
  const canvas = await renderJacket();
  const blob = await canvasToBlob(canvas);
  return new File([blob], "TKSKbeat-jacket.png", { type: "image/png" });
}

async function shareJacket() {
  try {
    const file = await createPngFile();
    const data = {
      files: [file],
      text: "TKSKbeatでバースデービートを作ったよ！\n#TKSKbeat",
      url: elements.shareUrl.value
    };
    if (!navigator.share || !navigator.canShare?.({ files: data.files })) {
      setStatus("この環境では画像付きWeb Shareを利用できません。PNG保存＋URLコピーを試してください。", "error");
      return;
    }
    await navigator.share(data);
    setStatus("共有シートへ画像・文章・URLを渡しました。X側の投稿内容を確認してください。");
  } catch (error) {
    if (error.name === "AbortError") setStatus("共有をキャンセルしました。生成したPNGに問題はありません。");
    else setStatus(`共有エラー: ${error.message}`, "error");
  }
}

async function downloadJacket() {
  try {
    const file = await createPngFile();
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("PNGを保存しました。");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function copyShareUrl() {
  try {
    await navigator.clipboard.writeText(elements.shareUrl.value);
    setStatus("共有URLをコピーしました。");
  } catch {
    window.prompt("このURLをコピーしてください", elements.shareUrl.value);
  }
}

for (const select of [elements.lead, elements.chord, elements.bass]) {
  populate(select);
  select.addEventListener("change", () => renderJacket().catch((error) => setStatus(error.message, "error")));
}
elements.shareUrl.value = new URL("./index.html", window.location.href).href;
elements.share.addEventListener("click", shareJacket);
elements.download.addEventListener("click", downloadJacket);
elements.copyUrl.addEventListener("click", copyShareUrl);

window.__TKSKBEAT_SHARE_TEST__ = Object.freeze({ renderJacket, createPngFile });
renderJacket()
  .then(() => setStatus(navigator.share && navigator.canShare ? "準備完了。iPhone Safariで「画像付きで共有」を試してください。" : "PNG生成は利用可能です。画像付きWeb Shareには未対応の環境です。"))
  .catch((error) => setStatus(error.message, "error"));
