import React from 'react';
import { useStore } from '../state/store.jsx';
import { FILTER_CONTROLS, FILTER_TOGGLES } from '../state/constants.js';
import { buildFilterCss, overlayBackgrounds } from '../lib/filters.js';

export default function EditPanel({ onCrop }) {
  const { state, dispatch } = useStore();
  const solo = state.soloId && state.images[state.soloId] ? state.soloId : null;
  // The photo shown in the preview: the solo pick, else the first selected,
  // else the first imported. This is what the filmstrip / arrows navigate.
  const primaryId = solo || state.selectedIds[0] || state.imageOrder[0] || null;
  const primary = primaryId ? state.images[primaryId] : null;
  // Edits apply to the solo photo, the multi-selection, or — with neither — the
  // single photo currently shown, so the screen is usable straight away.
  const targets = solo ? [solo] : state.selectedIds.length ? state.selectedIds : primaryId ? [primaryId] : [];
  const comp = state.settings.printCompensation;

  const setFilter = (key, value) => dispatch({ type: 'UPDATE_FILTER', key, value, targets });
  const toggle = (key) => dispatch({ type: 'TOGGLE_FILTER', key, targets });

  // Step the focused photo through the library; navigating focuses a single
  // photo (solo) so edits land on the one you're looking at.
  const idx = primaryId ? state.imageOrder.indexOf(primaryId) : -1;
  const go = (delta) => {
    const next = state.imageOrder[idx + delta];
    if (next) dispatch({ type: 'SET_SOLO', id: next });
  };

  if (!state.imageOrder.length) {
    return <div className="panel-empty">Import photos first, then edit them here.</div>;
  }

  return (
    <div className="edit-panel">
      <aside className="edit-controls">
        <div className="scope-banner">
          {solo ? (
            <>
              <strong>Solo edit</strong> — {state.images[solo].name}
              {state.selectedIds.length > 0 && (
                <button className="link" onClick={() => dispatch({ type: 'SET_SOLO', id: null })}>
                  exit solo → bulk ({state.selectedIds.length})
                </button>
              )}
            </>
          ) : state.selectedIds.length ? (
            <><strong>Bulk edit</strong> — {state.selectedIds.length} selected</>
          ) : primary ? (
            <><strong>Editing</strong> — {primary.name}</>
          ) : (
            <span className="muted">Add photos first.</span>
          )}
        </div>

        <div className="control compensation">
          <label>
            Print compensation
            <span className="info" title="Glossy prints render darker than screens.">ⓘ</span>
            <span className="val">+{Math.round(comp * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="40"
            value={Math.round(comp * 100)}
            onChange={(e) => dispatch({ type: 'SET_SETTINGS', settings: { printCompensation: Number(e.target.value) / 100 } })}
          />
          <small className="muted">Global brightness boost applied to every photo at export.</small>
        </div>

        <fieldset disabled={!targets.length}>
          {FILTER_CONTROLS.map((c) => (
            <div className="control" key={c.key}>
              <label>
                {c.label}
                <span className="val">{primary ? primary.filters[c.key] : 0}</span>
              </label>
              <input
                type="range"
                min={c.min}
                max={c.max}
                value={primary ? primary.filters[c.key] : 0}
                onChange={(e) => setFilter(c.key, Number(e.target.value))}
              />
            </div>
          ))}

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
            <button className="toggle" onClick={() => dispatch({ type: 'RESET_FILTERS', targets })}>
              Reset
            </button>
          </div>

          {primary && !primary.needsReimport && (
            <button className="btn" style={{ marginTop: 12 }} onClick={() => onCrop(primaryId)}>
              Crop “{primary.name.length > 18 ? primary.name.slice(0, 17) + '…' : primary.name}”…
            </button>
          )}
        </fieldset>
      </aside>

      <section className="edit-preview">
        {primary ? (
          <div className="preview-stage">
            <div className="preview-nav">
              <button className="navbtn" disabled={idx <= 0} onClick={() => go(-1)} title="Previous photo">‹</button>
              <span className="preview-pos">
                {idx + 1} / {state.imageOrder.length} · <span className="muted">{primary.name}</span>
              </span>
              <button className="navbtn" disabled={idx < 0 || idx >= state.imageOrder.length - 1} onClick={() => go(1)} title="Next photo">›</button>
            </div>

            <div className="preview-frame">
              {primary.needsReimport ? (
                <div className="reimport" style={{ padding: 40 }}>{state.hydrating ? 'Restoring photo…' : 'Re-import this photo to preview & edit it.'}</div>
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
            <small className="muted">Preview includes +{Math.round(comp * 100)}% print compensation.</small>

            <div className="edit-filmstrip">
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
                      <span className="film-reimport">⟲</span>
                    ) : (
                      <img src={img.thumbUrl} alt="" style={{ filter: buildFilterCss(img.filters, 0) }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="panel-empty">No photo selected.</div>
        )}
      </section>
    </div>
  );
}
