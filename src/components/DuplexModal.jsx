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
        <header className="modal-head">
          <h3>Double-sided printing</h3>
          <span className="muted">{total} pages · {odds} odd, {evens} even</span>
        </header>

        <label className="checkbox big">
          <input type="checkbox" checked={autoDuplex} onChange={(e) => setAutoDuplex(e.target.checked)} />
          My printer supports auto-duplex
        </label>

        {autoDuplex ? (
          <p className="muted">
            We’ll export a single PDF with all {total} pages. Enable double-sided in your OS print dialog and print.
          </p>
        ) : (
          <div className="duplex-manual">
            <p>We’ll export <strong>two PDFs</strong> — odd pages first, then even pages. Follow these steps:</p>
            <ol>
              <li>Print <strong>printgod-odds.pdf</strong>.</li>
              <li>Flip the printed stack and reinsert it (see diagram).</li>
              <li>Print <strong>printgod-evens.pdf</strong>.</li>
            </ol>

            <div className="binding-pick">
              <button className={binding === 'long' ? 'on' : ''} onClick={() => setBinding('long')}>Long-edge binding</button>
              <button className={binding === 'short' ? 'on' : ''} onClick={() => setBinding('short')}>Short-edge binding</button>
            </div>

            <FlipDiagram binding={binding} />
          </div>
        )}

        <footer className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <div className="spacer" />
          <button className="btn primary" disabled={busy} onClick={run}>
            {busy ? 'Generating…' : autoDuplex ? 'Export single PDF' : 'Export two PDFs'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function FlipDiagram({ binding }) {
  // Simple SVG showing how to flip the stack for the chosen binding.
  return (
    <div className="flip-diagram">
      <svg viewBox="0 0 220 120" width="220" height="120">
        <rect x="10" y="20" width="60" height="80" rx="4" fill="#e9eef5" stroke="#9bb0c9" />
        <text x="40" y="64" textAnchor="middle" fontSize="10" fill="#3a4a5e">odds</text>
        <path d="M90 60 h40" stroke="#3a4a5e" strokeWidth="2" markerEnd="url(#arr)" />
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#3a4a5e" />
          </marker>
        </defs>
        <g transform="translate(150,20)">
          <rect x="0" y="0" width="60" height="80" rx="4" fill="#fff4e0" stroke="#d9a441" />
          {binding === 'long' ? (
            <path d="M30 8 a 22 40 0 0 1 0 64" fill="none" stroke="#d9a441" strokeWidth="2" strokeDasharray="4 3" />
          ) : (
            <path d="M8 40 a 40 22 0 0 0 44 0" fill="none" stroke="#d9a441" strokeWidth="2" strokeDasharray="4 3" />
          )}
          <text x="30" y="98" textAnchor="middle" fontSize="9" fill="#7a5a14">
            flip {binding === 'long' ? 'left↔right' : 'top↔bottom'}
          </text>
        </g>
      </svg>
      <p className="muted">
        {binding === 'long'
          ? 'Long-edge: flip the stack left-to-right (like a book) before reinserting.'
          : 'Short-edge: flip the stack top-to-bottom (like a notepad) before reinserting.'}
      </p>
    </div>
  );
}
