import React, { useEffect, useRef } from 'react';
import { renderSlot } from '../lib/filters.js';
import { useImageEl } from './useImageEl.js';

// WYSIWYG slot preview: draws the image with the same renderSlot used for
// export, at the displayed pixel size, so the screen matches the PDF.
export default function SlotCanvas({ img, slot, printComp, pxW, pxH }) {
  const canvasRef = useRef(null);
  const el = useImageEl(img && !img.needsReimport ? img.thumbUrl : null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(pxW * dpr));
    const h = Math.max(1, Math.round(pxH * dpr));
    if (!el) {
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      return;
    }
    const rendered = renderSlot(el, img, slot, { destW: w, destH: h, printComp });
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(rendered, 0, 0);
  }, [el, img, slot.fit, slot.imageId, printComp, pxW, pxH, JSON.stringify(img && img.filters), JSON.stringify(img && img.crop)]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
