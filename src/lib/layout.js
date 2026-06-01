import { getPaperDimsMm, GUTTER_MM, TEMPLATES, MM_PER_INCH, TARGET_DPI } from '../state/constants.js';
import { sourceRect } from './filters.js';

// Full page size in mm for the current settings.
export function pageDimsMm(settings) {
  return getPaperDimsMm(settings.paperSize, settings.orientation);
}

// Printable area (page minus margins) in mm. Full-bleed templates ignore margins.
export function printableRectMm(page, settings) {
  const { w, h } = pageDimsMm(settings);
  const tpl = TEMPLATES[page.template];
  const m = tpl.bleed ? 0 : settings.margin;
  return { x: m, y: m, w: w - 2 * m, h: h - 2 * m };
}

// Absolute mm rectangle for each slot on a page, accounting for margins and the
// inter-cell gutter (only applied on interior edges).
export function slotRectsMm(page, settings) {
  const area = printableRectMm(page, settings);
  const tpl = TEMPLATES[page.template];
  const half = GUTTER_MM / 2;
  return tpl.slots.map((def) => {
    let x = area.x + def.x * area.w;
    let y = area.y + def.y * area.h;
    let w = def.w * area.w;
    let h = def.h * area.h;
    if (tpl.slots.length > 1 && !tpl.polaroid) {
      const left = def.x > 0.001;
      const right = def.x + def.w < 0.999;
      const top = def.y > 0.001;
      const bottom = def.y + def.h < 0.999;
      if (left) { x += half; w -= half; }
      if (right) { w -= half; }
      if (top) { y += half; h -= half; }
      if (bottom) { h -= half; }
    }
    return { x, y, w, h };
  });
}

// Effective print DPI for an image placed in a slot, given fit/fill and crop.
// Returns null when no image assigned.
export function slotDpi(img, slot, slotMm) {
  if (!img) return null;
  const src = sourceRect(img, img.crop);
  const slotWin = slotMm.w / MM_PER_INCH;
  const slotHin = slotMm.h / MM_PER_INCH;
  if (slotWin <= 0 || slotHin <= 0) return null;
  const r1 = src.sw / slotWin;
  const r2 = src.sh / slotHin;
  // fill/cover is limited by the lower-resolution axis; fit/contain by the higher.
  return slot.fit === 'fit' ? Math.max(r1, r2) : Math.min(r1, r2);
}

export function isLowDpi(dpi) {
  return dpi != null && dpi < TARGET_DPI;
}
