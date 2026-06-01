import React, { useRef } from 'react';
import { useStore } from '../state/store.jsx';
import { useImporter } from './useImporter.jsx';
import { clearState } from '../lib/storage.js';

export default function Toolbar() {
  const { state, dispatch } = useStore();
  const { run, progress, errors } = useImporter();
  const fileRef = useRef(null);

  const canUndo = state.history.past.length > 0;
  const canRedo = state.history.future.length > 0;
  const selCount = state.selectedIds.length;

  const onPick = (e) => {
    run(e.target.files);
    e.target.value = '';
  };

  const startFresh = () => {
    if (!confirm('Start fresh? This clears all photos, edits, layouts and saved state.')) return;
    clearState();
    dispatch({ type: 'RESET' });
  };

  return (
    <div className="toolbar">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={onPick}
      />
      <button className="btn primary" onClick={() => fileRef.current.click()}>
        + Import photos
      </button>

      <div className="divider" />

      <button className="btn" disabled={!state.imageOrder.length} onClick={() => dispatch({ type: 'SELECT_ALL' })}>
        Select all
      </button>
      <button className="btn" disabled={!selCount} onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}>
        Clear ({selCount})
      </button>

      <div className="divider" />

      <button className="btn" disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })} title="Ctrl+Z">
        ↶ Undo
      </button>
      <button className="btn" disabled={!canRedo} onClick={() => dispatch({ type: 'REDO' })} title="Ctrl+Shift+Z">
        ↷ Redo
      </button>

      <div className="spacer" />

      {progress && (
        <div className="progress">
          Importing {progress.done}/{progress.total}…
        </div>
      )}
      {!progress && errors.length > 0 && (
        <div className="errors" title={errors.join('\n')}>
          ⚠ {errors.length} failed
        </div>
      )}

      <div className={`save-status ${state.saveStatus}`} title="Edits autosave to this browser">
        {state.saveStatus === 'saving' ? '⟳ Saving…' : state.saveStatus === 'saved' ? '✓ Saved' : '• Autosave on'}
      </div>

      <button className="btn danger" onClick={startFresh}>
        Start fresh
      </button>
    </div>
  );
}
