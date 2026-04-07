'use client';

import { useEffect } from 'react';

const ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const COLORS = {
  success: 'border-green-500/40 bg-green-900/30 text-green-300',
  error: 'border-red-500/40 bg-red-900/30 text-red-300',
  info: 'border-indigo-500/40 bg-indigo-900/30 text-indigo-300',
  warning: 'border-yellow-500/40 bg-yellow-900/30 text-yellow-300',
};

/**
 * Single toast item.
 * Props: { id, message, type, onDismiss }
 */
function ToastItem({ id, message, type = 'info', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), 5000);
    return () => clearTimeout(t);
  }, [id, onDismiss]);

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 min-w-72 max-w-sm w-full rounded-xl border px-4 py-3 shadow-lg text-sm animate-fade-in ${COLORS[type] ?? COLORS.info}`}
    >
      <span className="text-base leading-none mt-0.5 shrink-0">{ICONS[type]}</span>
      <span className="flex-1">{message}</span>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition text-base leading-none"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Toast container — renders in fixed bottom-right corner.
 * Props: { toasts: Array<{ id, message, type }>, onDismiss: (id) => void }
 */
export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
