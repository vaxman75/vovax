import React, { useState, useRef } from 'react';
import { Play, RefreshCw, Wand2 } from 'lucide-react';

// Purpose → script opener/closer templates
const PURPOSE_TEMPLATE = {
  fanmsg:   (msg, lang) => lang === 'he' ? `היי! ${msg} תראו אתכם שם 🙌 — רון` : `Hey! ${msg} See you there — Ron`,
  social:   (msg, _)    => msg,
  announce: (msg, lang) => lang === 'he' ? `יש לי הכרזה — ${msg}` : `I have an announcement — ${msg}`,
  explain:  (msg, _)    => msg,
};

// Tone → pacing note appended to the script meta (for reference, not sent to API)
const TONE_LABEL = {
  energetic: 'אנרגטי',
  pro:       'מקצועי',
  direct:    'ישיר',
  warm:      'חם ואישי',
};

function buildScript({ purpose, tone: _tone, message, lang }) {
  if (!message.trim()) return '';
  const fn = PURPOSE_TEMPLATE[purpose] || PURPOSE_TEMPLATE.social;
  return fn(message.trim(), lang);
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

const HISTORY_KEY = 'vovax_heygen_history';
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

export default function HeyGen() {
  // Guided form
  const [purpose, setPurpose] = useState('fanmsg');
  const [tone, setTone] = useState('direct');
  const [message, setMessage] = useState('');
  const [lang, setLang] = useState('he');

  // Script (the "prompt" equivalent for HeyGen)
  const [script, setScript] = useState('');
  const scriptManualRef = useRef(false);

  // Avatar / voice settings
  const [avatarId, setAvatarId] = useState('');
  const [voiceId, setVoiceId] = useState('');

  // Generation state
  const [status, setStatus] = useState('idle');
  const [attempt, setAttempt] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const pollRef = useRef(null);

  const handleGuided = (field, val) => {
    const next = { purpose, tone, message, lang, [field]: val };
    if (field === 'purpose') setPurpose(val);
    if (field === 'tone')    setTone(val);
    if (field === 'message') setMessage(val);
    if (field === 'lang')    setLang(val);
    if (!scriptManualRef.current) {
      setScript(buildScript(next));
    }
  };

  const handleScriptChange = (val) => {
    scriptManualRef.current = true;
    setScript(val);
  };

  const rebuildScript = () => {
    scriptManualRef.current = false;
    setScript(buildScript({ purpose, tone, message, lang }));
  };

  const saveHistory = (next) => {
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 10))); } catch {}
  };

  const pollStatus = (videoId) => {
    let attempts = 0;
    setStatus('polling');
    pollRef.current = setInterval(async () => {
      attempts++;
      setAttempt(attempts);
      try {
        const r = await fetch(`/api/heygen/status/${videoId}`);
        const data = await r.json();
        const s = data.data?.status;
        if (s === 'completed') {
          clearInterval(pollRef.current);
          const url = data.data?.video_url;
          setVideoUrl(url);
          setStatus('done');
          saveHistory([{ id: uid(), url, script: script.slice(0, 60), date: new Date().toISOString() }, ...history]);
        } else if (s === 'failed') {
          clearInterval(pollRef.current);
          setStatus('error');
          setErrorMsg(data.data?.error || 'HeyGen דיווח על כשלון');
        } else if (attempts >= 60) {
          clearInterval(pollRef.current);
          setStatus('error');
          setErrorMsg('עברו כמה דקות בלי תוצאה');
        }
      } catch { clearInterval(pollRef.current); setStatus('error'); setErrorMsg('בדיקת סטטוס נכשלה'); }
    }, 8000);
  };

  const generate = async () => {
    if (!script.trim()) { setErrorMsg('צריך תסריט — ענה על השאלות למטה'); return; }
    if (!avatarId.trim()) { setErrorMsg('צריך Avatar ID מחשבון HeyGen שלך'); return; }
    setStatus('submitting'); setErrorMsg(null); setVideoUrl(null); setAttempt(0);

    const payload = {
      video_inputs: [{
        character: { type: 'avatar', avatar_id: avatarId.trim(), avatar_style: 'normal' },
        voice: {
          type: 'text',
          input_text: script,
          ...(voiceId.trim() ? { voice_id: voiceId.trim() } : {}),
          speed: tone === 'energetic' ? 1.1 : tone === 'warm' ? 0.95 : 1.0,
        },
        background: { type: 'color', value: '#0A0A0C' },
      }],
      title: `VOVAX · ${TONE_LABEL[tone]} · ${new Date().toLocaleDateString('he-IL')}`,
      caption: false,
      dimension: { width: 1280, height: 720 },
    };

    try {
      const r = await fetch('/api/heygen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      const videoId = data.data?.video_id;
      if (videoId) pollStatus(videoId);
      else { setStatus('error'); setErrorMsg(data.message || data.error || 'לא התקבל video_id'); }
    } catch { setStatus('error'); setErrorMsg('הבקשה לשרת נכשלה'); }
  };

  const busy = status === 'submitting' || status === 'polling';

  return (
    <div className="max-w-xl mx-auto px-5 py-8">
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · RON — HEYGEN
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold mb-1">וידאו אווטאר</h1>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-5">HeyGen דרך שרת ה-proxy — ללא CORS</p>

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
            { value: 'fanmsg',   label: 'הודעה לקהל' },
            { value: 'announce', label: 'הכרזה על הופעה' },
            { value: 'social',   label: 'פוסט לרשתות' },
            { value: 'explain',  label: 'הסבר / שירות' },
          ]}
        />

        <FieldLabel>2. טון הדיבור?</FieldLabel>
        <RadioGroup
          value={tone}
          onChange={(v) => handleGuided('tone', v)}
          options={[
            { value: 'energetic', label: 'אנרגטי' },
            { value: 'direct',    label: 'ישיר' },
            { value: 'pro',       label: 'מקצועי' },
            { value: 'warm',      label: 'חם ואישי' },
          ]}
        />

        <FieldLabel>3. מה תרצה להגיד? (הכוונה המרכזית)</FieldLabel>
        <textarea
          dir="rtl"
          value={message}
          onChange={(e) => handleGuided('message', e.target.value)}
          rows={2}
          style={S}
          className="w-full rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          placeholder='למשל: "אנחנו מגיעים לגגרין ב-4.9, תבואו"'
        />

        <FieldLabel>4. שפה?</FieldLabel>
        <RadioGroup
          value={lang}
          onChange={(v) => handleGuided('lang', v)}
          options={[
            { value: 'he', label: 'עברית' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>

      {/* Script (auto-built) */}
      <div className="flex items-center justify-between mb-1">
        <FieldLabel>תסריט (נבנה אוטומטית מהשאלות)</FieldLabel>
        {scriptManualRef.current && (
          <button onClick={rebuildScript} style={{ color: '#46C7FF' }} className="flex items-center gap-1 text-xs mb-1">
            <Wand2 size={12} /> בנה מחדש מהשאלות
          </button>
        )}
      </div>
      <textarea
        dir="rtl"
        value={script}
        onChange={(e) => handleScriptChange(e.target.value)}
        rows={3}
        style={S}
        className="w-full rounded px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        placeholder="הטקסט שהאווטאר ידבר..."
      />

      {/* Avatar / Voice settings */}
      <div style={{ background: '#0E0E11', border: '1px solid #232326', borderRadius: 8 }} className="p-4 mb-5">
        <p style={{ color: '#8B8A85', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-widest mb-3">
          הגדרות HeyGen
        </p>
        <FieldLabel>Avatar ID (מחשבון HeyGen שלך)</FieldLabel>
        <input
          dir="ltr"
          value={avatarId}
          onChange={(e) => setAvatarId(e.target.value)}
          style={S}
          className="w-full rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          placeholder="למשל: Angela-inblackskirt-20220820"
        />
        <FieldLabel>Voice ID (אופציונלי — ברירת מחדל של HeyGen אם ריק)</FieldLabel>
        <input
          dir="ltr"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          style={S}
          className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
          placeholder="אופציונלי"
        />
      </div>

      <button
        onClick={generate}
        disabled={busy}
        style={{ background: busy ? '#232326' : '#46C7FF', color: busy ? '#8B8A85' : '#0A0A0C' }}
        className="rounded px-4 py-3 text-sm font-semibold w-full flex items-center justify-center gap-2 mb-4"
      >
        {status === 'submitting' && <><RefreshCw size={16} className="animate-spin" /> שולח בקשה...</>}
        {status === 'polling'    && <><RefreshCw size={16} className="animate-spin" /> מייצר וידאו... ({attempt}/60)</>}
        {!busy                   && <><Play size={16} /> צור וידאו</>}
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
                <div style={{ color: '#8B8A85' }} className="text-xs mb-1">{h.script}...</div>
                {h.url && <video controls src={h.url} className="w-full rounded" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
