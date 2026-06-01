import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { pageDimsMm, slotRectsMm, printableRectMm } from './layout.js';
import { renderSlot } from './filters.js';
import { TEMPLATES, MM_PER_INCH, TARGET_DPI } from '../state/constants.js';

const PT_PER_MM = 72 / MM_PER_INCH;

function loadImageEl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function canvasToBytes(canvas, quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => resolve(new Uint8Array(await blob.arrayBuffer())), 'image/jpeg', quality);
  });
}

// Render one document page (with its slots) onto a pdf-lib page.
async function drawPage(pdf, font, page, settings, imageCache) {
  const dims = pageDimsMm(settings);
  const pw = dims.w * PT_PER_MM;
  const ph = dims.h * PT_PER_MM;
  const pdfPage = pdf.addPage([pw, ph]);
  const tpl = TEMPLATES[page.template];
  const rects = slotRectsMm(page, settings);

  for (let i = 0; i < page.slots.length; i++) {
    const slot = page.slots[i];
    const r = rects[i];
    if (!slot.imageId) continue;
    const img = imageCache.records[slot.imageId];
    if (!img || img.needsReimport || !img.fullResUrl) continue;

    let drawable = imageCache.els[slot.imageId];
    if (!drawable) {
      drawable = await loadImageEl(img.fullResUrl);
      imageCache.els[slot.imageId] = drawable;
    }

    // Render at target DPI so embedded pixels match the print resolution.
    const destW = (r.w / MM_PER_INCH) * TARGET_DPI;
    const destH = (r.h / MM_PER_INCH) * TARGET_DPI;
    const canvas = renderSlot(drawable, img, slot, {
      destW,
      destH,
      printComp: settings.printCompensation,
    });
    const bytes = await canvasToBytes(canvas, 0.92);
    const embedded = await pdf.embedJpg(bytes);

    // pdf-lib origin is bottom-left; our rects are top-left.
    const x = r.x * PT_PER_MM;
    const y = ph - (r.y + r.h) * PT_PER_MM;
    pdfPage.drawImage(embedded, { x, y, width: r.w * PT_PER_MM, height: r.h * PT_PER_MM });

    // Polaroid frame + caption.
    if (tpl.polaroid) {
      pdfPage.drawRectangle({
        x,
        y,
        width: r.w * PT_PER_MM,
        height: r.h * PT_PER_MM,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 1,
      });
      const caption = slot.caption || '';
      if (caption) {
        const size = 12;
        const tw = font.widthOfTextAtSize(caption, size);
        pdfPage.drawText(caption, {
          x: x + (r.w * PT_PER_MM - tw) / 2,
          y: y - 22,
          size,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
    }

    // Contact-sheet filename labels.
    if (tpl.contactSheet && img.name) {
      const size = 6;
      const label = img.name.length > 22 ? img.name.slice(0, 21) + '…' : img.name;
      pdfPage.drawText(label, { x: x + 2, y: y + 2, size, font, color: rgb(1, 1, 1) });
    }
  }
  return pdfPage;
}

// Build a PDF from the given pages. Returns Uint8Array bytes.
export async function buildPdf(state, pages) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const imageCache = { records: state.images, els: {} };
  for (const page of pages) {
    await drawPage(pdf, font, page, state.settings, imageCache);
  }
  return pdf.save();
}

export function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Full document export.
export async function exportFullPdf(state) {
  const bytes = await buildPdf(state, state.pages);
  downloadBytes(bytes, 'printgod.pdf');
}

// Single page (1-based page number) — used for test prints.
export async function exportSinglePage(state, pageNumber) {
  const page = state.pages[pageNumber - 1];
  if (!page) return;
  const bytes = await buildPdf(state, [page]);
  downloadBytes(bytes, `printgod-page-${pageNumber}.pdf`);
}

// Duplex: split into odd / even sheets (1-based numbering).
export async function exportDuplex(state) {
  const odds = state.pages.filter((_, i) => (i + 1) % 2 === 1);
  const evens = state.pages.filter((_, i) => (i + 1) % 2 === 0);
  const oddBytes = await buildPdf(state, odds);
  downloadBytes(oddBytes, 'printgod-odds.pdf');
  if (evens.length) {
    const evenBytes = await buildPdf(state, evens);
    downloadBytes(evenBytes, 'printgod-evens.pdf');
  }
}

// Calibration / test sheet: color bars, grayscale ramp, registration marks and
// a reference photo (first assigned image, if any).
export async function exportTestPage(state) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const dims = pageDimsMm(state.settings);
  const pw = dims.w * PT_PER_MM;
  const ph = dims.h * PT_PER_MM;
  const page = pdf.addPage([pw, ph]);
  const margin = 12 * PT_PER_MM;

  page.drawText('PrintGod — Calibration Sheet', { x: margin, y: ph - margin, size: 16, font, color: rgb(0, 0, 0) });
  page.drawText(`${state.settings.paperSize} · ${state.settings.orientation} · print compensation +${Math.round(state.settings.printCompensation * 100)}%`, {
    x: margin,
    y: ph - margin - 18,
    size: 9,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Color bars.
  const bars = [
    rgb(0, 0, 0), rgb(1, 1, 1), rgb(0.5, 0.5, 0.5),
    rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1),
    rgb(0, 1, 1), rgb(1, 0, 1), rgb(1, 1, 0),
  ];
  const barTop = ph - margin - 40;
  const barH = 36;
  const barW = (pw - 2 * margin) / bars.length;
  bars.forEach((c, i) => {
    page.drawRectangle({ x: margin + i * barW, y: barTop - barH, width: barW, height: barH, color: c });
  });

  // Grayscale ramp (11 steps).
  const rampTop = barTop - barH - 16;
  const steps = 11;
  const rampW = (pw - 2 * margin) / steps;
  for (let i = 0; i < steps; i++) {
    const v = i / (steps - 1);
    page.drawRectangle({ x: margin + i * rampW, y: rampTop - 28, width: rampW, height: 28, color: rgb(v, v, v) });
  }

  // Reference photo.
  const refId = state.pages.flatMap((p) => p.slots).map((s) => s.imageId).find((id) => id && state.images[id] && !state.images[id].needsReimport) || state.imageOrder.find((id) => state.images[id] && !state.images[id].needsReimport);
  if (refId) {
    const img = state.images[refId];
    const el = await loadImageEl(img.fullResUrl);
    const boxW = pw - 2 * margin;
    const boxH = rampTop - 28 - margin - 16;
    const slot = { fit: 'fit', imageId: refId };
    const destW = (boxW / PT_PER_MM / MM_PER_INCH) * TARGET_DPI;
    const destH = (boxH / PT_PER_MM / MM_PER_INCH) * TARGET_DPI;
    const canvas = renderSlot(el, img, slot, { destW, destH, printComp: state.settings.printCompensation });
    const bytes = await canvasToBytes(canvas, 0.92);
    const embedded = await pdf.embedJpg(bytes);
    page.drawImage(embedded, { x: margin, y: margin + 16, width: boxW, height: boxH });
  }

  // Corner registration marks.
  const mk = 16;
  const corners = [
    [margin / 2, margin / 2],
    [pw - margin / 2, margin / 2],
    [margin / 2, ph - margin / 2],
    [pw - margin / 2, ph - margin / 2],
  ];
  corners.forEach(([cx, cy]) => {
    page.drawLine({ start: { x: cx - mk, y: cy }, end: { x: cx + mk, y: cy }, thickness: 0.75, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: cx, y: cy - mk }, end: { x: cx, y: cy + mk }, thickness: 0.75, color: rgb(0, 0, 0) });
  });

  const bytes = await pdf.save();
  downloadBytes(bytes, 'printgod-calibration.pdf');
}
