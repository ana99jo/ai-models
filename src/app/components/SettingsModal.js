'use client';

import { useState, useEffect } from 'react';
import { LS_API_KEY, LS_API_SECRET } from '../lib/config';

/**
 * SettingsModal
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   onSave: (key, secret) => void
 *   addToast: (msg, type) => void
 */
export default function SettingsModal({ open, onClose, onSave, addToast }) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [testing, setTesting] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    if (open) {
      const k = localStorage.getItem(LS_API_KEY) || '';
      const s = localStorage.getItem(LS_API_SECRET) || '';
      setApiKey(k);
      setApiSecret(s);
      setHasExisting(!!(k && s));
    }
  }, [open]);

  function handleSave() {
    if (!apiKey.trim() || !apiSecret.trim()) {
      addToast('Please enter both API Key and API Secret.', 'error');
      return;
    }
    localStorage.setItem(LS_API_KEY, apiKey.trim());
    localStorage.setItem(LS_API_SECRET, apiSecret.trim());
    onSave(apiKey.trim(), apiSecret.trim());
    addToast('API credentials saved!', 'success');
    onClose();
  }

  async function handleTest() {
    if (!apiKey.trim() || !apiSecret.trim()) {
      addToast('Enter both fields before testing.', 'error');
      return;
    }
    setTesting(true);
    try {
      // Save temporarily to allow server-side auth
      const prev = {
        key: localStorage.getItem(LS_API_KEY),
        secret: localStorage.getItem(LS_API_SECRET),
      };
      localStorage.setItem(LS_API_KEY, apiKey.trim());
      localStorage.setItem(LS_API_SECRET, apiSecret.trim());

      // Use a lightweight request — attempt a GET to a known status endpoint
      // that returns 401 on bad creds and any other status on valid creds
      const res = await fetch('/api/status/test-connection-probe');
      // 404 from Higgsfield means credentials were accepted (request not found)
      // 401 means bad creds
      if (res.status === 401) {
        addToast('Invalid credentials. Please check your API Key and Secret.', 'error');
        // Restore previous
        localStorage.setItem(LS_API_KEY, prev.key || '');
        localStorage.setItem(LS_API_SECRET, prev.secret || '');
      } else {
        addToast('Credentials look valid! ✓', 'success');
      }
    } catch {
      addToast('Network error during test.', 'error');
    } finally {
      setTesting(false);
    }
  }

  function handleClear() {
    localStorage.removeItem(LS_API_KEY);
    localStorage.removeItem(LS_API_SECRET);
    setApiKey('');
    setApiSecret('');
    setHasExisting(false);
    onSave('', '');
    addToast('API credentials cleared.', 'info');
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="API Settings"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">API Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-xl leading-none"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Intro */}
        <p className="text-sm text-gray-400">
          Enter your Higgsfield credentials.{' '}
          <a
            href="https://cloud.higgsfield.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline transition"
          >
            Get your API key here →
          </a>
        </p>

        {/* Fields */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API Key"
              className="w-full bg-gray-800 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              API Key Secret
            </label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Enter your API Key Secret"
              className="w-full bg-gray-800 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Security note */}
        <p className="text-xs text-gray-500">
          🔒 Keys are stored in your browser&apos;s localStorage. Never share your credentials.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex-1 rounded-lg border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white text-sm py-2.5 transition disabled:opacity-50"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-2.5 transition"
            >
              Save
            </button>
          </div>

          {hasExisting && (
            <button
              onClick={handleClear}
              className="w-full rounded-lg text-red-400 hover:text-red-300 text-sm py-2 transition"
            >
              Clear saved credentials
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
