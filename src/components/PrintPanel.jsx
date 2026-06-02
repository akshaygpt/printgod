import React, { useEffect, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { exportFullPdf, exportSinglePage, exportTestPage } from '../lib/pdf.js';
import { pageDimsMm } from '../lib/layout.js';
import PagePreview from './PagePreview.jsx';
import DuplexModal from './DuplexModal.jsx';

const SCREEN_PPM = 96 / 25.4;

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
      <div className="print-panel-header">
        <h2>Print &amp; export</h2>
        <p>{total} sheet{total === 1 ? '' : 's'} &middot; {state.settings.paperSize} &middot; {assignedCount} photo{assignedCount === 1 ? '' : 's'}</p>
      </div>

      <div className="print-grid">
        {/* Export PDF */}
        <div className="print-card" onClick={() => !busy && guard('full', () => exportFullPdf(state))}>
          <span className="print-card-chevron">&#8250;</span>
          <div className="print-card-icon">&#9633;</div>
          <div className="print-card-title">Export PDF</div>
          <p className="print-card-desc">
            Exact paper dimensions, full-resolution images, 300 DPI target.
          </p>
          <div className="print-card-action">
            <button className="btn primary" disabled={!!busy} onClick={(e) => { e.stopPropagation(); guard('full', () => exportFullPdf(state)); }}>
              {busy === 'full' ? 'Generating…' : `Export (${total} page${total === 1 ? '' : 's'})`}
            </button>
          </div>
        </div>

        {/* Calibration sheet */}
        <div className="print-card" onClick={() => !busy && guard('test', () => exportTestPage(state))}>
          <span className="print-card-chevron">&#8250;</span>
          <div className="print-card-icon">&#9673;</div>
          <div className="print-card-title">Calibration sheet</div>
          <p className="print-card-desc">
            Color bars, grayscale ramp and a reference photo to dial in print compensation.
          </p>
          <div className="print-card-action">
            <button className="btn" disabled={!!busy} onClick={(e) => { e.stopPropagation(); guard('test', () => exportTestPage(state)); }}>
              {busy === 'test' ? 'Generating…' : 'Export calibration'}
            </button>
          </div>
        </div>

        {/* Single page */}
        <div className="print-card">
          <span className="print-card-chevron">&#8250;</span>
          <div className="print-card-icon">&#128196;</div>
          <div className="print-card-title">Single page</div>
          <p className="print-card-desc">
            Export just one page for a quick test print.
          </p>
          <div className="print-card-action">
            <div className="row">
              <input
                type="number" min={1} max={total}
                value={pageNo}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setPageNo(Math.max(1, Math.min(total, Number(e.target.value) || 1)))}
              />
              <button className="btn" disabled={!!busy} onClick={(e) => { e.stopPropagation(); guard('single', () => exportSinglePage(state, pageNo)); }}>
                {busy === 'single' ? 'Generating…' : `Export p.${pageNo}`}
              </button>
            </div>
          </div>
        </div>

        {/* Duplex */}
        <div className="print-card" onClick={() => setDuplex(true)}>
          <span className="print-card-chevron">&#8250;</span>
          <div className="print-card-icon">&#8635;</div>
          <div className="print-card-title">Duplex</div>
          <p className="print-card-desc">
            Odd/even split with a flip-and-reinsert guide for double-sided printing.
          </p>
          <div className="print-card-action">
            <button className="btn" onClick={(e) => { e.stopPropagation(); setDuplex(true); }}>
              Set up duplex&hellip;
            </button>
          </div>
        </div>

        {/* Browser print */}
        <div className="print-card" onClick={() => window.print()}>
          <span className="print-card-chevron">&#8250;</span>
          <div className="print-card-icon">&#8853;</div>
          <div className="print-card-title">Browser print</div>
          <p className="print-card-desc">
            Less precise than PDF; uses your browser&rsquo;s print dialog directly.
          </p>
          <div className="print-card-action">
            <button className="btn" onClick={(e) => { e.stopPropagation(); window.print(); }}>
              Open browser print&hellip;
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="print-card">
          <span className="print-card-chevron">&#8250;</span>
          <div className="print-card-icon">&#8801;</div>
          <div className="print-card-title">Summary</div>
          <ul className="summary">
            <li>{total} page{total === 1 ? '' : 's'}</li>
            <li>{assignedCount} photo{assignedCount === 1 ? '' : 's'} placed</li>
            <li>{state.settings.paperSize} &middot; {state.settings.orientation}</li>
            <li>Margin {state.settings.margin}mm &middot; comp +{Math.round(state.settings.printCompensation * 100)}%</li>
          </ul>
          {needsReimport && (
            <p className="warn" style={{ marginTop: 8 }}>&#9888; Some photos need re-importing.</p>
          )}
        </div>
      </div>

      {duplex && <DuplexModal onClose={() => setDuplex(false)} />}

      {/* Hidden layer for window.print() */}
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
