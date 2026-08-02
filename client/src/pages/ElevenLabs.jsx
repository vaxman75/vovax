import React, { useState, useRef, useEffect } from 'react';
import { Play, RefreshCw, Wand2, Save } from 'lucide-react';

const PURPOSE_TEMPLATE = {
  fanmsg:   (msg, lang) => lang === 'he' ? `היי! ${msg} — רון` : `Hey! ${msg} — Ron`,
  announce: (msg, lang) => lang === 'he' ? `יש לי הכרזה — ${msg}` : `I have an announcement — ${msg}`,
  voiceover:(msg, _)    => msg,
  social:   (msg, _)    => msg,
};

const TONE_STABILITY  = { energetic: 0.30, direct: 0.50, pro: 0.65, warm: 0.75 };
const TONE_SIMILARITY = { energetic: 0.85, direct: 0.80, pro: 0.80, warm: 0.70 };

function buildText({ purpose, message, lang }) {
  if (!message.trim()) return '';
  const fn = PURPOSE_TEMPLATE[purpose] || PURPOSE_TEMPLATE.social;
  return fn(message.trim(), lang);
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

const HISTORY_KEY = 'vovax_elevenlabs_history';
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

export default function ElevenLabs() {
  // Guided form
  const [purpose, setPurpose] = useState('fanmsg');
  const [tone, setTone]       = useState('direct');
  const [message, setMessage] = useState('');
  const [lang, setLang]       = useState('he');

  // Script
  const [text, setText] = useState('');
  const textManualRef = useRef(false);

  // Voice selection
  const [voices, setVoices]   = useState([]);
  const [voiceId, setVoiceId] = useState('');
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Settings
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsOpen, setSettingsOpen]   = useState(false);

  // Generation
  const [status, setStatus]   = useState('idle');
  const [audioUrl, setAudioUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });

  // Load saved voice_id + try to fetch voices on mount
  useEffect(() => {
    fetch('/api/elevenlabs/settings')
      .then((r) => r.json())
      .then((s) => { if (s.voice_id) setVoiceId(s.voice_id); })
      .catch(() => {});

    fetch('/api/elevenlabs/voices')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.voices)) {
          setVoices(data.voices);
          setVoicesLoaded(true);
        }
      })
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    await fetch('/api/elevenlabs/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice_id: voiceId }),
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const handleGuided = (field, val) => {
    const next = { purpose, tone, message, lang, [field]: val };
    if (field === 'purpose') setPurpose(val);
    if (field === 'tone')    setTone(val);
    if (field === 'message') setMessage(val);
    if (field === 'lang')    setLang(val);
    if (!textManualRef.current) setText(buildText(next));
  };

  const handleTextChange = (val) => { textManualRef.current = true; setText(val); };
  const rebuildText = () => { textManualRef.current = false; setText(buildText({ purpose, tone, message, lang })); };

  const saveHistory = (entry) => {
    const next = [entry, ...history].slice(0, 10);
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
  };

  const generate = async () => {
    if (!text.trim())    { setErrorMsg('צריך טקסט — ענה על השאלות למטה'); return; }
    if (!voiceId.trim()) { setErrorMsg('צריך Voice ID — הגדר בהגדרות למטה'); return; }
    setStatus('generating'); setErrorMsg(null); setAudioUrl(null);

    try {
      const r = await fetch('/api/elevenlabs/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_id: voiceId.trim(),
          text,
          model_id: lang === 'he' ? 'eleven_multilingual_v2' : 'eleven_monolingual_v1',
          voice_settings: {
            stability: TONE_STABILITY[tone] ?? 0.5,
            similarity_boost: TONE_SIMILARITY[tone] ?? 0.8,
          },
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }));
        setStatus('error'); setErrorMsg(err.error || 'שגיאה מ-ElevenLabs'); return;
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setStatus('done');
      saveHistory({ id: uid(), text: text.slice(0, 60), url, date: new Date().toISOString() });
    } catch { setStatus('error'); setErrorMsg('הבקשה לשרת נכשלה'); }
  };

  const busy = status === 'generating';

  return (
    <div className="max-w-xl mx-auto px-5 py-8">
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · RON — ELEVENLABS
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold mb-1">דיבוב AI</h1>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-5">ElevenLabs TTS דרך שרת ה-proxy — ללא CORS</p>

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-6" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14"
          fill="none" stroke="#46C7FF" strokeWidth="1.5" className="pulse-line" />
      </svg>

      {/* Guided questionnaire */}
      <div style={{ background: '#0E0E11', border: '1px solid #232326', borderRadius: 8 }} className="p-4 mb-5">
        <p style={{ color: '#46C7FF', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-widest mb-4">
          כמה שאלות לפני שיוצרים
        </p>

        <FieldLabel>1. מה זה בשביל?</FieldLabel>
        <RadioGroup value={purpose} onChange={(v) => handleGuided('purpose', v)} options={[
          { value: 'fanmsg',    label: 'הודעה לקהל' },
          { value: 'announce',  label: 'הכרזה על הופעה' },
          { value: 'voiceover', label: 'ווייסאובר לוידאו' },
          { value: 'social',    label: 'פוסט לרשתות' },
        ]} />

        <FieldLabel>2. טון הדיבור?</FieldLabel>
        <RadioGroup value={tone} onChange={(v) => handleGuided('tone', v)} options={[
          { value: 'energetic', label: 'אנרגטי' },
          { value: 'direct',    label: 'ישיר' },
          { value: 'pro',       label: 'מקצועי' },
          { value: 'warm',      label: 'חם ואישי' },
        ]} />

        <FieldLabel>3. מה תרצה להגיד? (הכוונה המרכזית)</FieldLabel>
        <textarea
          dir="rtl" value={message} onChange={(e) => handleGuided('message', e.target.value)}
          rows={2} style={S}
          className="w-full rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          placeholder='למשל: "אנחנו מגיעים לגגרין ב-4.9, תבואו"'
        />

        <FieldLabel>4. שפה?</FieldLabel>
        <RadioGroup value={lang} onChange={(v) => handleGuided('lang', v)} options={[
          { value: 'he', label: 'עברית' },
          { value: 'en', label: 'English' },
        ]} />
      </div>

      {/* Text (auto-built) */}
      <div className="flex items-center justify-between mb-1">
        <FieldLabel>טקסט לדיבוב (נבנה אוטומטית מהשאלות)</FieldLabel>
        {textManualRef.current && (
          <button onClick={rebuildText} style={{ color: '#46C7FF' }} className="flex items-center gap-1 text-xs mb-1">
            <Wand2 size={12} /> בנה מחדש מהשאלות
          </button>
        )}
      </div>
      <textarea
        dir="rtl" value={text} onChange={(e) => handleTextChange(e.target.value)}
        rows={3} style={S}
        className="w-full rounded px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        placeholder="הטקסט שידובב..."
      />

      {/* Voice selection */}
      <div className="mb-5">
        <FieldLabel>קול (Voice)</FieldLabel>
        {voicesLoaded && voices.length > 0 ? (
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            style={S}
            className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="">— בחר קול —</option>
            {voices.map((v) => (
              <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
            ))}
          </select>
        ) : (
          <input
            dir="ltr" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
            style={S} className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            placeholder="Voice ID מחשבון ElevenLabs שלך"
          />
        )}
      </div>

      {/* Settings panel */}
      <div style={{ background: '#0E0E11', border: '1px solid #232326', borderRadius: 8 }} className="mb-5">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          style={{ color: '#8B8A85', width: '100%', textAlign: 'right' }}
          className="flex items-center justify-between px-4 py-3 text-xs uppercase tracking-widest"
        >
          <span style={{ color: settingsOpen ? '#46C7FF' : '#8B8A85' }}>הגדרות ElevenLabs</span>
          <span>{settingsOpen ? '▲' : '▼'}</span>
        </button>

        {settingsOpen && (
          <div className="px-4 pb-4">
            <p style={{ color: '#8B8A85' }} className="text-xs mb-3">
              Voice ID ברירת המחדל נשמר ב-DB. ELEVENLABS_API_KEY נשמר ב-Railway Variables.
            </p>
            <FieldLabel>Voice ID ברירת מחדל</FieldLabel>
            <input
              dir="ltr" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
              style={S} className="w-full rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="Voice ID מחשבון ElevenLabs שלך"
            />
            <button
              onClick={saveSettings}
              style={{ background: settingsSaved ? '#22c55e' : '#46C7FF', color: '#0A0A0C' }}
              className="rounded px-4 py-2 text-sm font-semibold flex items-center gap-2"
            >
              <Save size={14} /> {settingsSaved ? 'נשמר ✓' : 'שמור הגדרות'}
            </button>
          </div>
        )}
      </div>

      <button
        onClick={generate} disabled={busy}
        style={{ background: busy ? '#232326' : '#46C7FF', color: busy ? '#8B8A85' : '#0A0A0C' }}
        className="rounded px-4 py-3 text-sm font-semibold w-full flex items-center justify-center gap-2 mb-4"
      >
        {busy  && <><RefreshCw size={16} className="animate-spin" /> מדבב...</>}
        {!busy && <><Play size={16} /> צור דיבוב</>}
      </button>

      {errorMsg && (
        <div style={{ background: '#131316', border: '1px solid #FF5A64', color: '#FF5A64' }} className="rounded p-3 text-sm mb-4">
          {errorMsg}
        </div>
      )}

      {status === 'done' && audioUrl && (
        <div style={{ background: '#131316', border: '1px solid #232326' }} className="rounded p-4 mb-6">
          <p style={{ color: '#8B8A85' }} className="text-xs mb-2">תוצאה</p>
          <audio controls src={audioUrl} className="w-full" />
          <a
            href={audioUrl} download={`vovax_tts_${Date.now()}.mp3`}
            style={{ color: '#46C7FF' }} className="text-xs mt-2 block"
          >
            הורד MP3
          </a>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 style={{ color: '#8B8A85', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-wide mb-2">היסטוריה</h2>
          <div className="space-y-2">
            {history.slice(0, 5).map((h) => (
              <div key={h.id} style={{ background: '#131316', border: '1px solid #232326' }} className="rounded p-3">
                <div style={{ color: '#8B8A85' }} className="text-xs mb-2">{h.text}...</div>
                {h.url && <audio controls src={h.url} className="w-full" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
