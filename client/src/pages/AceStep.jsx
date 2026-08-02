import React, { useState, useEffect, useRef } from 'react';
import { Settings, Play, RefreshCw } from 'lucide-react';

const DEFAULT_PROMPT =
  'Heavy melodic techno, 124 BPM, G minor, rolling hypnotic bassline, dark atmospheric pads, driving four-on-the-floor kick, cinematic tension building toward an emotional breakdown, big reverb space like a treated studio, professional club-ready mix';

const PROMPT_TIPS = [
  { label: 'BPM', tip: 'ציין מספר ספציפי: 122–128 BPM' },
  { label: 'סולם', tip: 'סולם מינורי מדויק: G minor / A minor / F minor' },
  { label: 'טקסטורה', tip: 'rolling bassline · dark pads · four-on-the-floor kick · big reverb' },
  { label: 'גימור', tip: 'professional club-ready mix / radio-ready master feel' },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const HISTORY_KEY = 'vovax_acestep_history';

export default function AceStep() {
  const [model, setModel] = useState('ace-step-xl');
  const [showSettings, setShowSettings] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [lyrics, setLyrics] = useState('');
  const [duration, setDuration] = useState(60);
  const [bpm, setBpm] = useState('');
  const [musicKey, setMusicKey] = useState('');
  const [batchSize, setBatchSize] = useState(1);
  const [status, setStatus] = useState('idle');
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const pollRef = useRef(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const saveHistory = (next) => {
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 20))); } catch {}
  };

  const pollStatus = (requestId) => {
    let attempts = 0;
    setStatus('polling');
    pollRef.current = setInterval(async () => {
      attempts += 1;
      setAttempt(attempts);
      try {
        const r = await fetch(`/api/acestep/status/${requestId}`);
        const data = await r.json();
        if (data.status === 'COMPLETED') {
          clearInterval(pollRef.current);
          const urls = data.output?.media_url || [];
          setResults(urls);
          setStatus('done');
          saveHistory([{ id: uid(), requestId, urls, prompt: prompt.slice(0, 80), date: new Date().toISOString() }, ...history]);
        } else if (data.status === 'FAILED' || data.status === 'ERROR') {
          clearInterval(pollRef.current);
          setStatus('error');
          setErrorMsg(data.error || 'ACE-Step דיווח על כשלון');
        } else if (attempts >= 60) {
          clearInterval(pollRef.current);
          setStatus('error');
          setErrorMsg('עברו כמה דקות בלי תוצאה — בדוק ידנית בדשבורד של Pixazo');
        }
      } catch {
        clearInterval(pollRef.current);
        setStatus('error');
        setErrorMsg('בדיקת הסטטוס נכשלה');
      }
    }, 7000);
  };

  const generate = async () => {
    setStatus('submitting');
    setErrorMsg(null);
    setResults([]);
    setAttempt(0);
    try {
      const body = { model, prompt, lyrics, duration: Number(duration) || 30, batch_size: Number(batchSize) || 1 };
      if (bpm) body.bpm = Number(bpm);
      if (musicKey) body.key = musicKey;

      const r = await fetch('/api/acestep/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.request_id) {
        pollStatus(data.request_id);
      } else {
        setStatus('error');
        setErrorMsg(data.message || data.error || 'לא התקבל request_id');
      }
    } catch {
      setStatus('error');
      setErrorMsg('הבקשה לשרת נכשלה');
    }
  };

  const inputStyle = { background: '#131316', border: '1px solid #232326', color: '#F2F1ED' };
  const busy = status === 'submitting' || status === 'polling';

  return (
    <div className="max-w-xl mx-auto px-5 py-8">
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · BEN — ACE-STEP
      </div>
      <div className="flex items-center justify-between mb-1">
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold">יצירת מוזיקה</h1>
        <button onClick={() => setShowSettings((v) => !v)} style={{ color: '#8B8A85' }} aria-label="הגדרות"><Settings size={20} /></button>
      </div>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-5">ACE-Step דרך שרת ה-proxy — ללא CORS</p>

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-6" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14" fill="none" stroke="#46C7FF" strokeWidth="1.5" className="pulse-line" />
      </svg>

      {showSettings && (
        <div style={{ background: '#131316', border: '1px solid #232326' }} className="rounded p-4 mb-6">
          <label style={{ color: '#8B8A85' }} className="text-xs block mb-1">מודל</label>
          <select value={model} onChange={(e) => setModel(e.target.value)} dir="ltr" style={inputStyle} className="w-full rounded px-3 py-2 text-sm">
            <option value="ace-step-xl">Ace Step 1.5 XL (~$0.015/שיר)</option>
            <option value="ace-step">Ace Step 1.5 (~$0.01/שיר)</option>
          </select>
          <p style={{ color: '#8B8A85' }} className="text-xs mt-2">
            ה-API key מוגדר בצד השרת — אין צורך להזין כאן.
          </p>
        </div>
      )}

      <div style={{ background: '#0F0F12', border: '1px solid #1E1E22' }} className="rounded p-3 mb-4">
        <div style={{ color: '#8B8A85', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em' }} className="text-xs uppercase mb-2">
          סטנדרט מלאכה — Tale Of Us · Anyma · ARTBAT · Stephan Bodzin
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {PROMPT_TIPS.map(({ label, tip }) => (
            <div key={label} className="flex gap-2 text-xs">
              <span style={{ color: '#46C7FF', minWidth: 48 }}>{label}</span>
              <span style={{ color: '#8B8A85' }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      <label style={{ color: '#8B8A85' }} className="text-xs block mb-1">פרומפט (סגנון / BPM / סולם / טקסטורה / גימור)</label>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} dir="ltr" rows={4} style={inputStyle} className="w-full rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-400" />

      <label style={{ color: '#8B8A85' }} className="text-xs block mb-1">מילים (אופציונלי — [verse] [chorus] [bridge], ריק = instrumental)</label>
      <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} dir="ltr" rows={3} style={inputStyle} className="w-full rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-400" />

      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          ['משך (שניות, עד 600)', 'number', duration, setDuration],
          ['BPM (אופציונלי)', 'number', bpm, setBpm],
          ['סולם (למשל B minor)', 'text', musicKey, setMusicKey],
          ['כמות וריאציות (1-4)', 'number', batchSize, setBatchSize],
        ].map(([label, type, val, setter]) => (
          <div key={label}>
            <label style={{ color: '#8B8A85' }} className="text-xs block mb-1">{label}</label>
            <input type={type} dir="ltr" value={val} onChange={(e) => setter(e.target.value)} style={inputStyle} className="w-full rounded px-3 py-2 text-sm" min={type === 'number' ? 1 : undefined} max={label.includes('1-4') ? 4 : undefined} />
          </div>
        ))}
      </div>

      <button
        onClick={generate}
        disabled={busy}
        style={{ background: busy ? '#232326' : '#46C7FF', color: busy ? '#8B8A85' : '#0A0A0C' }}
        className="rounded px-4 py-3 text-sm font-semibold w-full flex items-center justify-center gap-2 mb-4"
      >
        {status === 'submitting' && <><RefreshCw size={16} className="animate-spin" /> שולח בקשה...</>}
        {status === 'polling' && <><RefreshCw size={16} className="animate-spin" /> בבדיקה... ({attempt}/60)</>}
        {!busy && <><Play size={16} /> צור מוזיקה</>}
      </button>

      {errorMsg && (
        <div style={{ background: '#131316', border: '1px solid #FF5A64', color: '#FF5A64' }} className="rounded p-3 text-sm mb-4">{errorMsg}</div>
      )}

      {status === 'done' && results.length > 0 && (
        <div className="space-y-2 mb-6">
          {results.map((url, i) => <audio key={i} controls src={url} className="w-full" />)}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#8B8A85' }} className="text-xs uppercase tracking-wide mb-2">היסטוריה</h2>
          <div className="space-y-2">
            {history.slice(0, 10).map((h) => (
              <div key={h.id} style={{ background: '#131316', border: '1px solid #232326' }} className="rounded px-3 py-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span>{h.prompt}...</span>
                  <span style={{ color: '#8B8A85' }}>{formatDate(h.date)}</span>
                </div>
                {h.urls.map((u, i) => <audio key={i} controls src={u} className="w-full mt-1" />)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
