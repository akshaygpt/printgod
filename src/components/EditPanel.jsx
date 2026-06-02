import React from 'react';
import { useStore } from '../state/store.jsx';
import { FILTER_CONTROLS, FILTER_TOGGLES } from '../state/constants.js';
import { buildFilterCss, overlayBackgrounds } from '../lib/filters.js';

export default function EditPanel({ onCrop }) {
  const { state, dispatch } = useStore();
  const solo = state.soloId && state.images[state.soloId] ? state.soloId : null;
  // The photo shown in the preview: the solo pick, else the first selected,
  // else the first imported.
  const primaryId = solo || state.selectedIds[0] || state.imageOrder[0] || null;
  const primary = primaryId ? state.images[primaryId] : null;
  // Edits apply to the solo photo, the multi-selection, or the single shown photo.
  const targets = solo ? [solo] : state.selectedIds.length ? state.selectedIds : primaryId ? [primaryId] : [];
  const comp = state.settings.printCompensation;

  const setFilter = (key, value) => dispatch({ type: 'UPDATE_FILTER', key, value, targets });
  const toggle = (key) => dispatch({ type: 'TOGGLE_FILTER', key, targets });

  // Navigate through the library; navigating focuses a single photo (solo).
  const idx = primaryId ? state.imageOrder.indexOf(primaryId) : -1;
  const go = (delta) => {
    const next = state.imageOrder[idx + delta];
    if (next) dispatch({ type: 'SET_SOLO', id: next });
  };

  if (!state.imageOrder.length) {
    return <div className="panel-empty">Import photos first, then edit them here.</div>;
  }

  // Group controls by section
  const toneControls = FILTER_CONTROLS.filter((c) => c.section === 'tone');
  const textureControls = FILTER_CONTROLS.filter((c) => c.section === 'texture');

  return (
    <div className="edit-panel">
      <aside className="edit-controls">
        {/* Panel header */}
        <div className="edit-controls-header">
          <h3>Adjust</h3>
          <button
            className="head-icon-btn"
            title="Browse photos"
            onClick={() => {}}
          >
            &#9707;
          </button>
          <button
            className="head-icon-btn"
            title="Reset all filters"
            onClick={() => dispatch({ type: 'RESET_FILTERS', targets })}
          >
            &#8635;
          </button>
        </div>

        {/* Scope indicator */}
        <div className="scope-banner">
          {solo ? (
            <>
              <strong>Solo</strong> &mdash; {state.images[solo].name}
              {state.selectedIds.length > 0 && (
                <button className="link" style={{ marginLeft: 8 }} onClick={() => dispatch({ type: 'SET_SOLO', id: null })}>
                  exit solo ({state.selectedIds.length} sel)
                </button>
              )}
            </>
          ) : state.selectedIds.length ? (
            <><strong>Bulk</strong> &mdash; {state.selectedIds.length} selected</>
          ) : primary ? (
            <><strong>Editing</strong> &mdash; {primary.name}</>
          ) : (
            <span className="muted">Add photos first.</span>
          )}
        </div>

        <fieldset disabled={!targets.length} style={{ border: 'none', padding: 0, margin: 0 }}>
          {/* TONE section */}
          <span className="section-label">Tone</span>
          {toneControls.map((c) => (
            <div className="icon-row" key={c.key}>
              <span className="icon-row-icon" title={c.label}>{c.icon}</span>
              <input
                type="range"
                min={c.min}
                max={c.max}
                value={primary ? primary.filters[c.key] : 0}
                onChange={(e) => setFilter(c.key, Number(e.target.value))}
              />
              <span className="icon-row-val">{primary ? primary.filters[c.key] : 0}</span>
            </div>
          ))}

          {/* TEXTURE section */}
          <span className="section-label">Texture</span>
          {textureControls.map((c) => (
            <div className="icon-row" key={c.key}>
              <span className="icon-row-icon" title={c.label}>{c.icon}</span>
              <input
                type="range"
                min={c.min}
                max={c.max}
                value={primary ? primary.filters[c.key] : 0}
                onChange={(e) => setFilter(c.key, Number(e.target.value))}
              />
              <span className="icon-row-val">{primary ? primary.filters[c.key] : 0}</span>
            </div>
          ))}

          {/* B&W / Sepia toggle pills */}
          <div className="toggles">
            {FILTER_TOGGLES.map((t) => (
              <button
                key={t.key}
                className={`toggle ${primary && primary.filters[t.key] ? 'on' : ''}`}
                onClick={() => toggle(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Crop button */}
          {primary && !primary.needsReimport && (
            <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={() => onCrop(primaryId)}>
              &#9986; Crop &ldquo;{primary.name.length > 18 ? primary.name.slice(0, 17) + '…' : primary.name}&rdquo;
            </button>
          )}
        </fieldset>

        {/* Print compensation inset box */}
        <div className="compensation">
          <div className="compensation-header">
            <span className="info" title="Glossy prints render darker than screens.">&#9432;</span>
            <span>Print compensation</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              +{Math.round(comp * 100)}%
            </span>
          </div>
          <div className="icon-row">
            <span className="icon-row-icon" />
            <input
              type="range"
              min="0"
              max="40"
              value={Math.round(comp * 100)}
              onChange={(e) => dispatch({ type: 'SET_SETTINGS', settings: { printCompensation: Number(e.target.value) / 100 } })}
            />
            <span className="icon-row-val">+{Math.round(comp * 100)}</span>
          </div>
        </div>
      </aside>

      <section className="edit-preview">
        {primary ? (
          <>
            {/* Filename + dimensions badge */}
            <div className="preview-badge">
              <span className="muted">{primary.name} &middot; {primary.w}&times;{primary.h}</span>
            </div>

            {/* Large preview with overlaid nav arrows */}
            <div className="preview-image-area">
              <button
                className="preview-nav-btn prev"
                disabled={idx <= 0}
                onClick={() => go(-1)}
                title="Previous photo"
              >
                &#8249;
              </button>

              <div className="preview-frame">
                {primary.needsReimport ? (
                  <div className="reimport" style={{ padding: 40 }}>
                    {state.hydrating ? 'Restoring photo…' : 'Re-import this photo to preview & edit it.'}
                  </div>
                ) : (
                  <>
                    <img src={primary.thumbUrl} alt="" style={{ filter: buildFilterCss(primary.filters, comp) }} />
                    {overlayBackgrounds(primary.filters).length > 0 && (
                      <div className="tile-overlay" style={{ background: overlayBackgrounds(primary.filters).join(', ') }} />
                    )}
                    {primary.filters.grain > 0 && (
                      <div className="tile-grain" style={{ opacity: (primary.filters.grain / 100) * 0.4 }} />
                    )}
                  </>
                )}
              </div>

              <button
                className="preview-nav-btn next"
                disabled={idx < 0 || idx >= state.imageOrder.length - 1}
                onClick={() => go(1)}
                title="Next photo"
              >
                &#8250;
              </button>
            </div>

            {/* Filmstrip bar */}
            <div className="filmstrip-bar">
              <button
                className="filmstrip-nav"
                disabled={idx <= 0}
                onClick={() => go(-1)}
                title="Previous"
              >
                &#8249;
              </button>
              <div className="filmstrip-scroll">
                {state.imageOrder.map((id) => {
                  const img = state.images[id];
                  const isFocus = id === primaryId;
                  const isSelected = state.selectedIds.includes(id);
                  return (
                    <button
                      key={id}
                      className={`film-item ${isFocus ? 'focus' : ''} ${isSelected ? 'sel' : ''}`}
                      onClick={() => dispatch({ type: 'SET_SOLO', id })}
                      title={img.name}
                    >
                      {img.needsReimport ? (
                        <span className="film-reimport">&#8634;</span>
                      ) : (
                        <img src={img.thumbUrl} alt="" style={{ filter: buildFilterCss(img.filters, 0) }} />
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                className="filmstrip-nav"
                disabled={idx < 0 || idx >= state.imageOrder.length - 1}
                onClick={() => go(1)}
                title="Next"
              >
                &#8250;
              </button>
              <span className="filmstrip-count">{idx + 1}/{state.imageOrder.length}</span>
            </div>
          </>
        ) : (
          <div className="panel-empty">No photo selected.</div>
        )}
      </section>
    </div>
  );
}
