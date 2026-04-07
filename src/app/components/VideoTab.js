'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  VIDEO_EXAMPLES,
  ASPECT_RATIOS,
  VIDEO_RESOLUTIONS,
  VIDEO_DURATIONS,
  POLL_INTERVAL_IMAGE,
  POLL_INTERVAL_VIDEO,
  POLL_MAX_IMAGE,
  POLL_MAX_VIDEO,
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE_MB,
  LS_HISTORY,
  MAX_HISTORY,
} from '../lib/config';

const MAX_PROMPT = 500;

// Step states: idle | running | done | error
function StepIndicator({ step, label, state }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition
        ${state === 'done'    ? 'border-green-500 bg-green-900/30 text-green-400' : ''}
        ${state === 'running' ? 'border-indigo-500 bg-indigo-900/30 text-indigo-400' : ''}
        ${state === 'error'   ? 'border-red-500   bg-red-900/30   text-red-400'   : ''}
        ${state === 'idle'    ? 'border-gray-600  bg-gray-800      text-gray-500'  : ''}
      `}>
        {state === 'done'    && '✓'}
        {state === 'error'   && '✕'}
        {state === 'running' && <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
        {state === 'idle'    && step}
      </div>
      <span className={`text-sm ${state === 'running' ? 'text-white' : state === 'done' ? 'text-green-400' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}

/**
 * VideoTab
 * Props:
 *   hasKeys: boolean
 *   onOpenSettings: () => void
 *   addToast: (msg, type) => void
 *   imageFromImageTab: string | null  — URL passed from Image tab "Use for Video"
 */
export default function VideoTab({ hasKeys, onOpenSettings, addToast, imageFromImageTab }) {
  const [prompt, setPrompt] = useState('');
  const [refImage, setRefImage] = useState(null); // { dataUrl, name } for upload
  const [dismissImageTab, setDismissImageTab] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('1080p');
  const [duration, setDuration] = useState(8);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Derived: use the image passed from Image tab unless user dismissed it or uploaded their own
  const usingFromImageTab = !!imageFromImageTab && !refImage && !dismissImageTab;

  // Generation state
  const [step1State, setStep1State] = useState('idle'); // idle | running | done | error
  const [step2State, setStep2State] = useState('idle');
  const [step1RequestId, setStep1RequestId] = useState(null);
  const [step2RequestId, setStep2RequestId] = useState(null);
  const [frameImageUrl, setFrameImageUrl] = useState(null);
  const [result, setResult] = useState(null); // { url, duration }
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(null);

  const pollRef = useRef(null);
  const pollCount = useRef(0);

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

  // ---- Step 2: poll video status ----
  const pollVideoStatus = useCallback(async (id, start) => {
    pollCount.current += 1;
    if (pollCount.current > POLL_MAX_VIDEO) {
      stopPolling();
      setLoading(false);
      setStep2State('error');
      addToast('Video generation timed out. Please try again.', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/status/${id}`);
      const data = await res.json();

      if (data.status === 'completed') {
        stopPolling();
        setStep2State('done');
        setLoading(false);
        const url = data.video?.url ?? null;
        setResult({ url, duration: data.video?.duration ?? duration });
        const secs = ((Date.now() - start) / 1000).toFixed(1);
        setElapsed(secs);
        saveToHistory({ type: 'video', url, prompt, requestId: id, at: Date.now() });
        addToast('Video generated! ✓', 'success');
      } else if (data.status === 'failed') {
        stopPolling();
        setStep2State('error');
        setLoading(false);
        addToast('Video generation failed. Credits refunded.', 'error');
      } else if (data.status === 'nsfw') {
        stopPolling();
        setStep2State('error');
        setLoading(false);
        addToast('Content flagged by moderation.', 'warning');
      }
    } catch {
      stopPolling();
      setStep2State('error');
      setLoading(false);
      addToast('Network error while polling video status.', 'error');
    }
  }, [addToast, prompt, duration]);

  // ---- Step 1: poll frame status ----
  const pollFrameStatus = useCallback(async (id, start) => {
    pollCount.current += 1;
    if (pollCount.current > POLL_MAX_IMAGE) {
      stopPolling();
      setLoading(false);
      setStep1State('error');
      addToast('First frame generation timed out.', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/status/${id}`);
      const data = await res.json();

      if (data.status === 'completed') {
        stopPolling();
        const imgUrl = data.images?.[0]?.url ?? null;
        if (!imgUrl) {
          setStep1State('error');
          setLoading(false);
          addToast('No frame image returned. Please try again.', 'error');
          return;
        }
        setFrameImageUrl(imgUrl);
        setStep1State('done');

        // ---- Start Step 2 ----
        setStep2State('running');
        pollCount.current = 0;

        const videoRes = await fetch('/api/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            imageUrl: imgUrl,
            aspectRatio,
            resolution,
            duration,
            generateAudio,
          }),
        });
        const videoData = await videoRes.json();

        if (!videoRes.ok || videoData.error) {
          setStep2State('error');
          setLoading(false);
          addToast(videoData.error ? JSON.stringify(videoData.error) : 'Video request failed.', 'error');
          return;
        }

        const vid2Id = videoData.request_id ?? videoData.id;
        setStep2RequestId(vid2Id);
        pollRef.current = setInterval(() => pollVideoStatus(vid2Id, start), POLL_INTERVAL_VIDEO);
      } else if (data.status === 'failed') {
        stopPolling();
        setStep1State('error');
        setLoading(false);
        addToast('First frame generation failed.', 'error');
      } else if (data.status === 'nsfw') {
        stopPolling();
        setStep1State('error');
        setLoading(false);
        addToast('Content flagged by moderation.', 'warning');
      }
    } catch {
      stopPolling();
      setStep1State('error');
      setLoading(false);
      addToast('Network error during frame generation.', 'error');
    }
  }, [addToast, prompt, aspectRatio, resolution, duration, generateAudio, pollVideoStatus]);

  async function handleGenerate() {
    if (!hasKeys) { onOpenSettings(); return; }
    if (!prompt.trim()) { addToast('Please enter a prompt.', 'error'); return; }

    setLoading(true);
    setStep1State('running');
    setStep2State('idle');
    setResult(null);
    setFrameImageUrl(null);
    setStep1RequestId(null);
    setStep2RequestId(null);
    setElapsed(null);
    pollCount.current = 0;

    const start = Date.now();
    setStartTime(start);

    // Determine reference image: from image tab URL or local upload
    const referenceImage = usingFromImageTab
      ? undefined // we pass imageUrl separately for video; for frame generation use imageFromImageTab as reference
      : refImage?.dataUrl ?? undefined;

    const framePrompt = `First frame of video, ${prompt.trim()}, cinematic composition, keyframe quality`;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: framePrompt,
          referenceImage: usingFromImageTab ? imageFromImageTab : referenceImage,
          aspectRatio,
          resolution,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setStep1State('error');
        setLoading(false);
        addToast(data.error ? JSON.stringify(data.error) : 'Frame request failed.', 'error');
        return;
      }

      setStep1RequestId(data.request_id);
      pollRef.current = setInterval(() => pollFrameStatus(data.request_id, start), POLL_INTERVAL_IMAGE);
    } catch {
      setStep1State('error');
      setLoading(false);
      addToast('Network error. Please try again.', 'error');
    }
  }

  async function handleCancel() {
    const id = step2State === 'running' ? step2RequestId : step1RequestId;
    if (!id) return;
    try {
      await fetch(`/api/cancel/${id}`, { method: 'POST' });
      stopPolling();
      setLoading(false);
      setStep1State('idle');
      setStep2State('idle');
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
    reader.onload = (e) => {
      setRefImage({ dataUrl: e.target.result, name: file.name });
      setDismissImageTab(true);
    };
    reader.readAsDataURL(file);
  }

  async function handleDownload() {
    if (!result?.url) return;
    try {
      const res = await fetch(result.url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `higgsfield-video-${Date.now()}.mp4`;
      a.click();
    } catch {
      window.open(result.url, '_blank');
    }
  }

  const isRunning = step1State === 'running' || step2State === 'running';

  return (
    <div className="flex flex-col gap-6">
      {/* Reference image upload */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-300">
          Reference Image <span className="text-gray-500 font-normal">(optional)</span>
        </label>

        {usingFromImageTab && imageFromImageTab ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-700/50 bg-green-900/20 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageFromImageTab} alt="From Image tab" className="w-12 h-12 object-cover rounded-lg" />
            <div className="flex-1">
              <p className="text-sm text-green-400 font-medium">Using image from Image tab ✓</p>
              <p className="text-xs text-gray-400">This will be used as the reference for the first frame.</p>
            </div>
            <button
              onClick={() => setDismissImageTab(true)}
              className="text-xs text-gray-400 hover:text-white transition"
            >
              Remove
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files[0]); }}
            className={`relative rounded-xl border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center py-7 gap-2 text-sm text-gray-400
              ${dragging ? 'border-indigo-500 bg-indigo-900/10' : 'border-gray-700 hover:border-gray-500'}`}
            onClick={() => !refImage && document.getElementById('vid-img-upload').click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && document.getElementById('vid-img-upload').click()}
            aria-label="Upload reference image"
          >
            {refImage ? (
              <div className="flex flex-col items-center gap-3 w-full px-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={refImage.dataUrl} alt="Reference" className="max-w-[300px] max-h-44 object-contain rounded-lg" />
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
                <span className="text-3xl">🎬</span>
                <span>Drag & drop or <span className="text-indigo-400">browse</span></span>
                <span className="text-xs text-gray-500">JPG, PNG · max {MAX_FILE_SIZE_MB}MB</span>
              </>
            )}
          </div>
        )}
        <input
          id="vid-img-upload"
          type="file"
          accept=".jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files[0])}
        />
      </div>

      {/* Prompt */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Motion & Scene Prompt</label>
          <span className={`text-xs ${prompt.length > MAX_PROMPT * 0.9 ? 'text-yellow-400' : 'text-gray-500'}`}>
            {prompt.length}/{MAX_PROMPT}
          </span>
        </div>
        <textarea
          rows={4}
          maxLength={MAX_PROMPT}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video scene, motion, and camera movement..."
          className="w-full rounded-xl bg-gray-800 border border-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 outline-none px-4 py-3 text-sm text-gray-100 placeholder-gray-500 resize-none transition"
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Examples (click to use):</span>
          {VIDEO_EXAMPLES.map((ex, i) => (
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
              <label className="text-xs font-medium text-gray-400">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 focus:border-indigo-500 outline-none rounded-lg px-3 py-2 text-sm text-gray-100 transition"
              >
                {VIDEO_DURATIONS.map((d) => <option key={d} value={d}>{d}s</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="bg-gray-800 border border-gray-700 focus:border-indigo-500 outline-none rounded-lg px-3 py-2 text-sm text-gray-100 transition"
              >
                {VIDEO_RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="bg-gray-800 border border-gray-700 focus:border-indigo-500 outline-none rounded-lg px-3 py-2 text-sm text-gray-100 transition"
              >
                {ASPECT_RATIOS.slice(0, 2).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Audio</label>
              <button
                onClick={() => setGenerateAudio((v) => !v)}
                className={`rounded-lg border px-3 py-2 text-sm transition text-left
                  ${generateAudio ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300' : 'border-gray-700 text-gray-400'}`}
              >
                {generateAudio ? '🔊 Audio on' : '🔇 Audio off'}
              </button>
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
          className="flex-1 rounded-xl bg-violet-700 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition active:scale-95 flex items-center justify-center gap-2"
        >
          {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {loading ? 'Processing…' : 'Generate Video (2-Step Process)'}
        </button>
        {isRunning && (
          <button
            onClick={handleCancel}
            className="px-4 rounded-xl border border-gray-600 hover:border-red-500 text-gray-400 hover:text-red-400 text-sm transition"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Two-step progress indicator */}
      {(step1State !== 'idle' || step2State !== 'idle') && (
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 px-5 py-4 flex flex-col gap-3">
          <StepIndicator
            step={1}
            label="Generating first frame with Soul Standard…"
            state={step1State}
          />
          <div className="w-px h-4 bg-gray-700 ml-3.5" />
          <StepIndicator
            step={2}
            label={`Creating video with DoP Standard… (est. 30–60s for ${duration}s video)`}
            state={step2State}
          />
        </div>
      )}

      {/* Frame preview (after step 1 done) */}
      {frameImageUrl && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-gray-400">First frame preview:</span>
          <div className="rounded-xl overflow-hidden border border-gray-700 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frameImageUrl} alt="First frame" className="w-full max-h-48 object-contain" />
          </div>
        </div>
      )}

      {/* Result */}
      {result?.url && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl overflow-hidden border border-gray-700 bg-black">
            <video
              src={result.url}
              controls
              autoPlay
              loop
              muted={!generateAudio}
              className="w-full"
            />
          </div>

          {elapsed && (
            <p className="text-xs text-gray-500">
              Total time: <span className="text-gray-300">{elapsed}s</span>
              {step1RequestId && <> · Frame ID: <span className="font-mono text-gray-400">{step1RequestId.slice(0, 8)}…</span></>}
              {step2RequestId && <> · Video ID: <span className="font-mono text-gray-400">{step2RequestId.slice(0, 8)}…</span></>}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 rounded-xl border border-gray-600 hover:border-indigo-500 text-gray-300 hover:text-indigo-300 text-sm py-2.5 transition"
            >
              ⬇ Download MP4
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
