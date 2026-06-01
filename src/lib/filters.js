// Filter math shared by the live preview (CSS / canvas at thumb-res) and the
// export pipeline (canvas at full-res), so the screen matches the print.

// Build a CSS/canvas `filter` string from the per-image filter params plus the
// global print-compensation brightness boost.
export function buildFilterCss(filters, printComp = 0) {
  const f = filters || {};
  const exposure = 1 + (f.exposure || 0) / 200;
  const brightness = (1 + (f.brightness || 0) / 100) * exposure * (1 + (printComp || 0));
  const contrast = (1 + (f.contrast || 0) / 100) * (1 - (f.fade || 0) / 300);
  const saturate = Math.max(0, 1 + (f.saturation || 0) / 100);

  const parts = [
    `brightness(${brightness.toFixed(4)})`,
    `contrast(${contrast.toFixed(4)})`,
    `saturate(${saturate.toFixed(4)})`,
  ];
  if (f.bw) parts.push('grayscale(1)');
  if (f.sepia) parts.push('sepia(0.6)');
  if (f.warmth) {
    if (f.warmth > 0) parts.push(`sepia(${(f.warmth / 200).toFixed(4)})`);
    parts.push(`hue-rotate(${(-f.warmth / 12).toFixed(2)}deg)`);
  }
  return parts.join(' ');
}

// Overlay CSS layers (grain / vignette / fade) that CSS `filter` can't express.
// Returned as an array of background layer strings for a positioned ::overlay div.
export function overlayBackgrounds(filters) {
  const f = filters || {};
  const layers = [];
  if (f.fade) layers.push(`linear-gradient(rgba(255,255,255,${(f.fade / 100) * 0.35}), rgba(255,255,255,${(f.fade / 100) * 0.35}))`);
  if (f.vignette)
    layers.push(
      `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${(f.vignette / 100) * 0.75}) 100%)`
    );
  return layers;
}

let _noiseTile = null;
function noiseTile() {
  if (_noiseTile) return _noiseTile;
  const size = 120;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const data = ctx.createImageData(size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  _noiseTile = c;
  return c;
}

// Compute the source rectangle (in image pixels) given an optional normalized
// crop {x,y,w,h}.
export function sourceRect(img, crop) {
  if (!crop) return { sx: 0, sy: 0, sw: img.w, sh: img.h };
  return {
    sx: Math.round(crop.x * img.w),
    sy: Math.round(crop.y * img.h),
    sw: Math.round(crop.w * img.w),
    sh: Math.round(crop.h * img.h),
  };
}

// Render an image into a slot-sized canvas, baking filters, crop and fit/fill.
// `drawable` is an HTMLImageElement / ImageBitmap / canvas already loaded.
// Returns the canvas. Used by both the live SlotView and the PDF export.
export function renderSlot(drawable, img, slot, { destW, destH, printComp = 0, background = '#ffffff' }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(destW));
  canvas.height = Math.max(1, Math.round(destH));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  // Crop applies regardless of fit/fill.
  const src = sourceRect(img, img.crop);

  // Background (visible as letterbox bars in 'fit' mode).
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.filter = buildFilterCss(img.filters, printComp);

  if (slot.fit === 'fit') {
    // contain: whole (cropped) image visible, letterboxed.
    const scale = Math.min(canvas.width / src.sw, canvas.height / src.sh);
    const dw = src.sw * scale;
    const dh = src.sh * scale;
    const dx = (canvas.width - dw) / 2;
    const dy = (canvas.height - dh) / 2;
    ctx.drawImage(drawable, src.sx, src.sy, src.sw, src.sh, dx, dy, dw, dh);
  } else {
    // cover: fill slot, center-crop overflow.
    const scale = Math.max(canvas.width / src.sw, canvas.height / src.sh);
    const cropW = canvas.width / scale;
    const cropH = canvas.height / scale;
    const cropX = src.sx + (src.sw - cropW) / 2;
    const cropY = src.sy + (src.sh - cropH) / 2;
    ctx.drawImage(drawable, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
  }
  ctx.restore();

  // Manual overlays.
  const f = img.filters || {};
  if (f.fade) {
    ctx.fillStyle = `rgba(255,255,255,${(f.fade / 100) * 0.35})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (f.vignette) {
    const g = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      Math.min(canvas.width, canvas.height) * 0.3,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height) * 0.72
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${(f.vignette / 100) * 0.75})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (f.grain) {
    ctx.save();
    ctx.globalAlpha = (f.grain / 100) * 0.4;
    ctx.globalCompositeOperation = 'overlay';
    const tile = noiseTile();
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  return canvas;
}
