import React, { useState, useRef } from 'react';
import { Play, RefreshCw } from 'lucide-react';

const DEFAULT_PROMPT = 'Slow cinematic push-in, dark atmospheric lighting, subtle particle drift, heavy melodic techno mood';
const HISTORY_KEY = 'vovax_higgsfield_history';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export default function Higgsfield() {
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [status, setStatus] = useState('idle');
  const [attempt, setAttempt] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const pollRef = useRef(null);

  const saveHistory = (next) => {
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 10))); } catch {}
  };

  const pollStatus = (requestId) => {
    let attempts = 0;
    setStatus('polling');
    pollRef.current = setInterval(async () => {
      attempts++;
      setAttempt(attempts);
      try {
        const r = await fetch(`/api/higgsfield/status/${requestId}`);
        const data = await r.json();
        if (data.status === 'COMPLETED') {
          clearInterval(pollRef.current);
          const url = data.output?.media_url?.[0];
          setVideoUrl(url);
          setStatus('done');
          saveHistory([{ id: uid(), url, prompt: prompt.slice(0, 60), date: new Date().toISOString() }, ...history]);
        } else if (data.status === 'FAILED' || data.status === 'ERROR') {
          clearInterval(pollRef.current);
          setStatus('error');
          setErrorMsg(data.error || 'Higgsfield דיווח על כשלון');
        } else if (attempts >= 60) {
          clearInterval(pollRef.current);
          setStatus('error');
          setErrorMsg('עברו כמה דקות בלי תוצאה');
        }
      } catch { clearInterval(pollRef.current); setStatus('error'); setErrorMsg('בדיקת סטטוס נכשלה'); }
    }, 7000);
  };

  const generate = async () => {
    if (!imageUrl.trim()) { setErrorMsg('צריך URL של תמונה'); return; }
    setStatus('submitting'); setErrorMsg(null); setVideoUrl(null); setAttempt(0);
    try {
      const r = await fetch('/api/higgsfield/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'dop-lite', prompt, input_images: [imageUrl], enhance_prompt: true }),
      });
      const data = await r.json();
      if (data.request_id) pollStatus(data.request_id);
      else { setStatus('error'); setErrorMsg(data.message || data.error || 'לא התקבל request_id'); }
    } catch { setStatus('error'); setErrorMsg('הבקשה לשרת נכשלה'); }
  };

  const inputStyle = { background: '#131316', border: '1px solid #232326', color: '#F2F1ED' };
  const busy = status === 'submitting' || status === 'polling';

  return (
    <div className="max-w-xl mx-auto px-5 py-8">
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · MAOR — HIGGSFIELD
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold mb-1">קליפ קצר (תמונה → וידאו)</h1>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-5">Higgsfield דרך שרת ה-proxy — ללא CORS</p>

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-6" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14" fill="none" stroke="#46C7FF" strokeWidth="1.5" className="pulse-line" />
      </svg>

      <label style={{ color: '#8B8A85' }} className="text-xs block mb-1">כתובת תמונה (URL ציבורי)</label>
      <input dir="ltr" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={inputStyle} className="w-full rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-400" placeholder="https://..." />

      <label style={{ color: '#8B8A85' }} className="text-xs block mb-1">פרומפט תנועה/אווירה</label>
      <textarea dir="ltr" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} style={inputStyle} className="w-full rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-400" />

      <button
        onClick={generate} disabled={busy}
        style={{ background: busy ? '#232326' : '#46C7FF', color: busy ? '#8B8A85' : '#0A0A0C' }}
        className="rounded px-4 py-3 text-sm font-semibold w-full flex items-center justify-center gap-2 mb-4"
      >
        {status === 'submitting' && <><RefreshCw size={16} className="animate-spin" /> שולח בקשה...</>}
        {status === 'polling' && <><RefreshCw size={16} className="animate-spin" /> בבדיקה... ({attempt}/60)</>}
        {!busy && <><Play size={16} /> צור קליפ</>}
      </button>

      {errorMsg && <div style={{ background: '#131316', border: '1px solid #FF5A64', color: '#FF5A64' }} className="rounded p-3 text-sm mb-4">{errorMsg}</div>}

      {status === 'done' && videoUrl && (
        <video controls src={videoUrl} className="w-full rounded mb-6" style={{ border: '1px solid #232326' }} />
      )}

      {history.length > 0 && (
        <div>
          <h2 style={{ color: '#8B8A85', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-wide mb-2">היסטוריה</h2>
          <div className="space-y-2">
            {history.slice(0, 5).map((h) => (
              <div key={h.id} style={{ background: '#131316', border: '1px solid #232326' }} className="rounded p-2">
                <div style={{ color: '#8B8A85' }} className="text-xs mb-1">{h.prompt}...</div>
                {h.url && <video controls src={h.url} className="w-full rounded" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
