import React, { useRef, useState } from 'react';
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
            <div className="reimport-icon">{state.hydrating ? '⏳' : '⟲'}</div>
            <div>{state.hydrating ? 'Restoring…' : <>Re-import<br />to restore pixels</>}</div>
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
        {/* Checkbox: top-left */}
        <div className="tile-check">{selected ? '✓' : ''}</div>
        {/* Action buttons: top-right, visible on hover/selected */}
        <div className="tile-actions">
          <button
            className="tile-act-btn"
            disabled={img.needsReimport}
            onClick={(e) => { e.stopPropagation(); onCrop(id); }}
            title="Crop"
          >
            &#9986;
          </button>
          <button
            className="tile-act-btn"
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REMOVE_IMAGES', ids: [id] }); }}
            title="Remove"
          >
            &times;
          </button>
        </div>
      </div>
      <div className="tile-bar">
        <span className="tile-name" title={img.name}>{img.name}</span>
        <span className="tile-dims">{img.w}&times;{img.h}</span>
      </div>
    </div>
  );
}

export default function LibraryGrid({ onCrop }) {
  const { state, dispatch } = useStore();
  const { run, errors } = useImporter();
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) run(e.dataTransfer.files);
  };
  const onPick = (e) => { run(e.target.files); e.target.value = ''; };

  const fileInput = (
    <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={onPick} />
  );

  const selCount = state.selectedIds.length;

  if (!state.imageOrder.length) {
    return (
      <div
        className={`dropzone empty ${dragOver ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {fileInput}
        {/* White card with dashed border filling the area */}
        <div className="dz-card">
          <div className="dz-inner">
            {/* Cloud upload SVG icon */}
            <div className="dz-cloud-icon">
              <svg width="52" height="44" viewBox="0 0 52 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M26 28V44M26 28L20 34M26 28L32 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M40.5 36H42A10 10 0 0 0 42 16a10 10 0 0 0-1-.05A14 14 0 1 0 12 28.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2>Drop photos anywhere</h2>
            <p>the whole canvas is a drop target</p>
            {errors.length > 0 && <p className="warn" style={{ marginTop: 8 }}>&#9888; {errors.length} file(s) failed to import</p>}
          </div>
        </div>
        {/* Floating dock even in empty state */}
        <div className="library-dock">
          <button className="dock-add-btn" onClick={() => fileRef.current.click()} title="Add photos">
            +
          </button>
          <div className="dock-divider" />
          <button className="dock-btn" onClick={() => dispatch({ type: 'SELECT_ALL' })} title="Select all">&#10003;</button>
          <button className="dock-btn danger" disabled title="Delete selected">&#128465;</button>
          <button className="dock-btn" disabled title="Deselect">&#8722;</button>
          <span className="dock-count">0 sel</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`dropzone ${dragOver ? 'over' : ''}`}
      style={{ paddingBottom: 80 }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {fileInput}
      <div className="grid">
        {state.imageOrder.map((id) => (
          <Thumb key={id} id={id} onCrop={onCrop} />
        ))}
      </div>

      {/* Floating dock */}
      <div className="library-dock">
        <button className="dock-add-btn" onClick={() => fileRef.current.click()} title="Add photos">
          +
        </button>
        <div className="dock-divider" />
        <button className="dock-btn" onClick={() => dispatch({ type: 'SELECT_ALL' })} title="Select all">
          &#10003;
        </button>
        <button
          className="dock-btn danger"
          disabled={!selCount}
          onClick={() => dispatch({ type: 'REMOVE_IMAGES', ids: state.selectedIds })}
          title="Delete selected"
        >
          &#128465;
        </button>
        <button
          className="dock-btn"
          disabled={!selCount}
          onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}
          title="Deselect"
        >
          &#8722;
        </button>
        <span className={`dock-count ${selCount > 0 ? 'active' : ''}`}>{selCount} sel</span>
      </div>
    </div>
  );
}
