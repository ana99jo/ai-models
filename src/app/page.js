'use client';

import { useState, useEffect, useCallback } from 'react';
import SettingsModal from './components/SettingsModal';
import ToastContainer from './components/Toast';
import ImageTab from './components/ImageTab';
import VideoTab from './components/VideoTab';
import { LS_API_KEY, LS_API_SECRET, LS_HISTORY, MAX_HISTORY } from './lib/config';

let toastId = 0;

export default function Home() {
  const [activeTab, setActiveTab] = useState('image'); // 'image' | 'video'
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [imageForVideo, setImageForVideo] = useState(null); // URL from image tab → video tab
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Check for stored keys on mount
  useEffect(() => {
    const k = localStorage.getItem(LS_API_KEY);
    const s = localStorage.getItem(LS_API_SECRET);
    setHasKeys(!!(k && s));

    // Load history
    try {
      const raw = localStorage.getItem(LS_HISTORY);
      setHistory(raw ? JSON.parse(raw) : []);
    } catch { /* ignore */ }
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  function handleCredentialsSaved(key, secret) {
    setHasKeys(!!(key && secret));
  }

  function handleImageReady(url) {
    setImageForVideo(url);
    setActiveTab('video');
  }

  function clearHistory() {
    localStorage.removeItem(LS_HISTORY);
    setHistory([]);
    addToast('History cleared.', 'info');
  }

  // Refresh history when returning to the page
  function refreshHistory() {
    try {
      const raw = localStorage.getItem(LS_HISTORY);
      setHistory(raw ? JSON.parse(raw) : []);
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/90 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center gap-3">
        {/* Logo + title */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            H
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white leading-tight truncate">
              AI Influencer Content Generator
            </h1>
            <a
              href="https://cloud.higgsfield.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-indigo-400 transition hidden sm:block"
            >
              cloud.higgsfield.ai ↗
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* History button */}
          <button
            onClick={() => { refreshHistory(); setHistoryOpen((v) => !v); }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white text-xs transition"
            title="Generation history"
          >
            🕐 History
          </button>

          {/* API Key status indicator */}
          {hasKeys ? (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-700/50 bg-green-900/20 text-green-400 text-xs hover:border-green-500 transition"
              title="API key configured — click to update"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              API Key Set
            </button>
          ) : (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition active:scale-95"
            >
              🔑 Add API Key
            </button>
          )}

          {/* Settings icon */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white transition text-base"
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* ── No-key banner ──────────────────────────────────────────── */}
      {!hasKeys && (
        <div className="bg-indigo-900/30 border-b border-indigo-700/40 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-indigo-300">
            <span className="font-semibold">Add your Higgsfield API key</span> to start generating images and videos.
          </p>
          <button
            onClick={() => setSettingsOpen(true)}
            className="shrink-0 text-xs text-indigo-400 hover:text-indigo-200 underline transition"
          >
            Set up →
          </button>
        </div>
      )}

      {/* ── Main ───────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center px-4 py-8">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          {/* Tab navigation */}
          <div className="flex rounded-xl bg-gray-900 border border-gray-800 p-1 gap-1" role="tablist">
            {[
              { key: 'image', label: '🖼️  Image Generation' },
              { key: 'video', label: '🎬  Video Generation' },
            ].map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition
                  ${activeTab === t.key
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div>
            {activeTab === 'image' ? (
              <div role="tabpanel">
                <ImageTab
                  hasKeys={hasKeys}
                  onOpenSettings={() => setSettingsOpen(true)}
                  addToast={addToast}
                  onImageReady={handleImageReady}
                />
              </div>
            ) : (
              <div role="tabpanel">
                <VideoTab
                  hasKeys={hasKeys}
                  onOpenSettings={() => setSettingsOpen(true)}
                  addToast={addToast}
                  imageFromImageTab={imageForVideo}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          Powered by{' '}
          <a href="https://cloud.higgsfield.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 transition">
            Higgsfield API
          </a>
          {' '}· Built with Soul Standard &amp; DoP Standard
        </span>
        <span className="flex items-center gap-3">
          <a href="https://docs.higgsfield.ai" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">
            Docs ↗
          </a>
          <span>v1.0.0</span>
        </span>
      </footer>

      {/* ── History sidebar / dropdown ──────────────────────────────── */}
      {historyOpen && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setHistoryOpen(false)}>
          <div
            className="relative w-full max-w-xs h-full bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">Generation History</h2>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-300 transition">
                    Clear
                  </button>
                )}
                <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-white transition">
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {history.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No generations yet.</p>
              ) : (
                history.map((item, i) => (
                  <div key={i} className="rounded-xl border border-gray-800 bg-gray-800/50 overflow-hidden">
                    {item.type === 'image' && item.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt="history" className="w-full h-24 object-cover" />
                    )}
                    {item.type === 'video' && item.url && (
                      <video src={item.url} className="w-full h-24 object-cover" muted />
                    )}
                    <div className="px-2.5 py-2">
                      <p className="text-xs text-gray-400 truncate" title={item.prompt}>{item.prompt}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {item.type === 'image' ? '🖼️' : '🎬'} {new Date(item.at).toLocaleTimeString()}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                        >
                          Open ↗
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modals / overlays ──────────────────────────────────────── */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={handleCredentialsSaved}
        addToast={addToast}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
