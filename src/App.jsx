import React, { useState, useEffect, useRef } from 'react';
import { useStore } from './state/store.jsx';
import { useToast } from './components/Toast.jsx';
import { useImporter } from './components/useImporter.jsx';
import { clearState } from './lib/storage.js';
import { clearAll as clearImageStore } from './lib/imageStore.js';
import Stepper from './components/Stepper.jsx';
import LibraryGrid from './components/LibraryGrid.jsx';
import EditPanel from './components/EditPanel.jsx';
import LayoutEditor from './components/LayoutEditor.jsx';
import PrintPanel from './components/PrintPanel.jsx';
import CropModal from './components/CropModal.jsx';

const STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'edit', label: 'Edit' },
  { key: 'layout', label: 'Layout' },
  { key: 'print', label: 'Print' },
];

export default function App() {
  const { state, dispatch } = useStore();
  const { showToast } = useToast();
  const { progress } = useImporter();
  const [step, setStep] = useState(0);
  const [cropId, setCropId] = useState(null);
  const lastSavedAt = useRef(0);

  const hasPhotos = state.imageOrder.length > 0;
  const maxReachable = hasPhotos ? STEPS.length - 1 : 0;

  // Clamp the step if photos were removed and later steps became unreachable.
  useEffect(() => {
    if (step > maxReachable) setStep(maxReachable);
  }, [maxReachable, step]);

  // Toast whenever autosave completes (skip the initial mount value).
  useEffect(() => {
    if (state.savedAt && state.savedAt !== lastSavedAt.current) {
      if (lastSavedAt.current !== 0) showToast('All changes saved', { type: 'success' });
      lastSavedAt.current = state.savedAt;
    }
  }, [state.savedAt, showToast]);

  const canUndo = state.history.past.length > 0;
  const canRedo = state.history.future.length > 0;

  const reset = () => {
    if (!confirm('Reset everything? This clears all photos, edits, layouts and saved state.')) return;
    clearState();
    clearImageStore();
    dispatch({ type: 'RESET' });
    setStep(0);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▦</span>
          <span className="brand-text">
            PrintGod
            <span className="brand-sub">Print Photos Easy.</span>
          </span>
        </div>

        <Stepper steps={STEPS} current={step} maxReachable={maxReachable} onSelect={setStep} />

        <div className="head-actions">
          {progress && <span className="progress">Importing {progress.done}/{progress.total}…</span>}
          <span className={`save-status ${state.saveStatus}`} title="Edits autosave to this browser">
            {state.saveStatus === 'saving' ? '⟳' : state.saveStatus === 'saved' ? '✓' : '•'}
          </span>
          <button className="icon-btn" disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>
          <button className="icon-btn" disabled={!canRedo} onClick={() => dispatch({ type: 'REDO' })} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷</button>
          <button className="icon-btn danger" onClick={reset} title="Reset everything" aria-label="Reset">⟳</button>
        </div>
      </header>

      <main className="content">
        {step === 0 && <LibraryGrid onCrop={setCropId} />}
        {step === 1 && <EditPanel onCrop={setCropId} />}
        {step === 2 && <LayoutEditor onCrop={setCropId} />}
        {step === 3 && <PrintPanel />}
      </main>

      <footer className="flow-footer">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ← Back
        </button>
        <span className="flow-hint">{hintFor(step, hasPhotos, state)}</span>
        {step < STEPS.length - 1 ? (
          <button
            className="btn primary"
            disabled={step === 0 && !hasPhotos}
            onClick={() => setStep(step + 1)}
          >
            Next: {STEPS[step + 1].label} →
          </button>
        ) : (
          <span className="footer-end muted">Export below ↑</span>
        )}
      </footer>

      {cropId && <CropModal imageId={cropId} onClose={() => setCropId(null)} />}
    </div>
  );
}

function hintFor(step, hasPhotos, state) {
  if (step === 0) return hasPhotos ? `${state.imageOrder.length} photo${state.imageOrder.length === 1 ? '' : 's'} ready` : 'Add photos to begin';
  if (step === 1) return 'Adjust your photos — bulk or one at a time';
  if (step === 2) return 'Arrange photos on pages';
  return 'Generate your print-ready PDF';
}
