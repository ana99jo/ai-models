'use client';

import { useState, useRef, useCallback } from 'react';
import {
  IMAGE_EXAMPLES,
  ASPECT_RATIOS,
  IMAGE_RESOLUTIONS,
  POLL_INTERVAL_IMAGE,
  POLL_MAX_IMAGE,
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE_MB,
  LS_HISTORY,
  MAX_HISTORY,
} from '../lib/config';

const MAX_PROMPT = 500;

function StatusBadge({ status }) {
  const map = {
    queued:      { label: 'Queued…',       cls: 'text-yellow-400 border-yellow-500/30 bg-yellow-900/20' },
    in_progress: { label: 'Generating…',   cls: 'text-blue-400   border-blue-500/30   bg-blue-900/20'   },
    completed:   { label: 'Complete ✓',    cls: 'text-green-400  border-green-500/30  bg-green-900/20'  },
    failed:      { label: 'Failed',         cls: 'text-red-400    border-red-500/30    bg-red-900/20'    },
    nsfw:        { label: 'Content blocked',cls: 'text-red-400    border-red-500/30    bg-red-900/20'    },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${s.cls}`}>
      {(status === 'queued' || status === 'in_progress') && (
        <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
      )}
      {s.label}
    </span>
  );
}

/**
 * ImageTab
 * Props:
 *   hasKeys: boolean
 *   onOpenSettings: () => void
 *   addToast: (msg, type) => void
 *   onImageReady: (url) => void  — called when an image is ready for "Use for Video"
 */
export default function ImageTab({ hasKeys, onOpenSettings, addToast, onImageReady }) {
  const [prompt, setPrompt] = useState('');
  const [refImage, setRefImage] = useState(null); // { dataUrl, name }
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('1080p');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [result, setResult] = useState(null); // { url }
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(null);

  const pollRef = useRef(null);
  const pollCount = useRef(0);
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function saveToHistory(entry) {
    try {
      const raw = localStorage.getItem(LS_HISTORY);
      const history = raw ? JSON.parse(raw) : [];
      history.unshift(entry);
      localStorage.setItem(LS_HISTORY, JSON.stringify(history.slice(0, MAX_HISTORY)));
    } catch { /* ignore */ }
  }

  const pollStatus = useCallback(async (id, start) => {
    pollCount.current += 1;
    if (pollCount.current > POLL_MAX_IMAGE) {
      stopPolling();
      setLoading(false);
      setStatus('failed');
      addToast('Request timed out. Please try again.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/status/${id}`);
      const data = await res.json();
      setStatus(data.status);

      if (data.status === 'completed') {
        stopPolling();
        setLoading(false);
        const url = data.images?.[0]?.url ?? null;
        setResult({ url });
        const secs = ((Date.now() - start) / 1000).toFixed(1);
        setElapsed(secs);
        saveToHistory({ type: 'image', url, prompt, requestId: id, at: Date.now() });
        addToast('Image generated! ✓', 'success');
      } else if (data.status === 'failed') {
        stopPolling();
        setLoading(false);
        addToast('Generation failed. Credits refunded.', 'error');
      } else if (data.status === 'nsfw') {
        stopPolling();
        setLoading(false);
        addToast('Content flagged by moderation. Adjust your prompt.', 'warning');
      }
    } catch {
      stopPolling();
      setLoading(false);
      addToast('Network error while polling status.', 'error');
    }
  }, [addToast, prompt]);

  async function handleGenerate() {
    if (!hasKeys) { onOpenSettings(); return; }
    if (!prompt.trim()) { addToast('Please enter a prompt.', 'error'); return; }

    setLoading(true);
    setStatus(null);
    setResult(null);
    setRequestId(null);
    setElapsed(null);
    pollCount.current = 0;

    const start = Date.now();
    setStartTime(start);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          referenceImage: refImage?.dataUrl ?? undefined,
          aspectRatio,
          resolution,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setLoading(false);
        addToast(data.error ? JSON.stringify(data.error) : 'Request failed.', 'error');
        return;
      }

      setStatus(data.status);
      setRequestId(data.request_id);
      pollRef.current = setInterval(() => pollStatus(data.request_id, start), POLL_INTERVAL_IMAGE);
    } catch {
      setLoading(false);
      addToast('Network error. Please try again.', 'error');
    }
  }

  async function handleCancel() {
    if (!requestId) return;
    try {
      await fetch(`/api/cancel/${requestId}`, { method: 'POST' });
      stopPolling();
      setLoading(false);
      setStatus(null);
      addToast('Request cancelled.', 'info');
    } catch {
      addToast('Could not cancel request.', 'error');
    }
  }

  function handleFileSelect(file) {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      addToast('Please upload JPG, JPEG, or PNG files only.', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      addToast(`File size must be under ${MAX_FILE_SIZE_MB}MB.`, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setRefImage({ dataUrl: e.target.result, name: file.name });
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  }

  function handleUseForVideo() {
    if (result?.url) {
      onImageReady(result.url);
      addToast('Image sent to Video tab!', 'success');
    }
  }

  async function handleDownload() {
    if (!result?.url) return;
    try {
      const res = await fetch(result.url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `higgsfield-image-${Date.now()}.jpg`;
      a.click();
    } catch {
      // Fallback: open in new tab
      window.open(result.url, '_blank');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Reference image upload */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-300">Reference Image <span className="text-gray-500 font-normal">(optional)</span></label>
        <div
          ref={dragRef}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`relative rounded-xl border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center py-8 gap-2 text-sm text-gray-400
            ${dragging ? 'border-indigo-500 bg-indigo-900/10' : 'border-gray-700 hover:border-gray-500'}`}
          onClick={() => !refImage && document.getElementById('img-upload').click()}
          role="button"
          aria-label="Upload reference image"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && document.getElementById('img-upload').click()}
        >
          {refImage ? (
            <div className="flex flex-col items-center gap-3 w-full px-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={refImage.dataUrl}
                alt="Reference"
                className="max-w-[400px] max-h-56 object-contain rounded-lg"
              />
              <span className="text-xs text-gray-500">{refImage.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setRefImage(null); }}
                className="text-xs text-red-400 hover:text-red-300 transition"
              >
                Remove image
              </button>
            </div>
          ) : (
            <>
              <span className="text-3xl">🖼️</span>
              <span>Drag & drop or <span className="text-indigo-400">browse</span></span>
              <span className="text-xs text-gray-500">JPG, PNG · max {MAX_FILE_SIZE_MB}MB</span>
            </>
          )}
        </div>
        <input
          id="img-upload"
          type="file"
          accept=".jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files[0])}
        />
      </div>

      {/* Prompt */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Prompt</label>
          <span className={`text-xs ${prompt.length > MAX_PROMPT * 0.9 ? 'text-yellow-400' : 'text-gray-500'}`}>
            {prompt.length}/{MAX_PROMPT}
          </span>
        </div>
        <textarea
          rows={4}
          maxLength={MAX_PROMPT}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          className="w-full rounded-xl bg-gray-800 border border-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 outline-none px-4 py-3 text-sm text-gray-100 placeholder-gray-500 resize-none transition"
        />
        {/* Example prompts */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Examples (click to use):</span>
          <div className="flex flex-col gap-1">
            {IMAGE_EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setPrompt(ex)}
                className="text-left text-xs text-indigo-400 hover:text-indigo-300 transition truncate"
                title={ex}
              >
                → {ex}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced options */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition w-fit"
          aria-expanded={showAdvanced}
        >
          <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
          Advanced options
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 pl-5 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="bg-gray-800 border border-gray-700 focus:border-indigo-500 outline-none rounded-lg px-3 py-2 text-sm text-gray-100 transition"
              >
                {ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="bg-gray-800 border border-gray-700 focus:border-indigo-500 outline-none rounded-lg px-3 py-2 text-sm text-gray-100 transition"
              >
                {IMAGE_RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Generate button */}
      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          title={!hasKeys ? 'Add your API key to generate' : ''}
          className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition active:scale-95 flex items-center justify-center gap-2"
        >
          {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {loading ? 'Generating…' : 'Generate Image with Nano Banana Pro'}
        </button>
        {loading && status === 'queued' && (
          <button
            onClick={handleCancel}
            className="px-4 rounded-xl border border-gray-600 hover:border-red-500 text-gray-400 hover:text-red-400 text-sm transition"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Status row */}
      {status && (
        <div className="flex items-center justify-between rounded-xl bg-gray-800/50 border border-gray-700 px-4 py-3">
          <StatusBadge status={status} />
          {requestId && (
            <span className="text-xs text-gray-500 font-mono hidden sm:block">
              {requestId.slice(0, 8)}…
            </span>
          )}
        </div>
      )}

      {/* Result */}
      {result?.url && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl overflow-hidden border border-gray-700 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.url}
              alt="Generated image"
              className="w-full object-contain max-h-[600px]"
            />
          </div>

          {/* Metadata */}
          {elapsed && (
            <p className="text-xs text-gray-500">
              Generated in <span className="text-gray-300">{elapsed}s</span>
              {requestId && <> · Request ID: <span className="font-mono text-gray-400">{requestId}</span></>}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 rounded-xl border border-gray-600 hover:border-indigo-500 text-gray-300 hover:text-indigo-300 text-sm py-2.5 transition"
            >
              ⬇ Download
            </button>
            <button
              onClick={handleUseForVideo}
              className="flex-1 rounded-xl bg-violet-700 hover:bg-violet-600 text-white text-sm py-2.5 transition font-medium"
            >
              🎬 Use for Video
            </button>
            <button
              onClick={handleGenerate}
              className="flex-1 rounded-xl border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white text-sm py-2.5 transition"
            >
              ↺ Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
