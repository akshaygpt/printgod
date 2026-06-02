import React, { useState } from 'react';
import { useStore } from '../state/store.jsx';
import { exportFullPdf, exportDuplex } from '../lib/pdf.js';

export default function DuplexModal({ onClose }) {
  const { state } = useStore();
  const [autoDuplex, setAutoDuplex] = useState(false);
  const [binding, setBinding] = useState('long'); // 'long' | 'short'
  const [busy, setBusy] = useState(false);
  const total = state.pages.length;
  const evens = Math.floor(total / 2);
  const odds = total - evens;

  const run = async () => {
    setBusy(true);
    try {
      if (autoDuplex) await exportFullPdf(state);
      else await exportDuplex(state);
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal duplex-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3>Duplex printing</h3>
          <button className="modal-close" onClick={onClose} title="Close">&times;</button>
        </div>

        {/* Body */}
        <div className="modal-body duplex-modal">
          <div className="flip-diagram-wrap">
            {/* Two page rectangles with flip arrow between */}
            <div className="flip-pages">
              <div className="flip-page">1</div>
              <div className="flip-arrow">
                <div className="flip-arrow-icon">&#8635;</div>
                <span className="flip-arrow-label">Flip</span>
              </div>
              <div className="flip-page">2</div>
            </div>
            <p className="flip-instruction">
              {binding === 'long'
                ? 'Flip the stack left↔right (like a book) before reinserting.'
                : 'Flip the stack top↔bottom (like a notepad) before reinserting.'}
            </p>
            {/* Long edge / Short edge segmented toggle */}
            <div className="binding-seg">
              <button className={binding === 'long' ? 'on' : ''} onClick={() => setBinding('long')}>Long edge</button>
              <button className={binding === 'short' ? 'on' : ''} onClick={() => setBinding('short')}>Short edge</button>
            </div>
          </div>

          <label className="checkbox big">
            <input type="checkbox" checked={autoDuplex} onChange={(e) => setAutoDuplex(e.target.checked)} />
            My printer supports auto-duplex
          </label>

          {autoDuplex ? (
            <p className="muted" style={{ fontSize: 13 }}>
              We&rsquo;ll export a single PDF with all {total} pages. Enable double-sided in your OS print dialog and print.
            </p>
          ) : (
            <div>
              <p className="muted" style={{ fontSize: 13 }}>
                We&rsquo;ll export <strong>two PDFs</strong> &mdash; odd pages first ({odds}), then even pages ({evens}). Follow the flip diagram above.
              </p>
              <ol className="duplex-manual" style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 20, color: 'var(--muted)' }}>
                <li>Print <strong>printgod-odds.pdf</strong>.</li>
                <li>Flip the printed stack and reinsert it per the diagram.</li>
                <li>Print <strong>printgod-evens.pdf</strong>.</li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="modal-cancel" onClick={onClose} title="Cancel">&times;</button>
          <div className="spacer" />
          <button className="modal-apply" disabled={busy} onClick={run}>
            {busy ? 'Generating…' : autoDuplex ? 'Print' : 'Print'}
          </button>
        </div>
      </div>
    </div>
  );
}
