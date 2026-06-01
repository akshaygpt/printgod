import React, { useState } from 'react';
import { useStore } from '../state/store.jsx';
import { PAPER_SIZES, MARGIN_OPTIONS, TEMPLATES, FILTER_CONTROLS, FILTER_TOGGLES, MM_PER_INCH } from '../state/constants.js';
import PagePreview from './PagePreview.jsx';

const SCREEN_PPM = 96 / MM_PER_INCH; // CSS reference: 100% ≈ actual print size

export default function LayoutEditor({ onCrop }) {
  const { state, dispatch } = useStore();
  const [active, setActive] = useState(0);
  const [overlays, setOverlays] = useState(true);
  const [zoom, setZoom] = useState('fit'); // 'fit' | number (percent)
  const [sel, setSel] = useState(null); // { pageId, index }

  const activeIdx = Math.min(active, state.pages.length - 1);
  const page = state.pages[activeIdx];
  const set = (settings) => dispatch({ type: 'SET_SETTINGS', settings });

  const goPage = (i) => { setActive(i); setSel(null); };

  const autoPopulate = () => {
    const source = state.selectedIds.length ? state.selectedIds : state.imageOrder;
    const ids = source.filter((id) => state.images[id] && !state.images[id].needsReimport);
    if (!ids.length) return;
    const hasAssignments = state.pages.some((p) => p.slots.some((s) => s.imageId));
    if (hasAssignments && !confirm('Replace the current layout with an auto-populated one?')) return;
    dispatch({ type: 'AUTO_LAYOUT', ids });
    goPage(0);
  };

  // The slot currently being inspected/edited (may live on any page).
  const selPage = sel ? state.pages.find((p) => p.id === sel.pageId) : null;
  const selSlot = selPage ? selPage.slots[sel.index] : null;
  const selImg = selSlot && selSlot.imageId ? state.images[selSlot.imageId] : null;

  const setTransform = (transform) =>
    dispatch({ type: 'SET_SLOT_TRANSFORM', pageId: sel.pageId, slotIndex: sel.index, transform });
  const nudge = (dx, dy) =>
    setTransform({
      offsetX: clamp((selSlot.offsetX || 0) + dx, -0.5, 0.5),
      offsetY: clamp((selSlot.offsetY || 0) + dy, -0.5, 0.5),
    });

  const ppm = zoom === 'fit' ? null : SCREEN_PPM * (zoom / 100);

  return (
    <div className="layout-editor">
      <aside className="layout-side">
        {selImg && (
          <section className="slot-inspector">
            <div className="inspector-head">
              <h4>Edit photo in slot</h4>
              <button className="link" onClick={() => setSel(null)}>done</button>
            </div>
            <div className="inspector-name muted">{selImg.name}</div>

            <div className="control">
              <label>
                Size in slot
                <span className="val">{Math.round((selSlot.zoom != null ? selSlot.zoom : 1) * 100)}%</span>
              </label>
              <input
                type="range" min="25" max="200"
                value={Math.round((selSlot.zoom != null ? selSlot.zoom : 1) * 100)}
                onChange={(e) => setTransform({ zoom: Number(e.target.value) / 100 })}
              />
              <small className="muted">Below 100% leaves space around the photo.</small>
            </div>

            <div className="seg">
              <button className={selSlot.fit === 'fit' ? 'on' : ''} onClick={() => dispatch({ type: 'SET_SLOT_FIT', pageId: sel.pageId, slotIndex: sel.index, fit: 'fit' })}>Fit</button>
              <button className={selSlot.fit === 'fill' ? 'on' : ''} onClick={() => dispatch({ type: 'SET_SLOT_FIT', pageId: sel.pageId, slotIndex: sel.index, fit: 'fill' })}>Fill</button>
            </div>

            <div className="nudge-pad">
              <button onClick={() => nudge(0, -0.05)} title="Up">↑</button>
              <button onClick={() => nudge(-0.05, 0)} title="Left">←</button>
              <button onClick={() => setTransform({ offsetX: 0, offsetY: 0, zoom: 1 })} title="Reset position & size">⊙</button>
              <button onClick={() => nudge(0.05, 0)} title="Right">→</button>
              <button onClick={() => nudge(0, 0.05)} title="Down">↓</button>
            </div>

            <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => onCrop(selSlot.imageId)}>✂ Crop…</button>

            <div className="inspector-filters">
              {FILTER_CONTROLS.map((c) => (
                <div className="control" key={c.key}>
                  <label>{c.label}<span className="val">{selImg.filters[c.key]}</span></label>
                  <input
                    type="range" min={c.min} max={c.max}
                    value={selImg.filters[c.key]}
                    onChange={(e) => dispatch({ type: 'UPDATE_FILTER', key: c.key, value: Number(e.target.value), targets: [selImg.id] })}
                  />
                </div>
              ))}
              <div className="toggles">
                {FILTER_TOGGLES.map((t) => (
                  <button key={t.key} className={`toggle ${selImg.filters[t.key] ? 'on' : ''}`} onClick={() => dispatch({ type: 'TOGGLE_FILTER', key: t.key, targets: [selImg.id] })}>{t.label}</button>
                ))}
                <button className="toggle" onClick={() => dispatch({ type: 'RESET_FILTERS', targets: [selImg.id] })}>Reset</button>
              </div>
            </div>
          </section>
        )}

        <section>
          <h4>Paper</h4>
          <div className="seg">
            {Object.keys(PAPER_SIZES).map((k) => (
              <button key={k} className={state.settings.paperSize === k ? 'on' : ''} onClick={() => set({ paperSize: k })}>
                {PAPER_SIZES[k].label}
              </button>
            ))}
          </div>
          <div className="seg">
            <button className={state.settings.orientation === 'portrait' ? 'on' : ''} onClick={() => set({ orientation: 'portrait' })}>Portrait</button>
            <button className={state.settings.orientation === 'landscape' ? 'on' : ''} onClick={() => set({ orientation: 'landscape' })}>Landscape</button>
          </div>
        </section>

        <section>
          <h4>Margin / Bleed</h4>
          <div className="seg">
            {MARGIN_OPTIONS.map((m) => (
              <button key={m} className={state.settings.margin === m ? 'on' : ''} onClick={() => set({ margin: m })}>
                {m}mm
              </button>
            ))}
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={overlays} onChange={(e) => setOverlays(e.target.checked)} />
            Show cut line + safe zone
          </label>
        </section>

        <section>
          <h4>Template for page {activeIdx + 1}</h4>
          <div className="template-grid">
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button
                key={key}
                className={`tpl ${page.template === key ? 'on' : ''}`}
                onClick={() => { dispatch({ type: 'SET_PAGE_TEMPLATE', pageId: page.id, template: key }); setSel(null); }}
                title={t.label}
              >
                <TemplateGlyph tpl={t} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h4>Auto-populate</h4>
          <button className="btn primary" style={{ width: '100%' }} onClick={autoPopulate} disabled={!state.imageOrder.length}>
            ✨ Auto-populate layout
          </button>
          <small className="muted" style={{ display: 'block', marginTop: 6 }}>
            Builds pages from {state.selectedIds.length ? `${state.selectedIds.length} selected` : 'all'} photos,
            preserving aspect ratio (fit, no crop) and pairing photos that fill the sheet best.
          </small>
        </section>

        <section>
          <h4>Photos <span className="muted">(drag into slots)</span></h4>
          <div className="tray">
            {state.imageOrder.length === 0 && <p className="muted">No photos imported.</p>}
            {state.imageOrder.map((id) => {
              const img = state.images[id];
              return (
                <div
                  key={id}
                  className="tray-item"
                  draggable={!img.needsReimport}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'tray', imageId: id }))}
                  title={img.name}
                >
                  {img.needsReimport ? <div className="tray-reimport">{state.hydrating ? '⏳' : '⟲'}</div> : <img src={img.thumbUrl} alt="" />}
                </div>
              );
            })}
          </div>
        </section>
      </aside>

      <section className="layout-main">
        <div className="page-toolbar">
          <button className="btn" onClick={() => { dispatch({ type: 'ADD_PAGE', template: page.template }); goPage(state.pages.length); }}>+ Add page</button>
          <button className="btn" disabled={activeIdx === 0} onClick={() => { dispatch({ type: 'REORDER_PAGES', from: activeIdx, to: activeIdx - 1 }); goPage(activeIdx - 1); }}>◀ Move</button>
          <button className="btn" disabled={activeIdx === state.pages.length - 1} onClick={() => { dispatch({ type: 'REORDER_PAGES', from: activeIdx, to: activeIdx + 1 }); goPage(activeIdx + 1); }}>Move ▶</button>
          <button className="btn danger" onClick={() => { dispatch({ type: 'REMOVE_PAGE', pageId: page.id }); goPage(Math.max(0, activeIdx - 1)); }}>Delete page</button>
          <div className="spacer" />

          <div className="zoom-control">
            <button className={`zbtn ${zoom === 'fit' ? 'on' : ''}`} onClick={() => setZoom('fit')}>Fit</button>
            {[50, 100, 200].map((z) => (
              <button key={z} className={`zbtn ${zoom === z ? 'on' : ''}`} onClick={() => setZoom(z)}>{z}%</button>
            ))}
            <input
              type="range" min="25" max="300" step="5"
              value={zoom === 'fit' ? 100 : zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              title="Zoom (100% ≈ actual print size)"
            />
            <span className="muted" style={{ minWidth: 70 }}>
              {zoom === 'fit' ? 'Fit' : `${zoom}% ${zoom === 100 ? '(actual)' : ''}`}
            </span>
          </div>
          <span className="muted">Page {activeIdx + 1} / {state.pages.length}</span>
        </div>

        <div className={`stage ${zoom === 'fit' ? '' : 'zoomed'}`} onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
          <PagePreview
            page={page}
            maxW={560}
            maxH={680}
            ppm={ppm}
            interactive
            showOverlays={overlays}
            onCrop={onCrop}
            selectedSlot={sel}
            onSelectSlot={setSel}
          />
        </div>

        <div className="page-strip">
          {state.pages.map((p, i) => (
            <div key={p.id} className={`strip-page ${i === activeIdx ? 'on' : ''}`} onClick={() => goPage(i)}>
              <PagePreview page={p} maxW={84} maxH={110} />
              <span>{i + 1}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Tiny schematic of a template's slot layout.
function TemplateGlyph({ tpl }) {
  return (
    <span className="glyph">
      {tpl.slots.map((s, i) => (
        <span key={i} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%` }} />
      ))}
    </span>
  );
}
