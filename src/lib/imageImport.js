import heic2any from 'heic2any';
import { DEFAULT_FILTERS } from '../state/constants.js';

const THUMB_MAX = 360; // px on the long edge for grid thumbnails
let idCounter = 0;

function makeId() {
  return `img_${Date.now()}_${idCounter++}`;
}

function isHeic(file) {
  const t = (file.type || '').toLowerCase();
  const n = (file.name || '').toLowerCase();
  return t.includes('heic') || t.includes('heif') || n.endsWith('.heic') || n.endsWith('.heif');
}

// Decode a HEIC file to a JPEG blob via heic2any.
async function decodeHeic(file) {
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

async function loadBitmap(blob) {
  // imageOrientation:'from-image' bakes EXIF rotation into the pixels.
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dims(bmp) {
  return { w: bmp.width || bmp.naturalWidth, h: bmp.height || bmp.naturalHeight };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Draw a bitmap to a fresh 2D canvas. The canvas pipeline renders into the
// sRGB color space and drops any embedded ICC profile, which is exactly the
// normalization we want before printing.
function drawTo(bmp, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { colorSpace: 'srgb' });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  return c;
}

async function processOne(file) {
  let sourceBlob = file;
  if (isHeic(file)) sourceBlob = await decodeHeic(file);

  const bmp = await loadBitmap(sourceBlob);
  const { w, h } = dims(bmp);
  if (!w || !h) throw new Error(`Could not decode ${file.name}`);

  // Full-resolution, sRGB-normalized copy. The blob is kept on the record so it
  // can be persisted to IndexedDB; fullResUrl is the in-memory handle for export.
  const fullCanvas = drawTo(bmp, w, h);
  const fullBlob = await canvasToBlob(fullCanvas, 'image/jpeg', 0.95);
  const fullResUrl = URL.createObjectURL(fullBlob);

  // Downscaled thumbnail for the grid / fast preview.
  const scale = Math.min(1, THUMB_MAX / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const thumbCanvas = drawTo(bmp, tw, th);
  const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.82);

  if (bmp.close) bmp.close();

  return {
    id: makeId(),
    name: file.name,
    origSize: file.size,
    w,
    h,
    thumbUrl,
    fullResUrl,
    fullBlob,
    filters: { ...DEFAULT_FILTERS },
    crop: null,
    needsReimport: false,
  };
}

// Import a list of File objects with bounded concurrency so a 50+ batch stays
// responsive. onProgress(done, total) and onError(name, err) are optional.
export async function importFiles(files, { onProgress, onError, concurrency = 3 } = {}) {
  const list = Array.from(files).filter((f) => {
    const t = (f.type || '').toLowerCase();
    return t.startsWith('image/') || isHeic(f);
  });
  const results = [];
  let done = 0;
  let idx = 0;

  async function worker() {
    while (idx < list.length) {
      const my = idx++;
      try {
        const rec = await processOne(list[my]);
        results.push(rec);
      } catch (err) {
        onError && onError(list[my].name, err);
      } finally {
        done++;
        onProgress && onProgress(done, list.length);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length || 1) }, worker));
  return results;
}
