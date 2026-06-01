import React, { useState } from 'react';
import { useStore } from '../state/store.jsx';
import { useImporter } from './useImporter.jsx';
import { buildFilterCss, overlayBackgrounds } from '../lib/filters.js';

function Thumb({ id, onCrop }) {
  const { state, dispatch } = useStore();
  const img = state.images[id];
  const selected = state.selectedIds.includes(id);
  const overlays = overlayBackgrounds(img.filters);

  const onClick = (e) => {
    if (e.shiftKey) dispatch({ type: 'SELECT', id, mode: 'range' });
    else if (e.ctrlKey || e.metaKey) dispatch({ type: 'SELECT', id, mode: 'toggle' });
    else dispatch({ type: 'SELECT', id, mode: 'single' });
  };

  return (
    <div className={`tile ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="tile-img-wrap">
        {img.needsReimport ? (
          <div className="reimport">
            <div className="reimport-icon">⟲</div>
            <div>Re-import<br />to restore pixels</div>
          </div>
        ) : (
          <>
            <img src={img.thumbUrl} alt={img.name} style={{ filter: buildFilterCss(img.filters, 0) }} />
            {overlays.length > 0 && (
              <div className="tile-overlay" style={{ background: overlays.join(', ') }} />
            )}
            {img.filters.grain > 0 && (
              <div className="tile-grain" style={{ opacity: (img.filters.grain / 100) * 0.4 }} />
            )}
          </>
        )}
        {selected && <div className="check">✓</div>}
      </div>
      <div className="tile-bar">
        <span className="tile-name" title={img.name}>{img.name}</span>
        <span className="tile-dims">{img.w}×{img.h}</span>
      </div>
      <div className="tile-actions">
        <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_SOLO', id }); dispatch({ type: 'SELECT', id, mode: 'single' }); }}>Solo</button>
        <button disabled={img.needsReimport} onClick={(e) => { e.stopPropagation(); onCrop(id); }}>Crop</button>
        <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REMOVE_IMAGES', ids: [id] }); }}>✕</button>
      </div>
    </div>
  );
}

export default function LibraryGrid({ onCrop }) {
  const { state, dispatch } = useStore();
  const { run } = useImporter();
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) run(e.dataTransfer.files);
  };

  if (!state.imageOrder.length) {
    return (
      <div
        className={`dropzone empty ${dragOver ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="dz-inner">
          <div className="dz-icon">🖼️</div>
          <h2>Drop photos here</h2>
          <p>JPG, PNG and HEIC supported. Or use “Import photos” above.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`dropzone ${dragOver ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="library-bar">
        <span>{state.selectedIds.length} selected</span>
        <button
          className="btn"
          disabled={!state.selectedIds.length}
          onClick={() => dispatch({ type: 'AUTO_FILL', ids: state.selectedIds, template: 'full-bleed' })}
        >
          Add selected to layout →
        </button>
        <button
          className="btn danger"
          disabled={!state.selectedIds.length}
          onClick={() => dispatch({ type: 'REMOVE_IMAGES', ids: state.selectedIds })}
        >
          Remove selected
        </button>
      </div>
      <div className="grid">
        {state.imageOrder.map((id) => (
          <Thumb key={id} id={id} onCrop={onCrop} />
        ))}
      </div>
    </div>
  );
}
