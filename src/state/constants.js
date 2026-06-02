// Physical constants. All paper dimensions in millimeters (portrait orientation).
export const MM_PER_INCH = 25.4;
export const TARGET_DPI = 300;

export const PAPER_SIZES = {
  A4: { label: 'A4', w: 210, h: 297 },
  A5: { label: 'A5', w: 148, h: 210 },
  A6: { label: 'A6', w: 105, h: 148 },
  Letter: { label: 'Letter', w: 215.9, h: 279.4 },
  '4x6': { label: '4×6 in', w: 101.6, h: 152.4 },
};

export const MARGIN_OPTIONS = [0, 3, 5]; // mm

// Returns printable paper rect in mm, accounting for orientation.
export function getPaperDimsMm(paperSize, orientation) {
  const p = PAPER_SIZES[paperSize] || PAPER_SIZES.A4;
  return orientation === 'landscape' ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

// Default non-destructive filter state per image.
export const DEFAULT_FILTERS = {
  brightness: 0, // -100..100
  contrast: 0, // -100..100
  saturation: 0, // -100..100
  exposure: 0, // -100..100
  warmth: 0, // -100 (cool) .. 100 (warm)
  grain: 0, // 0..100
  vignette: 0, // 0..100
  bw: false,
  sepia: false,
  fade: 0, // 0..100
};

export const FILTER_CONTROLS = [
  { key: 'exposure',    label: 'Exposure',    min: -100, max: 100, icon: '☉', section: 'tone' },
  { key: 'brightness',  label: 'Brightness',  min: -100, max: 100, icon: '☀', section: 'tone' },
  { key: 'contrast',    label: 'Contrast',    min: -100, max: 100, icon: '◑', section: 'tone' },
  { key: 'saturation',  label: 'Saturation',  min: -100, max: 100, icon: '◆', section: 'tone' },
  { key: 'warmth',      label: 'Warmth',      min: -100, max: 100, icon: '☀︎', section: 'tone' },
  { key: 'fade',        label: 'Fade',        min: 0,    max: 100, icon: '≡', section: 'tone' },
  { key: 'grain',       label: 'Grain',       min: 0,    max: 100, icon: '⊞', section: 'texture' },
  { key: 'vignette',    label: 'Vignette',    min: 0,    max: 100, icon: '⊟', section: 'texture' },
];

export const FILTER_TOGGLES = [
  { key: 'bw', label: 'B&W' },
  { key: 'sepia', label: 'Sepia' },
];

// Slot rectangles are normalized (0..1) within the printable (post-margin) area.
// gutter (mm) is the gap drawn between multi-slot cells.
export const TEMPLATES = {
  'full-bleed': {
    label: '1-up Full Bleed',
    bleed: true,
    slots: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  '2up-v': {
    label: '2-up Vertical',
    slots: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  '2up-h': {
    label: '2-up Horizontal',
    slots: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  '4up': {
    label: '4-up Grid',
    slots: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  '6up': {
    label: '6-up Grid',
    slots: gridSlots(2, 3),
  },
  '9up': {
    label: '9-up Contact Sheet',
    slots: gridSlots(3, 3),
    contactSheet: true,
  },
  polaroid: {
    label: 'Polaroid + Caption',
    polaroid: true,
    slots: [{ x: 0.12, y: 0.1, w: 0.76, h: 0.62, caption: true }],
  },
  magazine: {
    label: 'Magazine Asymmetric',
    slots: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  },
};

function gridSlots(cols, rows) {
  const slots = [];
  const w = 1 / cols;
  const h = 1 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({ x: c * w, y: r * h, w, h });
    }
  }
  return slots;
}

export const GUTTER_MM = 3; // gap between multi-up cells

export function makeSlot(def) {
  return {
    imageId: null,
    fit: 'fill', // 'fit' (letterbox) | 'fill' (crop)
    caption: def && def.caption ? '' : null,
    zoom: 1, // 1 = exactly fit/fill the slot; <1 occupies less space; >1 zooms in
    offsetX: 0, // pan, as a fraction of slot width  (-0.5..0.5)
    offsetY: 0, // pan, as a fraction of slot height
  };
}
