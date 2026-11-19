const DEFAULT_BAND_COUNT = 20;
const DEFAULT_FPS = 30;
const MIN_FREQUENCY = 60;
const MAX_FREQUENCY = 12000;
const NOISE_FLOOR = 0.025;
const ATTACK_RATIO = 0.72;
const RELEASE_RATIO = 0.18;
const MIN_VISIBLE_LEVEL = 0.015;

export function createLogFrequencyBands({
  sampleRate,
  fftSize,
  bandCount = DEFAULT_BAND_COUNT,
  minFrequency = MIN_FREQUENCY,
  maxFrequency = MAX_FREQUENCY
}) {
  const frequencyBinCount = Math.floor(fftSize / 2);
  const binWidth = sampleRate / fftSize;
  const highestFrequency = Math.min(maxFrequency, sampleRate / 2);
  const lowestFrequency = Math.max(binWidth, minFrequency);
  const ratio = (highestFrequency / lowestFrequency) ** (1 / bandCount);

  return Array.from({ length: bandCount }, (_, index) => {
    const low = lowestFrequency * ratio ** index;
    const high = index === bandCount - 1
      ? highestFrequency
      : lowestFrequency * ratio ** (index + 1);
    const startBin = Math.max(1, Math.min(frequencyBinCount - 1, Math.floor(low / binWidth)));
    const endBin = Math.max(
      startBin + 1,
      Math.min(frequencyBinCount, Math.ceil(high / binWidth))
    );
    return { low, high, startBin, endBin };
  });
}

function compensateLevel(level) {
  const gated = Math.max(0, (level - NOISE_FLOOR) / (1 - NOISE_FLOOR));
  return Math.min(1, gated ** 0.72 * 1.18);
}

export function aggregateFrequencyBands(frequencyData, bands) {
  return bands.map(({ startBin, endBin }) => {
    let sumSquares = 0;
    let sampleCount = 0;
    for (let index = startBin; index < endBin; index += 1) {
      const normalized = (frequencyData[index] ?? 0) / 255;
      sumSquares += normalized * normalized;
      sampleCount += 1;
    }
    const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
    return compensateLevel(rms);
  });
}

export function smoothBandLevels(previousLevels, nextLevels, {
  attackRatio = ATTACK_RATIO,
  releaseRatio = RELEASE_RATIO
} = {}) {
  return nextLevels.map((nextLevel, index) => {
    const previous = previousLevels[index] ?? 0;
    const ratio = nextLevel > previous ? attackRatio : releaseRatio;
    const smoothed = previous + (nextLevel - previous) * ratio;
    return smoothed < MIN_VISIBLE_LEVEL ? 0 : smoothed;
  });
}

export function createSpectrumAnalyzer(canvas, {
  fps = DEFAULT_FPS,
  bandCount = DEFAULT_BAND_COUNT
} = {}) {
  const context = canvas?.getContext?.("2d") ?? null;
  const diagnostics = {
    analyserAttached: false,
    running: false,
    framesDrawn: 0,
    activeBars: 0,
    maxLevel: 0,
    silent: true,
    bandLevels: new Array(bandCount).fill(0)
  };
  let analyser = null;
  let frequencyData = null;
  let bands = [];
  let levels = new Array(bandCount).fill(0);
  let animationFrame = null;
  let active = true;
  let destroyed = false;
  let lastFrameTime = Number.NEGATIVE_INFINITY;
  let resizeObserver = null;

  function resizeCanvas() {
    if (!canvas || !context) return { width: 0, height: 0 };
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    return { width, height };
  }

  function drawBars(width, height) {
    const slotWidth = width / bandCount;
    const barWidth = Math.max(2, Math.floor(slotWidth * 0.58));
    const blockHeight = 4;
    const blockGap = 2;
    const bottom = height - 11;
    const maxBlocks = Math.max(1, Math.floor((bottom - 3) / (blockHeight + blockGap)));
    context.fillStyle = getComputedStyle(canvas).color;

    for (let index = 0; index < levels.length; index += 1) {
      const blockCount = Math.min(maxBlocks, Math.ceil(levels[index] * maxBlocks));
      const x = Math.round(index * slotWidth + (slotWidth - barWidth) / 2);
      for (let block = 0; block < blockCount; block += 1) {
        const y = bottom - blockHeight - block * (blockHeight + blockGap);
        context.fillRect(x, y, barWidth, blockHeight);
      }
    }
  }

  function drawFrame() {
    if (!context || !canvas || destroyed) return;
    const { width, height } = resizeCanvas();
    context.clearRect(0, 0, width, height);

    if (analyser && typeof analyser.getByteFrequencyData === "function") {
      if (!frequencyData || frequencyData.length !== analyser.frequencyBinCount) {
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(frequencyData);
      levels = smoothBandLevels(levels, aggregateFrequencyBands(frequencyData, bands));
    } else {
      levels = smoothBandLevels(levels, new Array(bandCount).fill(0));
    }

    const maxLevel = Math.max(0, ...levels);
    if (maxLevel < MIN_VISIBLE_LEVEL) levels.fill(0);
    drawBars(width, height);

    diagnostics.framesDrawn += 1;
    diagnostics.activeBars = levels.filter((level) => level > 0).length;
    diagnostics.maxLevel = Math.max(0, ...levels);
    diagnostics.silent = diagnostics.activeBars === 0;
    diagnostics.bandLevels = [...levels];
  }

  function tick(timestamp) {
    animationFrame = null;
    if (!active || destroyed || !analyser) {
      diagnostics.running = false;
      return;
    }
    if (timestamp - lastFrameTime >= 1000 / fps) {
      lastFrameTime = timestamp;
      drawFrame();
    }
    animationFrame = window.requestAnimationFrame(tick);
  }

  function start() {
    if (!context || !analyser || !active || destroyed || animationFrame !== null) return;
    diagnostics.running = true;
    animationFrame = window.requestAnimationFrame(tick);
  }

  function stop() {
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
    diagnostics.running = false;
  }

  if (context) {
    drawFrame();
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => drawFrame());
      resizeObserver.observe(canvas);
    }
  }

  return {
    attach(nextAnalyser) {
      analyser = nextAnalyser?.getByteFrequencyData ? nextAnalyser : null;
      if (analyser) {
        analyser.fftSize = 2048;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -18;
        analyser.smoothingTimeConstant = 0;
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
        bands = createLogFrequencyBands({
          sampleRate: analyser.context?.sampleRate ?? 48000,
          fftSize: analyser.fftSize,
          bandCount
        });
      } else {
        frequencyData = null;
        bands = [];
      }
      diagnostics.analyserAttached = Boolean(analyser);
      levels.fill(0);
      drawFrame();
      start();
    },
    setActive(nextActive) {
      active = Boolean(nextActive);
      if (active) start();
      else stop();
    },
    drawFrame,
    getDiagnostics() {
      return { ...diagnostics, bandLevels: [...diagnostics.bandLevels] };
    },
    destroy() {
      destroyed = true;
      stop();
      resizeObserver?.disconnect();
      resizeObserver = null;
      analyser = null;
      frequencyData = null;
      bands = [];
      levels.fill(0);
      diagnostics.analyserAttached = false;
    }
  };
}
