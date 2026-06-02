import React, { useState } from 'react';
import { useStore } from '../state/store.jsx';
import { PAPER_SIZES, TEMPLATES, FILTER_CONTROLS, FILTER_TOGGLES, MM_PER_INCH } from '../state/constants.js';
import PagePreview from './PagePreview.jsx';

const SCREEN_PPM = 96 / MM_PER_INCH;

// Paper size display dimensions text
const PAPER_DIM_LABELS = {
  A4: '210 × 297',
  A5: '148 × 210',
  A6: '105 × 148',
  Letter: '216 × 279',
  '4x6': '102 × 152',
};

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

  // Margin as integer mm (0..10)
  const marginVal = typeof state.settings.margin === 'number' ? state.settings.margin : 0;

  return (
    <div className="layout-editor">
      <aside className="layout-side">
        {/* Slot inspector (shown when a slot is selected) */}
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
            </div>

            <div className="seg">
              <button className={selSlot.fit === 'fit' ? 'on' : ''} onClick={() => dispatch({ type: 'SET_SLOT_FIT', pageId: sel.pageId, slotIndex: sel.index, fit: 'fit' })}>Fit</button>
              <button className={selSlot.fit === 'fill' ? 'on' : ''} onClick={() => dispatch({ type: 'SET_SLOT_FIT', pageId: sel.pageId, slotIndex: sel.index, fit: 'fill' })}>Fill</button>
            </div>

            <div className="nudge-pad">
              <button onClick={() => nudge(0, -0.05)} title="Up">&#8593;</button>
              <button onClick={() => nudge(-0.05, 0)} title="Left">&#8592;</button>
              <button onClick={() => setTransform({ offsetX: 0, offsetY: 0, zoom: 1 })} title="Reset">&#8857;</button>
              <button onClick={() => nudge(0.05, 0)} title="Right">&#8594;</button>
              <button onClick={() => nudge(0, 0.05)} title="Down">&#8595;</button>
            </div>

            <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => onCrop(selSlot.imageId)}>
              &#9986; Crop&hellip;
            </button>

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
                  <button key={t.key} className={`toggle ${selImg.filters[t.key] ? 'on' : ''}`}
                    onClick={() => dispatch({ type: 'TOGGLE_FILTER', key: t.key, targets: [selImg.id] })}>
                    {t.label}
                  </button>
                ))}
                <button className="toggle" onClick={() => dispatch({ type: 'RESET_FILTERS', targets: [selImg.id] })}>Reset</button>
              </div>
            </div>
          </section>
        )}

        {/* Layout panel header */}
        <div className="layout-side-header">
          <h3>Layout</h3>
          <button
            className="wand-btn"
            onClick={autoPopulate}
            disabled={!state.imageOrder.length}
            title="Auto-populate layout"
          >
            &#10022;
          </button>
        </div>

        {/* Paper size: 3-column card grid */}
        <section>
          <span className="section-label">Paper Size</span>
          <div className="paper-grid">
            {Object.keys(PAPER_SIZES).map((k) => (
              <button
                key={k}
                className={`paper-card ${state.settings.paperSize === k ? 'on' : ''}`}
                onClick={() => set({ paperSize: k })}
              >
                <span className="paper-icon" />
                <span className="paper-name">{PAPER_SIZES[k].label}</span>
                <span className="paper-dims">{PAPER_DIM_LABELS[k] || ''}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Orientation: segmented control */}
        <section>
          <span className="section-label">Orientation</span>
          <div className="seg-control">
            <button
              className={state.settings.orientation === 'portrait' ? 'on' : ''}
              onClick={() => set({ orientation: 'portrait' })}
            >
              Portrait
            </button>
            <button
              className={state.settings.orientation === 'landscape' ? 'on' : ''}
              onClick={() => set({ orientation: 'landscape' })}
            >
              Landscape
            </button>
          </div>
        </section>

        {/* Margin: icon-row slider (0..10 mm) */}
        <section>
          <span className="section-label">Margin</span>
          <div className="margin-row">
            <span className="margin-icon">&#9633;</span>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={marginVal}
              onChange={(e) => set({ margin: Number(e.target.value) })}
            />
            <span className="margin-val">{marginVal}mm</span>
          </div>
          <label className="checkbox" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={overlays} onChange={(e) => setOverlays(e.target.checked)} />
            Show cut / safe zone
          </label>
        </section>

        {/* Template: 4-column grid */}
        <section>
          <span className="section-label">Template — page {activeIdx + 1}</span>
          <div className="template-grid">
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button
                key={key}
                className={`tpl ${page.template === key ? 'on' : ''}`}
                onClick={() => { dispatch({ type: 'SET_PAGE_TEMPLATE', pageId: page.id, template: key }); setSel(null); }}
                title={t.label}
              >
                <TemplateGlyph tpl={t} />
              </button>
            ))}
          </div>
        </section>

        {/* Photo tray */}
        <section>
          <span className="section-label">Photo Tray <span className="muted" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(drag into slots)</span></span>
          <div className="tray">
            {state.imageOrder.length === 0 && <p className="muted" style={{ fontSize: 12 }}>No photos.</p>}
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
                  {img.needsReimport
                    ? <div className="tray-reimport">{state.hydrating ? '⏳' : '⟲'}</div>
                    : <img src={img.thumbUrl} alt="" />}
                </div>
              );
            })}
          </div>
        </section>
      </aside>

      <section className="layout-main">
        <div className="page-toolbar">
          <button className="btn" onClick={() => { dispatch({ type: 'ADD_PAGE', template: page.template }); goPage(state.pages.length); }}>+ Add page</button>
          <button className="btn" disabled={activeIdx === 0} onClick={() => { dispatch({ type: 'REORDER_PAGES', from: activeIdx, to: activeIdx - 1 }); goPage(activeIdx - 1); }}>&#9664; Move</button>
          <button className="btn" disabled={activeIdx === state.pages.length - 1} onClick={() => { dispatch({ type: 'REORDER_PAGES', from: activeIdx, to: activeIdx + 1 }); goPage(activeIdx + 1); }}>Move &#9654;</button>
          <button className="btn danger" onClick={() => { dispatch({ type: 'REMOVE_PAGE', pageId: page.id }); goPage(Math.max(0, activeIdx - 1)); }}>Delete page</button>
          <div className="spacer" />

          {/* Zoom: Fit | 50 | 100 | 200 button group */}
          <div className="zoom-group">
            <button className={zoom === 'fit' ? 'on' : ''} onClick={() => setZoom('fit')}>Fit</button>
            {[50, 100, 200].map((z) => (
              <button key={z} className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>{z}</button>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>Page {activeIdx + 1}/{state.pages.length}</span>
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

function TemplateGlyph({ tpl }) {
  return (
    <span className="glyph">
      {tpl.slots.map((s, i) => (
        <span key={i} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%` }} />
      ))}
    </span>
  );
}
