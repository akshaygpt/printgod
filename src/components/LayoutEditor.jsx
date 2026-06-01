import React, { useState } from 'react';
import { useStore } from '../state/store.jsx';
import { PAPER_SIZES, MARGIN_OPTIONS, TEMPLATES } from '../state/constants.js';
import PagePreview from './PagePreview.jsx';

export default function LayoutEditor({ onCrop }) {
  const { state, dispatch } = useStore();
  const [active, setActive] = useState(0);
  const [overlays, setOverlays] = useState(true);

  const activeIdx = Math.min(active, state.pages.length - 1);
  const page = state.pages[activeIdx];
  const set = (settings) => dispatch({ type: 'SET_SETTINGS', settings });

  return (
    <div className="layout-editor">
      <aside className="layout-side">
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
                onClick={() => dispatch({ type: 'SET_PAGE_TEMPLATE', pageId: page.id, template: key })}
                title={t.label}
              >
                <TemplateGlyph tpl={t} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
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
                  {img.needsReimport ? <div className="tray-reimport">⟲</div> : <img src={img.thumbUrl} alt="" />}
                </div>
              );
            })}
          </div>
        </section>
      </aside>

      <section className="layout-main">
        <div className="page-toolbar">
          <button className="btn" onClick={() => { dispatch({ type: 'ADD_PAGE', template: page.template }); setActive(state.pages.length); }}>+ Add page</button>
          <button className="btn" disabled={activeIdx === 0} onClick={() => { dispatch({ type: 'REORDER_PAGES', from: activeIdx, to: activeIdx - 1 }); setActive(activeIdx - 1); }}>◀ Move</button>
          <button className="btn" disabled={activeIdx === state.pages.length - 1} onClick={() => { dispatch({ type: 'REORDER_PAGES', from: activeIdx, to: activeIdx + 1 }); setActive(activeIdx + 1); }}>Move ▶</button>
          <button className="btn danger" onClick={() => { dispatch({ type: 'REMOVE_PAGE', pageId: page.id }); setActive(Math.max(0, activeIdx - 1)); }}>Delete page</button>
          <div className="spacer" />
          <span className="muted">Page {activeIdx + 1} / {state.pages.length}</span>
        </div>

        <div className="stage">
          <PagePreview page={page} maxW={560} maxH={680} interactive showOverlays={overlays} onCrop={onCrop} />
        </div>

        <div className="page-strip">
          {state.pages.map((p, i) => (
            <div key={p.id} className={`strip-page ${i === activeIdx ? 'on' : ''}`} onClick={() => setActive(i)}>
              <PagePreview page={p} maxW={84} maxH={110} />
              <span>{i + 1}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
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
