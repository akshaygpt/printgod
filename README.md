# PrintGod — client-side photo print studio

Single-page React app for printing photos to a physical printer on glossy
paper. Everything runs in the browser — **no backend, no uploads**. Photos are
decoded, edited, laid out and exported to a print-ready PDF entirely client-side.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

## What it does

1. **Import & select** — drag/drop or file-pick JPG/PNG/HEIC. HEIC is decoded
   with `heic2any`; every import is redrawn through a canvas, which normalizes
   it to the sRGB color space and bakes in EXIF orientation. Thumbnails are
   generated on import; full-resolution pixels are held in memory only and used
   solely at export, so 50+ photos stay responsive. Grid multi-select supports
   click, ⌘/Ctrl-click (toggle), shift-click (range) and select-all (⌘/Ctrl-A).
2. **Bulk edit** — brightness, contrast, saturation, exposure, warmth, grain,
   vignette, B&W, sepia, fade, applied to all selected photos at once. A global
   **print-compensation** brightness slider (default +12%, "glossy prints render
   darker than screens") boosts every photo at export. Solo-edit one photo, crop
   it (aspect-locked to its assigned slot), and undo/redo (⌘/Ctrl-Z /
   ⌘/Ctrl-Shift-Z) across both bulk and solo changes. Edits are **non-destructive**
   — stored as per-image params and only baked into pixels at export.
3. **Layout templates** — A4 / A5 / A6 / Letter / 4×6, portrait/landscape. Eight
   templates: full-bleed, 2-up vertical, 2-up horizontal, 4-up, 6-up, 9-up
   contact sheet, polaroid+caption, magazine asymmetric. Per-slot fit
   (letterbox) vs fill (crop), drag photos between slots and from the tray,
   reorder/add/delete pages. **Auto-populate** builds pages from the selected (or
   all) photos preserving aspect ratio — every slot uses fit (no crop) and
   cross-orientation photos are paired onto a sheet to minimize wasted space.
   Margin/bleed (0/3/5mm) is drawn as a cut line + safe-zone overlay. A DPI badge
   warns on any image rendering below 300 DPI for its slot. Click any placed
   photo to open a slot inspector: a **size-in-slot** slider (below 100% leaves
   space around the photo), position nudges, fit/fill, crop and the full filter
   set — so photos can be edited without leaving the layout. A preview zoom
   control (Fit / 50% / 100% / 200% + slider) shows the sheet at actual print
   size (100%) for close inspection.
4. **Print orchestration** — the primary path generates a print-ready PDF with
   `pdf-lib`: exact paper dimensions, images embedded at a 300-DPI target. A
   `window.print()` fallback with a `@media print` stylesheet prints one page
   per sheet. A calibration sheet (color bars, grayscale ramp, registration
   marks, reference photo) and single-page export support test prints. The
   duplex dialog detects odd/even pages and either exports one PDF (auto-duplex)
   or two (odds/evens) with a long-edge/short-edge flip diagram and step-by-step
   instructions.
5. **State** — editing metadata (filters, crops, slot assignments, page order,
   settings) persists to `localStorage`; the actual image pixels persist to
   **IndexedDB**. On refresh the session is fully restored — photos rehydrate
   automatically, no re-import needed. Any photo whose pixels can't be restored
   is dropped along with its slot, so no broken placeholders linger.

## Architecture

```
src/
  state/
    constants.js   paper sizes, templates (normalized slot rects), default filters
    store.jsx      useReducer + Context; immutable doc reducer wrapped with an
                   undo/redo history stack; debounced persistence; global keys
  lib/
    imageImport.js HEIC decode, sRGB normalization, thumbnail + full-res gen,
                   bounded-concurrency batch import
    filters.js     CSS/canvas filter builder + renderSlot() — the single
                   render path shared by on-screen preview and PDF export
    layout.js      mm geometry for slots, gutters, margins; effective-DPI math
    pdf.js         pdf-lib export, calibration sheet, single-page, duplex split
    storage.js     localStorage (editing metadata only)
    imageStore.js  IndexedDB store for image pixels (blobs + thumbnails)
  components/
    App, Toolbar, LibraryGrid, EditPanel, CropModal,
    LayoutEditor, PagePreview, SlotCanvas, PrintPanel, DuplexModal
```

### State shape

```
images: { [id]: { name, w, h, thumbUrl, fullResUrl, filters, crop, needsReimport } }
imageOrder: [id]
selectedIds: [id]      soloId: id|null
pages: [{ id, template, slots: [{ imageId, fit, caption }] }]
settings: { paperSize, orientation, margin, printCompensation }
history: { past:[snapshot], future:[snapshot] }   // snapshot = {images,imageOrder,pages,settings}
```

`renderSlot()` is used by both `SlotCanvas` (preview, thumb-res) and `pdf.js`
(export, full-res), so the screen is WYSIWYG against the printed PDF.

## Design decisions / known trade-offs

- **PDF-first.** `pdf-lib` embeds full-resolution JPEGs at exact paper
  dimensions; this is the most reliable route to correct physical sizing.
  `window.print()` is a convenience fallback and is not pixel-exact.
- **Two-tier persistence.** Editing metadata (filters, crops, slot assignments,
  page order, settings) is small and changes often, so it lives in
  `localStorage`. Image pixels are large, so the full-resolution JPEG blobs and
  thumbnails live in **IndexedDB** (`lib/imageStore.js`), which has no practical
  size limit and survives reloads. On startup the metadata loads synchronously
  and pixels rehydrate asynchronously from IndexedDB, so a refresh fully restores
  the session. If IndexedDB is unavailable (e.g. private browsing) or a blob was
  evicted, the affected photos are dropped and their slots cleared rather than
  left as broken placeholders. Autosave runs debounced; the unload warning only
  fires if a save is still in flight.
- **Filters** that CSS `filter` can express (brightness/contrast/saturate/
  grayscale/sepia/hue-rotate) are reused verbatim on the export canvas via
  `ctx.filter`; grain, vignette and fade are drawn as separate canvas passes.
