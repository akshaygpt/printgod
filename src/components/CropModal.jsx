import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { slotRectsMm } from '../lib/layout.js';

// Find the slot (if any) the image is assigned to, and its real-world aspect.
function findSlotAspect(state, imageId) {
  for (const page of state.pages) {
    const idx = page.slots.findIndex((s) => s.imageId === imageId);
    if (idx >= 0) {
      const r = slotRectsMm(page, state.settings)[idx];
      return r.w / r.h;
    }
  }
  return null;
}

export default function CropModal({ imageId, onClose }) {
  const { state, dispatch } = useStore();
  const img = state.images[imageId];
  const stageRef = useRef(null);
  const [box, setBox] = useState(null); // {x,y,w,h} in normalized image coords
  const drag = useRef(null);

  const slotAspect = useMemo(() => findSlotAspect(state, imageId), [state, imageId]);
  // Aspect expressed in normalized-crop space (fraction of image dims).
  const cropAspect = slotAspect != null ? slotAspect * (img.h / img.w) : img.w / img.h * (img.h / img.w); // == slotAspect*(h/w) or 1

  // Initialize crop from stored value or a centered box at the locked aspect.
  useEffect(() => {
    if (img.crop) {
      setBox({ ...img.crop });
      return;
    }
    if (slotAspect == null) {
      setBox({ x: 0, y: 0, w: 1, h: 1 });
      return;
    }
    // Largest centered rect with normalized aspect cropAspect (w/h).
    let w = 1, h = w / cropAspect;
    if (h > 1) { h = 1; w = h * cropAspect; }
    setBox({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  }, [imageId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!img) return null;

  const onPointerDown = (e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = stageRef.current.getBoundingClientRect();
    drag.current = { mode, rect, startX: e.clientX, startY: e.clientY, box: { ...box } };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.rect.width;
    const dy = (e.clientY - d.startY) / d.rect.height;
    let { x, y, w, h } = d.box;

    if (d.mode === 'move') {
      x = clamp(x + dx, 0, 1 - w);
      y = clamp(y + dy, 0, 1 - h);
    } else {
      // Corner resize, keeping the opposite corner anchored and aspect locked.
      const lockAspect = slotAspect != null;
      let nw = w, nh = h, nx = x, ny = y;
      if (d.mode.includes('e')) nw = w + dx;
      if (d.mode.includes('w')) { nw = w - dx; nx = x + dx; }
      if (d.mode.includes('s')) nh = h + dy;
      if (d.mode.includes('n')) { nh = h - dy; ny = y + dy; }
      if (lockAspect) {
        // Derive height from width to keep aspect; re-anchor on n/w handles.
        nh = nw / cropAspect;
        if (d.mode.includes('n')) ny = y + (h - nh);
      }
      nw = Math.max(0.05, nw);
      nh = Math.max(0.05, nh);
      // Clamp within bounds.
      nx = clamp(nx, 0, 1 - 0.05);
      ny = clamp(ny, 0, 1 - 0.05);
      if (nx + nw > 1) nw = 1 - nx;
      if (ny + nh > 1) nh = 1 - ny;
      if (lockAspect) nh = Math.min(nh, nw / cropAspect);
      x = nx; y = ny; w = nw; h = nh;
    }
    setBox({ x, y, w, h });
  };

  const onPointerUp = () => {
    drag.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  const apply = () => {
    const isFull = box.x <= 0.001 && box.y <= 0.001 && box.w >= 0.999 && box.h >= 0.999;
    dispatch({ type: 'SET_CROP', id: imageId, crop: isFull ? null : box });
    onClose();
  };

  const reset = () => dispatch({ type: 'SET_CROP', id: imageId, crop: null }) || setBox({ x: 0, y: 0, w: 1, h: 1 });

  const pct = (v) => `${v * 100}%`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal crop-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>Crop — {img.name}</h3>
          <span className="muted">
            {slotAspect != null
              ? `Locked to slot aspect ${slotAspect.toFixed(2)}:1`
              : 'Not assigned to a slot — free / native aspect'}
          </span>
        </header>

        <div className="crop-stage" ref={stageRef}>
          <img src={img.thumbUrl} alt="" draggable={false} />
          {box && (
            <>
              <div className="crop-shade" style={shadeStyle(box)} />
              <div
                className="crop-box"
                style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }}
                onPointerDown={(e) => onPointerDown(e, 'move')}
              >
                {['nw', 'ne', 'sw', 'se'].map((c) => (
                  <span
                    key={c}
                    className={`handle ${c}`}
                    onPointerDown={(e) => onPointerDown(e, c)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <footer className="modal-foot">
          <button className="btn" onClick={reset}>Reset</button>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={apply}>Apply crop</button>
        </footer>
      </div>
    </div>
  );
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Four shade rectangles around the crop box (rendered as a box-shadow trick).
function shadeStyle(box) {
  return {
    position: 'absolute',
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
    pointerEvents: 'none',
  };
}
