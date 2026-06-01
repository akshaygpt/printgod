import React from 'react';

// Horizontal progress stepper for the Upload → Edit → Layout → Print flow.
// Steps up to `maxReachable` are clickable; the rest are locked until photos
// exist.
export default function Stepper({ steps, current, maxReachable, onSelect }) {
  return (
    <ol className="stepper">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        const reachable = i <= maxReachable;
        return (
          <li key={s.key} className={`step ${state} ${reachable ? 'reachable' : 'locked'}`}>
            {i > 0 && <span className={`connector ${i <= current ? 'filled' : ''}`} />}
            <button
              className="step-btn"
              disabled={!reachable}
              onClick={() => reachable && onSelect(i)}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className="step-dot">{i < current ? '✓' : i + 1}</span>
              <span className="step-label">{s.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
