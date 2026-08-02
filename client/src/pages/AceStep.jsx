import React, { useState, useCallback, useRef } from 'react';
import { Settings, Play, RefreshCw, Wand2 } from 'lucide-react';

// Context → BPM + energy descriptor
const CONTEXT_MAP = {
  peak:       { bpm: '127 BPM', energy: 'peak-hour energy, maximum floor impact, relentless drive, tension never fully releasing' },
  opening:    { bpm: '121 BPM', energy: 'building tension, hypnotic groove, slow energy rise' },
  chill:      { bpm: '112 BPM', energy: 'deep atmospheric, meditative flow, reduced kick intensity, wide ambient space' },
  irrelevant: { bpm: '124 BPM', energy: '' },
};

const PURPOSE_MAP = {
  single:  '',
  videobg: 'cinematic visual support, wide spatial feel, score-like progression',
  djset:   'DJ-friendly extended intro and outro, clear 8-bar phrases',
  other:   '',
};

function buildPrompt({ purpose, mood, reference, context }) {
  const { bpm, energy } = CONTEXT_MAP[context] || CONTEXT_MAP.irrelevant;
  const parts = [
    'Heavy melodic techno',
    bpm,
    'G minor',
    'rolling hypnotic bassline',
    'dark atmospheric pads',
    'driving four-on-the-floor kick',
  ];
  if (energy) parts.push(energy);
  if (mood.trim()) parts.push(mood.trim());
  const purposeExtra = PURPOSE_MAP[purpose];
  if (purposeExtra) parts.push(purposeExtra);
  if (reference.trim()) parts.push(`inspired by ${reference.trim()}`);
  parts.push('big reverb space like a treated studio, professional club-ready mix');
  return parts.join(', ');
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function formatDate(iso) {
  return new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const HISTORY_KEY = 'vovax_acestep_history';

const S = { background: '#131316', border: '1px solid #232326', color: '#F2F1ED' };

function FieldLabel({ children }) {
  return <label style={{ color: '#8B8A85' }} className="text-xs block mb-1">{children}</label>;
}

export default function AceStep() {
  // Guided builder state
  const [purpose, setPurpose]     = useState('single');
  const [mood, setMood]           = useState('');
  const [reference, setReference] = useState('');
  const [context, setContext]     = useState('peak');

  // Prompt (editable, auto-filled by builder)
  const [prompt, setPrompt] = useState(() => buildPrompt({ purpose: 'single', mood: '', reference: '', context: 'peak' }));
  const promptManualRef = useRef(false); // true = user edited manually → don't auto-overwrite

  const rebuildPrompt = useCallback((overrides = {}) => {
    if (promptManualRef.current) return;
    setPrompt(buildPrompt({ purpose, mood, reference, context, ...overrides }));
  }, [purpose, mood, reference, context]);

  const handlePurpose = (v) => { setPurpose(v); rebuildPrompt({ purpose: v }); };
  const handleMood = (v) => { setMood(v); rebuildPrompt({ mood: v }); };
  const handleReference = (v) => { setReference(v); rebuildPrompt({ reference: v }); };
  const handleContext = (v) => { setContext(v); rebuildPrompt({ context: v }); };

  const handlePromptEdit = (v) => {
    promptManualRef.current = true;
    setPrompt(v);
  };
  const resetPrompt = () => {
    promptManualRef.current = false;
    setPrompt(buildPrompt({ purpose, mood, reference, context }));
  };

  // Generation state
  const [model, setModel]         = useState('ace-step-xl');
  const [showSettings, setShowSettings] = useState(false);
  const [lyrics, setLyrics]       = useState('');
  const [duration, setDuration]   = useState(60);
  const [batchSize, setBatchSize] = useState(1);
  const [status, setStatus]       = useState('idle');
  const [attempt, setAttempt]     = useState(0);
  const [results, setResults]     = useState([]);
  const [errorMsg, setErrorMsg]   = useState(null);
  const [history, setHistory]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const pollRef = useRef(null);

  const saveHistory = (next) => {
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 20))); } catch {}
  };

  const pollStatus = (requestId) => {
    let attempts = 0;
    setStatus('polling');
    pollRef.current = setInterval(async () => {
      attempts++;
      setAttempt(attempts);
      try {
        const r = await fetch(`/api/acestep/status/${requestId}`);
        const data = await r.json();
        if (data.status === 'COMPLETED') {
          clearInterval(pollRef.current);
          const urls = data.output?.media_url || [];
          setResults(urls);
          setStatus('done');
          saveHistory([{ id: uid(), urls, prompt: prompt.slice(0, 80), date: new Date().toISOString() }, ...history]);
        } else if (data.status === 'FAILED' || data.status === 'ERROR') {
          clearInterval(pollRef.current);
          setStatus('error');
          setErrorMsg(data.error || 'ACE-Step דיווח על כשלון');
        } else if (attempts >= 60) {
          clearInterval(pollRef.current);
          setStatus('error');
          setErrorMsg('עברו כמה דקות בלי תוצאה');
        }
      } catch {
        clearInterval(pollRef.current);
        setStatus('error');
        setErrorMsg('בדיקת הסטטוס נכשלה');
      }
    }, 7000);
  };

  const generate = async () => {
    setStatus('submitting'); setErrorMsg(null); setResults([]); setAttempt(0);
    try {
      const body = { model, prompt, lyrics, duration: Number(duration) || 30, batch_size: Number(batchSize) || 1 };
      const r = await fetch('/api/acestep/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.request_id) pollStatus(data.request_id);
      else { setStatus('error'); setErrorMsg(data.message || data.error || 'לא התקבל request_id'); }
    } catch {
      setStatus('error'); setErrorMsg('הבקשה לשרת נכשלה');
    }
  };

  const busy = status === 'submitting' || status === 'polling';

  return (
    <div className="max-w-xl mx-auto px-5 py-8">
      {/* Header */}
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · BEN — ACE-STEP
      </div>
      <div className="flex items-center justify-between mb-1">
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold">יצירת מוזיקה</h1>
        <button onClick={() => setShowSettings(v => !v)} style={{ color: '#8B8A85' }} aria-label="הגדרות"><Settings size={20} /></button>
      </div>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-5">ACE-Step דרך שרת ה-proxy — ללא CORS</p>

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-6" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14"
          fill="none" stroke="#46C7FF" strokeWidth="1.5" className="pulse-line" />
      </svg>

      {/* Model settings */}
      {showSettings && (
        <div style={S} className="rounded p-4 mb-6">
          <FieldLabel>מודל</FieldLabel>
          <select value={model} onChange={e => setModel(e.target.value)} dir="ltr" style={S} className="w-full rounded px-3 py-2 text-sm">
            <option value="ace-step-xl">Ace Step 1.5 XL (~$0.015/שיר)</option>
            <option value="ace-step">Ace Step 1.5 (~$0.01/שיר)</option>
          </select>
          <p style={{ color: '#8B8A85' }} className="text-xs mt-2">ה-API key מוגדר בצד השרת.</p>
        </div>
      )}

      {/* ── Guided context questionnaire ── */}
      <div style={{ background: '#0D0D10', border: '1px solid #1E1E22' }} className="rounded p-4 mb-5 space-y-4">
        <div style={{ color: '#8B8A85', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em' }} className="text-xs uppercase mb-1">
          הקשר היצירה
        </div>

        {/* Q1 — Purpose */}
        <div>
          <FieldLabel>1. מה זה בשביל?</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {[['single','סינגל חדש'],['videobg','רקע לקליפ'],['djset','סט DJ'],['other','אחר']].map(([v, label]) => (
              <button key={v} onClick={() => handlePurpose(v)}
                style={{ border: `1px solid ${purpose === v ? '#46C7FF' : '#232326'}`, color: purpose === v ? '#46C7FF' : '#8B8A85', background: purpose === v ? '#0D1A20' : 'transparent' }}
                className="rounded px-3 py-1 text-xs">
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Q2 — Mood */}
        <div>
          <FieldLabel>2. מצב רוח / כוונה?</FieldLabel>
          <input value={mood} onChange={e => handleMood(e.target.value)}
            placeholder="למשל: מסתורי ועמוק, בונה לקליימקס, נוסטלגי..."
            style={S} className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
        </div>

        {/* Q3 — Reference */}
        <div>
          <FieldLabel>3. יש רפרנס / השראה ספציפית? (אופציונלי)</FieldLabel>
          <input value={reference} onChange={e => handleReference(e.target.value)}
            placeholder='למשל: "Anyma — The Rhythm of Love" / ARTBAT open set vibe'
            style={S} className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
        </div>

        {/* Q4 — Context / Time */}
        <div>
          <FieldLabel>4. לאיזו שעה / הקשר?</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {[['peak','שעת פיק ברחבה'],['opening','סט פתיחה'],['chill','רקע רגוע'],['irrelevant','לא רלוונטי']].map(([v, label]) => (
              <button key={v} onClick={() => handleContext(v)}
                style={{ border: `1px solid ${context === v ? '#46C7FF' : '#232326'}`, color: context === v ? '#46C7FF' : '#8B8A85', background: context === v ? '#0D1A20' : 'transparent' }}
                className="rounded px-3 py-1 text-xs">
                {label}
              </button>
            ))}
          </div>
          <p style={{ color: '#8B8A85' }} className="text-xs mt-1">
            {context === 'peak'      && 'BPM: 127 · אנרגיה מקסימלית, פלור אימפקט'}
            {context === 'opening'   && 'BPM: 121 · בנייה הדרגתית, גרוב היפנוטי'}
            {context === 'chill'     && 'BPM: 112 · אמביינט עמוק, קיק מרוסן, מרחב רחב'}
            {context === 'irrelevant'&& 'BPM: 124 · ברירת מחדל'}
          </p>
        </div>
      </div>

      {/* ── Craft guide (reference standard) ── */}
      <div style={{ background: '#0A0A0C', border: '1px solid #1A1A1E' }} className="rounded px-3 py-2 mb-4">
        <div style={{ color: '#46C7FF', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.08em' }} className="text-xs mb-1">
          סטנדרט מלאכה — Tale Of Us · Anyma · ARTBAT · Stephan Bodzin
        </div>
        <div style={{ color: '#8B8A85' }} className="text-xs">
          סולם מינורי מדויק · rolling bassline · dark pads · four-on-the-floor kick · big reverb · professional club-ready mix
        </div>
      </div>

      {/* ── Prompt textarea (auto-built, remains editable) ── */}
      <div className="flex items-center justify-between mb-1">
        <FieldLabel>פרומפט סופי (ניתן לעריכה חופשית)</FieldLabel>
        {promptManualRef.current && (
          <button onClick={resetPrompt} style={{ color: '#46C7FF' }} className="text-xs flex items-center gap-1 mb-1">
            <Wand2 size={11} /> בנה מחדש מהשאלות
          </button>
        )}
      </div>
      <textarea value={prompt} onChange={e => handlePromptEdit(e.target.value)}
        dir="ltr" rows={4} style={S}
        className="w-full rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-400" />

      {/* ── Lyrics ── */}
      <FieldLabel>מילים (אופציונלי — [verse] [chorus] [bridge], ריק = instrumental)</FieldLabel>
      <textarea value={lyrics} onChange={e => setLyrics(e.target.value)}
        dir="ltr" rows={3} style={S}
        className="w-full rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-400" />

      {/* ── Technical params ── */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <div>
          <FieldLabel>משך (שניות, עד 600)</FieldLabel>
          <input type="number" dir="ltr" value={duration} onChange={e => setDuration(e.target.value)} style={S} className="w-full rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <FieldLabel>וריאציות (1–4)</FieldLabel>
          <input type="number" min={1} max={4} dir="ltr" value={batchSize} onChange={e => setBatchSize(e.target.value)} style={S} className="w-full rounded px-3 py-2 text-sm" />
        </div>
      </div>

      {/* ── Generate button ── */}
      <button onClick={generate} disabled={busy}
        style={{ background: busy ? '#232326' : '#46C7FF', color: busy ? '#8B8A85' : '#0A0A0C' }}
        className="rounded px-4 py-3 text-sm font-semibold w-full flex items-center justify-center gap-2 mb-4">
        {status === 'submitting' && <><RefreshCw size={16} className="animate-spin" /> שולח בקשה...</>}
        {status === 'polling'    && <><RefreshCw size={16} className="animate-spin" /> בבדיקה... ({attempt}/60)</>}
        {!busy                   && <><Play size={16} /> צור מוזיקה</>}
      </button>

      {errorMsg && (
        <div style={{ background: '#131316', border: '1px solid #FF5A64', color: '#FF5A64' }} className="rounded p-3 text-sm mb-4">
          {errorMsg}
        </div>
      )}

      {status === 'done' && results.length > 0 && (
        <div className="space-y-2 mb-6">
          {results.map((url, i) => <audio key={i} controls src={url} className="w-full" />)}
        </div>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#8B8A85' }} className="text-xs uppercase tracking-wide mb-2">היסטוריה</h2>
          <div className="space-y-2">
            {history.slice(0, 10).map((h) => (
              <div key={h.id} style={{ background: '#131316', border: '1px solid #232326' }} className="rounded px-3 py-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: '#8B8A85' }}>{h.prompt}...</span>
                  <span style={{ color: '#8B8A85' }}>{formatDate(h.date)}</span>
                </div>
                {h.urls?.map((u, i) => <audio key={i} controls src={u} className="w-full mt-1" />)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
