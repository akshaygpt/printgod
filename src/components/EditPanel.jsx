import React from 'react';
import { useStore } from '../state/store.jsx';
import { FILTER_CONTROLS, FILTER_TOGGLES } from '../state/constants.js';
import { buildFilterCss, overlayBackgrounds } from '../lib/filters.js';

export default function EditPanel({ onCrop }) {
  const { state, dispatch } = useStore();
  const solo = state.soloId && state.images[state.soloId] ? state.soloId : null;
  const targets = solo ? [solo] : state.selectedIds;
  const primary = targets[0] ? state.images[targets[0]] : null;
  const comp = state.settings.printCompensation;

  const setFilter = (key, value) =>
    dispatch({ type: 'UPDATE_FILTER', key, value, targets });
  const toggle = (key) => dispatch({ type: 'TOGGLE_FILTER', key, targets });

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
              <button className="link" onClick={() => dispatch({ type: 'SET_SOLO', id: null })}>
                exit solo → bulk
              </button>
            </>
          ) : targets.length ? (
            <><strong>Bulk edit</strong> — {targets.length} selected</>
          ) : (
            <span className="muted">Select photos in Library, or pick one to solo-edit.</span>
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

          {solo && (
            <button className="btn" style={{ marginTop: 12 }} onClick={() => onCrop(solo)}>
              Crop this photo…
            </button>
          )}
        </fieldset>
      </aside>

      <section className="edit-preview">
        {primary ? (
          <div className="preview-stage">
            <div className="preview-frame">
              <img
                src={primary.thumbUrl}
                alt=""
                style={{ filter: buildFilterCss(primary.filters, comp) }}
              />
              {overlayBackgrounds(primary.filters).length > 0 && (
                <div className="tile-overlay" style={{ background: overlayBackgrounds(primary.filters).join(', ') }} />
              )}
              {primary.filters.grain > 0 && (
                <div className="tile-grain" style={{ opacity: (primary.filters.grain / 100) * 0.4 }} />
              )}
            </div>
            <small className="muted">Preview includes +{Math.round(comp * 100)}% print compensation.</small>
          </div>
        ) : (
          <div className="panel-empty">No photo selected.</div>
        )}
      </section>
    </div>
  );
}
