import React, { useEffect, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { exportFullPdf, exportSinglePage, exportTestPage } from '../lib/pdf.js';
import { pageDimsMm } from '../lib/layout.js';
import PagePreview from './PagePreview.jsx';
import DuplexModal from './DuplexModal.jsx';

const SCREEN_PPM = 96 / 25.4; // ~96dpi for the print-fallback layer

export default function PrintPanel() {
  const { state } = useStore();
  const [busy, setBusy] = useState(null);
  const [pageNo, setPageNo] = useState(1);
  const [duplex, setDuplex] = useState(false);
  const total = state.pages.length;
  const dims = pageDimsMm(state.settings);

  const assignedCount = state.pages.reduce(
    (n, p) => n + p.slots.filter((s) => s.imageId && state.images[s.imageId] && !state.images[s.imageId].needsReimport).length,
    0
  );
  const needsReimport = state.imageOrder.some((id) => state.images[id] && state.images[id].needsReimport);

  // Keep the @page size in sync with the chosen paper for window.print().
  useEffect(() => {
    let el = document.getElementById('print-page-rule');
    if (!el) {
      el = document.createElement('style');
      el.id = 'print-page-rule';
      document.head.appendChild(el);
    }
    el.textContent = `@page { size: ${dims.w}mm ${dims.h}mm; margin: 0; }`;
  }, [dims.w, dims.h]);

  const guard = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (e) { alert('Export failed: ' + (e.message || e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="print-panel">
      <div className="print-grid">
        <Card title="Print-ready PDF" badge="Recommended">
          <p>Exact paper dimensions, full-resolution images embedded, 300 DPI target. Download, then print from your OS dialog for reliable sizing.</p>
          <button className="btn primary" disabled={busy} onClick={() => guard('full', () => exportFullPdf(state))}>
            {busy === 'full' ? 'Generating…' : `Export PDF (${total} page${total === 1 ? '' : 's'})`}
          </button>
        </Card>

        <Card title="Calibration / test sheet">
          <p>One sheet with color bars, a grayscale ramp, registration marks and a reference photo. Print this first to dial in color and the print-compensation slider.</p>
          <button className="btn" disabled={busy} onClick={() => guard('test', () => exportTestPage(state))}>
            {busy === 'test' ? 'Generating…' : 'Export calibration sheet'}
          </button>
        </Card>

        <Card title="Print a single page">
          <p>Export just one page — handy for test prints before committing to the full run.</p>
          <div className="row">
            <input type="number" min={1} max={total} value={pageNo} onChange={(e) => setPageNo(Math.max(1, Math.min(total, Number(e.target.value) || 1)))} />
            <button className="btn" disabled={busy} onClick={() => guard('single', () => exportSinglePage(state, pageNo))}>
              {busy === 'single' ? 'Generating…' : `Export page ${pageNo}`}
            </button>
          </div>
        </Card>

        <Card title="Double-sided (duplex)">
          <p>We detect odd/even pages and walk you through auto-duplex or a manual flip-and-reinsert flow with a binding diagram.</p>
          <button className="btn" onClick={() => setDuplex(true)}>Set up duplex export…</button>
        </Card>

        <Card title="Browser print (fallback)">
          <p>Less precise than PDF, but uses your browser’s print dialog directly with a one-page-per-sheet stylesheet.</p>
          <button className="btn" onClick={() => window.print()}>Open browser print…</button>
        </Card>

        <Card title="Summary">
          <ul className="summary">
            <li>{total} page{total === 1 ? '' : 's'}</li>
            <li>{assignedCount} photo{assignedCount === 1 ? '' : 's'} placed</li>
            <li>{state.settings.paperSize} · {state.settings.orientation}</li>
            <li>Margin {state.settings.margin}mm · comp +{Math.round(state.settings.printCompensation * 100)}%</li>
          </ul>
          {needsReimport && <p className="warn">⚠ Some photos need re-importing — they’ll be skipped in exports until restored.</p>}
        </Card>
      </div>

      {duplex && <DuplexModal onClose={() => setDuplex(false)} />}

      {/* Hidden layer used only by window.print(). */}
      <div className="print-layer" aria-hidden>
        {state.pages.map((p) => (
          <div className="print-sheet" key={p.id} style={{ width: `${dims.w}mm`, height: `${dims.h}mm` }}>
            <PagePreview page={p} maxW={dims.w * SCREEN_PPM} maxH={dims.h * SCREEN_PPM} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, badge, children }) {
  return (
    <div className="print-card">
      <div className="print-card-head">
        <h4>{title}</h4>
        {badge && <span className="badge">{badge}</span>}
      </div>
      {children}
    </div>
  );
}
