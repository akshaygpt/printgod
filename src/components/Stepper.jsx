import React from 'react';

// Horizontal stepper with numbered circles. Done steps show checkmark,
// active step shows its label after the circle, inactive steps show number only.
export default function Stepper({ steps, current, maxReachable, onSelect }) {
  return (
    <ol className="stepper">
      {steps.map((s, i) => {
        const status = i < current ? 'done' : i === current ? 'active' : 'todo';
        const reachable = i <= maxReachable;
        return (
          <li key={s.key} className={`step ${status} ${reachable ? 'reachable' : 'locked'}`}>
            {i > 0 && <span className="connector">›</span>}
            <button
              className="step-btn"
              disabled={!reachable}
              onClick={() => reachable && onSelect(i)}
              aria-current={status === 'active' ? 'step' : undefined}
            >
              <span className="step-num">{i < current ? '✓' : i + 1}</span>
              <span className="step-label">{s.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
