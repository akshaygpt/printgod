// localStorage persistence. Pixel data (object URLs / blobs) is deliberately
// NOT persisted — only editing metadata: filters, crop, slot assignments, page
// order and print settings. Photos must be re-imported after a reload; they
// re-link to their saved metadata by filename + size.
const KEY = 'printgod:doc:v1';

export function saveState(doc) {
  try {
    const images = {};
    for (const [id, img] of Object.entries(doc.images || {})) {
      images[id] = {
        id: img.id,
        name: img.name,
        origSize: img.origSize,
        w: img.w,
        h: img.h,
        filters: img.filters,
        crop: img.crop || null,
        needsReimport: true, // pixels are gone after reload
      };
    }
    const payload = {
      images,
      imageOrder: doc.imageOrder || [],
      pages: doc.pages || [],
      settings: doc.settings || {},
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch (err) {
    // Quota or serialization failure — non-fatal.
    console.warn('PrintGod: could not persist state', err);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
