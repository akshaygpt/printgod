import React from 'react';
import { useStore } from '../state/store.jsx';
import { pageDimsMm, slotRectsMm, slotDpi, isLowDpi } from '../lib/layout.js';
import { TEMPLATES } from '../state/constants.js';
import SlotCanvas from './SlotCanvas.jsx';

const SAFE_INSET_MM = 4; // safe-zone inset inside the cut line

export default function PagePreview({ page, maxW, maxH, interactive = false, showOverlays = false, onCrop }) {
  const { state, dispatch } = useStore();
  const dims = pageDimsMm(state.settings);
  const ppm = Math.min(maxW / dims.w, maxH / dims.h); // px per mm
  const W = dims.w * ppm;
  const H = dims.h * ppm;
  const rects = slotRectsMm(page, state.settings);
  const tpl = TEMPLATES[page.template];
  const margin = tpl.bleed ? 0 : state.settings.margin;

  const onDropSlot = (e, slotIndex) => {
    e.preventDefault();
    e.stopPropagation();
    let data;
    try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    if (data.kind === 'tray') {
      dispatch({ type: 'ASSIGN_SLOT', pageId: page.id, slotIndex, imageId: data.imageId });
    } else if (data.kind === 'slot') {
      dispatch({ type: 'MOVE_SLOT', from: { pageId: data.pageId, slotIndex: data.slotIndex }, to: { pageId: page.id, slotIndex } });
    }
  };

  return (
    <div className="sheet" style={{ width: W, height: H }}>
      {rects.map((r, i) => {
        const slot = page.slots[i];
        const img = slot.imageId ? state.images[slot.imageId] : null;
        const dpi = slotDpi(img, slot, r);
        const low = isLowDpi(dpi);
        const style = {
          left: r.x * ppm,
          top: r.y * ppm,
          width: r.w * ppm,
          height: r.h * ppm,
        };
        return (
          <div
            key={i}
            className={`slot ${img ? 'filled' : 'empty'}`}
            style={style}
            draggable={interactive && !!img}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'slot', pageId: page.id, slotIndex: i }))}
            onDragOver={interactive ? (e) => e.preventDefault() : undefined}
            onDrop={interactive ? (e) => onDropSlot(e, i) : undefined}
          >
            {img ? (
              <SlotCanvas img={img} slot={slot} printComp={state.settings.printCompensation} pxW={r.w * ppm} pxH={r.h * ppm} />
            ) : (
              interactive && <div className="slot-empty-hint">drop photo</div>
            )}

            {interactive && img && (
              <div className="slot-controls">
                <button
                  className={`mini ${slot.fit === 'fit' ? 'on' : ''}`}
                  onClick={() => dispatch({ type: 'SET_SLOT_FIT', pageId: page.id, slotIndex: i, fit: 'fit' })}
                  title="Fit (letterbox)"
                >fit</button>
                <button
                  className={`mini ${slot.fit === 'fill' ? 'on' : ''}`}
                  onClick={() => dispatch({ type: 'SET_SLOT_FIT', pageId: page.id, slotIndex: i, fit: 'fill' })}
                  title="Fill (crop)"
                >fill</button>
                {onCrop && <button className="mini" onClick={() => onCrop(slot.imageId)} title="Crop">✂</button>}
                <button className="mini" onClick={() => dispatch({ type: 'ASSIGN_SLOT', pageId: page.id, slotIndex: i, imageId: null })} title="Remove">✕</button>
              </div>
            )}

            {img && dpi != null && (
              <div className={`dpi-badge ${low ? 'low' : 'ok'}`} title={low ? 'Below 300 DPI for this slot size' : 'Sufficient resolution'}>
                {low ? '⚠ ' : ''}≈{Math.round(dpi)} DPI
              </div>
            )}

            {tpl.polaroid && slot.caption != null && interactive && (
              <input
                className="caption-input"
                value={slot.caption}
                placeholder="caption…"
                onChange={(e) => dispatch({ type: 'SET_SLOT_CAPTION', pageId: page.id, slotIndex: i, text: e.target.value })}
              />
            )}
          </div>
        );
      })}

      {showOverlays && (
        <>
          {/* Cut / trim line at the margin inset. */}
          <div
            className="overlay cut"
            style={{ left: margin * ppm, top: margin * ppm, width: (dims.w - 2 * margin) * ppm, height: (dims.h - 2 * margin) * ppm }}
          />
          {/* Safe zone inside the cut line. */}
          <div
            className="overlay safe"
            style={{
              left: (margin + SAFE_INSET_MM) * ppm,
              top: (margin + SAFE_INSET_MM) * ppm,
              width: Math.max(0, dims.w - 2 * (margin + SAFE_INSET_MM)) * ppm,
              height: Math.max(0, dims.h - 2 * (margin + SAFE_INSET_MM)) * ppm,
            }}
          />
        </>
      )}
    </div>
  );
}
