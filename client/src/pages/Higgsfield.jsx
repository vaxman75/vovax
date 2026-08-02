import React, { useState, useRef } from 'react';
import { Play, RefreshCw, Wand2 } from 'lucide-react';

// Motion type → movement descriptor
const MOTION_MAP = {
  push:     'slow cinematic push-in, gradual zoom with subtle lens breathing',
  parallax: 'layered parallax depth shift, foreground and background drifting at different speeds',
  particle: 'floating particle drift, slow dissolving embers and dust suspended in air',
  abstract: 'abstract morphing flow, liquid motion textures melting into each other',
};

// Usage context → visual direction
const CONTEXT_MAP = {
  setvisual: 'dark atmospheric, high-contrast dramatic lighting, heavy underground club mood, visual tension building',
  stagebg:   'seamless loop-ready, continuous unhurried motion, no hard cuts or flash, stage-safe pacing',
  social:    'visually striking in first two seconds, strong silhouette or light contrast, immediate impact',
  other:     '',
};

// Purpose → extra tag
const PURPOSE_MAP = {
  clip:   'music video aesthetic, narrative visual arc',
  viz:    'DJ set visualizer, abstract and non-literal',
  social: 'short-form social content, eye-catching loop',
  other:  '',
};

function buildPrompt({ purpose, mood, motion, context }) {
  const motionDesc = MOTION_MAP[motion] || MOTION_MAP.push;
  const contextDesc = CONTEXT_MAP[context] || '';
  const parts = [motionDesc];
  if (contextDesc) parts.push(contextDesc);
  if (mood.trim()) parts.push(mood.trim());
  const purposeExtra = PURPOSE_MAP[purpose];
  if (purposeExtra) parts.push(purposeExtra);
  parts.push('cinematic depth of field, subtle film grain, moody color grade');
  return parts.join(', ');
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

const HISTORY_KEY = 'vovax_higgsfield_history';
const S = { background: '#131316', border: '1px solid #232326', color: '#F2F1ED' };

function FieldLabel({ children }) {
  return <label style={{ color: '#8B8A85' }} className="text-xs block mb-1">{children}</label>;
}

function RadioGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            background: value === o.value ? '#46C7FF' : '#131316',
            border: '1px solid ' + (value === o.value ? '#46C7FF' : '#232326'),
            color: value === o.value ? '#0A0A0C' : '#F2F1ED',
          }}
          className="rounded px-3 py-1 text-sm font-medium transition-colors"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Higgsfield() {
  const [imageUrl, setImageUrl] = useState('');

  // Guided form state
  const [purpose, setPurpose] = useState('viz');
  const [mood, setMood] = useState('');
  const [motion, setMotion] = useState('push');
  const [context, setContext] = useState('setvisual');

  const [prompt, setPrompt] = useState(() =>
    buildPrompt({ purpose: 'viz', mood: '', motion: 'push', context: 'setvisual' })
  );
  const promptManualRef = useRef(false);

  const [status, setStatus] = useState('idle');
  const [attempt, setAttempt] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const pollRef = useRef(null);

  // Rebuild prompt when guided fields change (unless user manually edited)
  const handleGuided = (field, val) => {
    const next = { purpose, mood, motion, context, [field]: val };
    if (field === 'purpose') setPurpose(val);
    if (field === 'mood') setMood(val);
    if (field === 'motion') setMotion(val);
    if (field === 'context') setContext(val);
    if (!promptManualRef.current) {
      setPrompt(buildPrompt(next));
    }
  };

  const handlePromptChange = (val) => {
    promptManualRef.current = true;
    setPrompt(val);
  };

  const rebuildPrompt = () => {
    promptManualRef.current = false;
    setPrompt(buildPrompt({ purpose, mood, motion, context }));
  };

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

      {/* Guided questionnaire */}
      <div style={{ background: '#0E0E11', border: '1px solid #232326', borderRadius: 8 }} className="p-4 mb-5">
        <p style={{ color: '#46C7FF', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-widest mb-4">
          כמה שאלות לפני שיוצרים
        </p>

        <FieldLabel>1. מה זה בשביל?</FieldLabel>
        <RadioGroup
          value={purpose}
          onChange={(v) => handleGuided('purpose', v)}
          options={[
            { value: 'viz',    label: 'ויז\'ואלייזר לסט' },
            { value: 'clip',   label: 'קליפ מוזיקלי' },
            { value: 'social', label: 'פוסט לרשת' },
            { value: 'other',  label: 'אחר' },
          ]}
        />

        <FieldLabel>2. אווירה / כוונה?</FieldLabel>
        <input
          dir="rtl"
          value={mood}
          onChange={(e) => handleGuided('mood', e.target.value)}
          style={S}
          className="w-full rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          placeholder="למשל: חשוך ואטמוספרי, כמו Anyma בSB"
        />

        <FieldLabel>3. סוג תנועה מועדף?</FieldLabel>
        <RadioGroup
          value={motion}
          onChange={(v) => handleGuided('motion', v)}
          options={[
            { value: 'push',     label: 'Push-in קולנועי' },
            { value: 'parallax', label: 'Parallax עומק' },
            { value: 'particle', label: 'Particle drift' },
            { value: 'abstract', label: 'Abstract flow' },
          ]}
        />

        <FieldLabel>4. לאיזה הקשר?</FieldLabel>
        <RadioGroup
          value={context}
          onChange={(v) => handleGuided('context', v)}
          options={[
            { value: 'setvisual', label: 'ויז\'ואל לפני סט' },
            { value: 'stagebg',   label: 'לופ ברקע בבמה' },
            { value: 'social',    label: 'פוסט ברשתות' },
            { value: 'other',     label: 'לא רלוונטי' },
          ]}
        />
      </div>

      {/* Image URL */}
      <FieldLabel>כתובת תמונה (URL ציבורי)</FieldLabel>
      <input
        dir="ltr"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        style={S}
        className="w-full rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        placeholder="https://..."
      />

      {/* Prompt override */}
      <div className="flex items-center justify-between mb-1">
        <FieldLabel>פרומפט (נבנה אוטומטית מהשאלות)</FieldLabel>
        {promptManualRef.current && (
          <button
            onClick={rebuildPrompt}
            style={{ color: '#46C7FF' }}
            className="flex items-center gap-1 text-xs mb-1"
          >
            <Wand2 size={12} /> בנה מחדש מהשאלות
          </button>
        )}
      </div>
      <textarea
        dir="ltr"
        value={prompt}
        onChange={(e) => handlePromptChange(e.target.value)}
        rows={3}
        style={S}
        className="w-full rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-400"
      />

      <button
        onClick={generate}
        disabled={busy}
        style={{ background: busy ? '#232326' : '#46C7FF', color: busy ? '#8B8A85' : '#0A0A0C' }}
        className="rounded px-4 py-3 text-sm font-semibold w-full flex items-center justify-center gap-2 mb-4"
      >
        {status === 'submitting' && <><RefreshCw size={16} className="animate-spin" /> שולח בקשה...</>}
        {status === 'polling' && <><RefreshCw size={16} className="animate-spin" /> בבדיקה... ({attempt}/60)</>}
        {!busy && <><Play size={16} /> צור קליפ</>}
      </button>

      {errorMsg && (
        <div style={{ background: '#131316', border: '1px solid #FF5A64', color: '#FF5A64' }} className="rounded p-3 text-sm mb-4">
          {errorMsg}
        </div>
      )}

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
