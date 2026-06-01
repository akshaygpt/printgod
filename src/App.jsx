import React, { useState, useEffect, useRef } from 'react';
import { useStore } from './state/store.jsx';
import { useToast } from './components/Toast.jsx';
import Toolbar from './components/Toolbar.jsx';
import LibraryGrid from './components/LibraryGrid.jsx';
import EditPanel from './components/EditPanel.jsx';
import LayoutEditor from './components/LayoutEditor.jsx';
import PrintPanel from './components/PrintPanel.jsx';
import CropModal from './components/CropModal.jsx';

const TABS = [
  { key: 'library', label: 'Library' },
  { key: 'edit', label: 'Edit' },
  { key: 'layout', label: 'Layout' },
  { key: 'print', label: 'Print' },
];

export default function App() {
  const { state } = useStore();
  const { showToast } = useToast();
  const [tab, setTab] = useState('library');
  const [cropId, setCropId] = useState(null);
  const lastSavedAt = useRef(0);

  // Toast whenever autosave completes (skip the initial mount value).
  useEffect(() => {
    if (state.savedAt && state.savedAt !== lastSavedAt.current) {
      if (lastSavedAt.current !== 0) showToast('All changes saved', { type: 'success' });
      lastSavedAt.current = state.savedAt;
    }
  }, [state.savedAt, showToast]);

  const count = state.imageOrder.length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▦</span> PrintGod
          <span className="brand-sub">photo print studio</span>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="count-pill">{count} photo{count === 1 ? '' : 's'}</div>
      </header>

      <Toolbar />

      <main className="content">
        {tab === 'library' && <LibraryGrid onCrop={setCropId} />}
        {tab === 'edit' && <EditPanel onCrop={setCropId} />}
        {tab === 'layout' && <LayoutEditor onCrop={setCropId} />}
        {tab === 'print' && <PrintPanel />}
      </main>

      {cropId && <CropModal imageId={cropId} onClose={() => setCropId(null)} />}
    </div>
  );
}
