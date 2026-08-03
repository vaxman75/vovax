import React, { useState, useCallback, useRef } from 'react';
import { Settings, Play, RefreshCw, Wand2 } from 'lucide-react';

// Context → BPM fallback + energy descriptor (used when no explicit BPM selected)
const CONTEXT_MAP = {
  peak:       { bpm: 127, energy: 'peak-hour energy, maximum floor impact, relentless drive, tension never fully releasing' },
  opening:    { bpm: 121, energy: 'building tension, hypnotic groove, slow energy rise' },
  chill:      { bpm: 112, energy: 'deep atmospheric, meditative flow, reduced kick intensity, wide ambient space' },
  irrelevant: { bpm: 124, energy: '' },
};

const PURPOSE_MAP = {
  single:  '',
  videobg: 'cinematic visual support, wide spatial feel, score-like progression',
  djset:   'DJ-friendly extended intro and outro, clear 8-bar phrases',
  other:   '',
};

const BPM_BUTTONS = [122, 124, 125, 126, 127, 128, 130];

const PLATFORM_MAP = {
  tiktok:     { seconds: 120, label: 'TikTok',     duration: '~2:00' },
  spotify:    { seconds: 180, label: 'Spotify',    duration: '~3:00' },
  soundcloud: { seconds: 210, label: 'SoundCloud', duration: '~3:30' },
  club:       { seconds: 240, label: 'Club / DJ',  duration: '~4:00' },
};

function weirdnessLabel(v) {
  if (v <= 25) return { label: 'קונבנציונלי', desc: 'Heavy melodic techno טהור — Tale Of Us · Anyma · ARTBAT', color: '#46C7FF' };
  if (v <= 50) return { label: 'מאוזן',        desc: 'Twist קל — Stephan Bodzin, subtle IDM touches', color: '#22C55E' };
  if (v <= 75) return { label: 'ניסיוני',       desc: 'IDM elements, מבנה לא סטנדרטי — SPFDJ, Drumcode edge', color: '#F59E0B' };
  return         { label: 'כאוטי',         desc: 'Glitch / industrial / avant-garde — off-genre territory', color: '#EF4444' };
}

function weirdnessPrompt(v) {
  if (v <= 10) return '';
  if (v <= 25) return 'conventional structured arrangement, pure genre adherence';
  if (v <= 50) return 'subtle unexpected textural variations, slight experimental touches';
  if (v <= 75) return 'experimental sound design, unconventional rhythmic breaks, IDM-influenced elements';
  return 'chaotic glitch elements, industrial noise, avant-garde deconstructed structure';
}

function energyLabel(v) {
  if (v <= 25) return { label: 'נמוך — Breakdown', desc: 'אמביינט, אטמוספרי, מינימלי — פותח סט, after-peak chill', color: '#8B8A85' };
  if (v <= 50) return { label: 'בינוני — Groove',   desc: 'גרוב יציב, mid-set — 120–124 BPM', color: '#46C7FF' };
  if (v <= 75) return { label: 'גבוה — Drive',      desc: 'אינטנסיבי, בנייה לשיא — 125–127 BPM', color: '#22C55E' };
  return         { label: 'מקסימלי — Peak',    desc: 'שעת פיק, maximum floor impact, relentless — 127–128 BPM', color: '#EF4444' };
}

function energyPrompt(v) {
  if (v <= 25) return 'low-energy atmospheric breakdown, minimal percussion, wide meditative ambient space';
  if (v <= 50) return 'hypnotic groove-focused mid-set energy, steady building tension';
  if (v <= 75) return 'high-drive intensity, relentless momentum, pre-peak floor pressure';
  return 'peak-hour maximum impact, relentless four-on-the-floor drive, tension never fully releasing';
}

function calcBars(seconds, bpm) {
  return Math.round((seconds / 60) * bpm / 4);
}

function buildPrompt({ purpose, mood, reference, context, bpmOverride, weirdness, energyLevel }) {
  const effectiveBpm = bpmOverride ?? CONTEXT_MAP[context]?.bpm ?? 124;
  const contextEnergy = CONTEXT_MAP[context]?.energy || '';
  const parts = [
    'Heavy melodic techno',
    `${effectiveBpm} BPM`,
    'G minor',
    'rolling hypnotic bassline',
    'dark atmospheric pads',
    'driving four-on-the-floor kick',
  ];
  // Energy: explicit slider overrides context-hour energy
  const ep = energyPrompt(energyLevel ?? 75);
  if (energyLevel !== null && ep) {
    parts.push(ep);
  } else if (contextEnergy) {
    parts.push(contextEnergy);
  }
  const wp = weirdnessPrompt(weirdness ?? 0);
  if (wp) parts.push(wp);
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

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ border: `1px solid ${active ? '#46C7FF' : '#232326'}`, color: active ? '#46C7FF' : '#8B8A85', background: active ? '#0D1A20' : 'transparent' }}
      className="rounded px-3 py-1 text-xs">
      {children}
    </button>
  );
}

export default function AceStep() {
  // ── Guided builder state ──────────────────────────────────────────────────
  const [purpose, setPurpose]       = useState('single');
  const [mood, setMood]             = useState('');
  const [reference, setReference]   = useState('');
  const [context, setContext]       = useState('peak');
  const [bpmOverride, setBpmOverride] = useState(null);   // null = use context BPM
  const [weirdness, setWeirdness]   = useState(0);         // 0–100
  const [energyLevel, setEnergyLevel] = useState(null);   // null = use context energy
  const [trackLength, setTrackLength] = useState(null);   // platform key or null

  // ── Prompt ────────────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(() =>
    buildPrompt({ purpose: 'single', mood: '', reference: '', context: 'peak', bpmOverride: null, weirdness: 0, energyLevel: null })
  );
  const promptManualRef = useRef(false);

  const rebuildPrompt = useCallback((overrides = {}) => {
    if (promptManualRef.current) return;
    setPrompt(buildPrompt({ purpose, mood, reference, context, bpmOverride, weirdness, energyLevel, ...overrides }));
  }, [purpose, mood, reference, context, bpmOverride, weirdness, energyLevel]);

  const handlePurpose  = (v) => { setPurpose(v);      rebuildPrompt({ purpose: v }); };
  const handleMood     = (v) => { setMood(v);         rebuildPrompt({ mood: v }); };
  const handleReference= (v) => { setReference(v);   rebuildPrompt({ reference: v }); };
  const handleContext  = (v) => { setContext(v);      rebuildPrompt({ context: v }); };
  const handleBpm      = (v) => {
    const next = bpmOverride === v ? null : v;
    setBpmOverride(next);
    rebuildPrompt({ bpmOverride: next });
  };
  const handleWeirdness = (v) => { setWeirdness(v);  rebuildPrompt({ weirdness: v }); };
  const handleEnergy    = (v) => {
    const next = v === null ? null : Number(v);
    setEnergyLevel(next);
    rebuildPrompt({ energyLevel: next });
  };
  const handlePlatform  = (key) => {
    const next = trackLength === key ? null : key;
    setTrackLength(next);
    if (next) setDuration(PLATFORM_MAP[next].seconds);
  };

  const handlePromptEdit = (v) => { promptManualRef.current = true; setPrompt(v); };
  const resetPrompt = () => {
    promptManualRef.current = false;
    setPrompt(buildPrompt({ purpose, mood, reference, context, bpmOverride, weirdness, energyLevel }));
  };

  // ── Generation state ──────────────────────────────────────────────────────
  const [model, setModel]           = useState('ace-step-xl');
  const [showSettings, setShowSettings] = useState(false);
  const [lyrics, setLyrics]         = useState('');
  const [duration, setDuration]     = useState(60);
  const [batchSize, setBatchSize]   = useState(1);
  const [status, setStatus]         = useState('idle');
  const [attempt, setAttempt]       = useState(0);
  const [results, setResults]       = useState([]);
  const [errorMsg, setErrorMsg]     = useState(null);
  const [history, setHistory]       = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const pollRef = useRef(null);
  const [qaStatus, setQaStatus]     = useState('idle');
  const [qaResult, setQaResult]     = useState(null);

  const saveHistory = (next) => {
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 20))); } catch {}
  };

  const runQA = async (urls, promptText, brief) => {
    setQaStatus('loading');
    try {
      const r = await fetch('/api/acestep/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, brief, urls }),
      });
      const data = await r.json();
      setQaResult(data);
      setQaStatus('done');
    } catch {
      setQaStatus('error');
    }
  };

  const pollStatus = (requestId, brief) => {
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
          runQA(urls, prompt, brief);
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
    setQaStatus('idle'); setQaResult(null);
    try {
      const body = { model, prompt, lyrics, duration: Number(duration) || 30, batch_size: Number(batchSize) || 1 };
      const r = await fetch('/api/acestep/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.request_id) pollStatus(data.request_id, { purpose, mood, reference, context });
      else { setStatus('error'); setErrorMsg(data.message || data.error || 'לא התקבל request_id'); }
    } catch {
      setStatus('error'); setErrorMsg('הבקשה לשרת נכשלה');
    }
  };

  const busy = status === 'submitting' || status === 'polling';
  const effectiveBpm = bpmOverride ?? CONTEXT_MAP[context]?.bpm ?? 124;
  const wLabel = weirdnessLabel(weirdness);
  const eLabel = energyLabel(energyLevel ?? 75);

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
      <div style={{ background: '#0D0D10', border: '1px solid #1E1E22' }} className="rounded p-4 mb-5 space-y-5">
        <div style={{ color: '#8B8A85', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em' }} className="text-xs uppercase">
          הקשר היצירה
        </div>

        {/* Q1 — Purpose */}
        <div>
          <FieldLabel>1. מה זה בשביל?</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {[['single','סינגל חדש'],['videobg','רקע לקליפ'],['djset','סט DJ'],['other','אחר']].map(([v, label]) => (
              <Chip key={v} active={purpose === v} onClick={() => handlePurpose(v)}>{label}</Chip>
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

        {/* Q4 — Context / Hour */}
        <div>
          <FieldLabel>4. לאיזו שעה / הקשר?</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {[['peak','שעת פיק'],['opening','פתיחת סט'],['chill','רקע רגוע'],['irrelevant','לא רלוונטי']].map(([v, label]) => (
              <Chip key={v} active={context === v} onClick={() => handleContext(v)}>{label}</Chip>
            ))}
          </div>
          <p style={{ color: '#8B8A85' }} className="text-xs mt-1">
            {context === 'peak'       && `BPM: ${CONTEXT_MAP.peak.bpm} · אנרגיה מקסימלית, פלור אימפקט`}
            {context === 'opening'    && `BPM: ${CONTEXT_MAP.opening.bpm} · בנייה הדרגתית, גרוב היפנוטי`}
            {context === 'chill'      && `BPM: ${CONTEXT_MAP.chill.bpm} · אמביינט עמוק, קיק מרוסן, מרחב רחב`}
            {context === 'irrelevant' && `BPM: ${CONTEXT_MAP.irrelevant.bpm} · ברירת מחדל`}
          </p>
        </div>

        {/* Q5 — BPM (explicit buttons, overrides context BPM) */}
        <div>
          <FieldLabel>5. BPM — בחר ישירות (אופציונלי, עוקף הקשר-שעה)</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {BPM_BUTTONS.map(b => (
              <Chip key={b} active={bpmOverride === b} onClick={() => handleBpm(b)}>{b}</Chip>
            ))}
          </div>
          <p style={{ color: '#8B8A85' }} className="text-xs mt-1">
            {bpmOverride
              ? `BPM ידני: ${bpmOverride} · לחץ שוב לביטול ↩`
              : `BPM פעיל: ${effectiveBpm} (מהקשר-שעה)`}
          </p>
        </div>

        {/* Q6 — Weirdness / Unconventional */}
        <div>
          <FieldLabel>6. כמה לא-קונבנציונלי? ({weirdness}%)</FieldLabel>
          <input type="range" min={0} max={100} value={weirdness}
            onChange={e => handleWeirdness(Number(e.target.value))}
            className="w-full accent-cyan-400 mb-2" />
          <div className="flex items-center gap-2">
            <span style={{ color: wLabel.color, fontWeight: 600 }} className="text-xs">{wLabel.label}</span>
            <span style={{ color: '#8B8A85' }} className="text-xs">— {wLabel.desc}</span>
          </div>
        </div>

        {/* Q7 — Energy Intensity */}
        <div>
          <FieldLabel>
            7. עוצמת אנרגיה ({energyLevel !== null ? `${energyLevel}%` : 'לפי הקשר-שעה'})
            {energyLevel !== null && (
              <button onClick={() => handleEnergy(null)} style={{ color: '#46C7FF' }} className="ml-2 text-xs">↩ איפוס</button>
            )}
          </FieldLabel>
          <input type="range" min={0} max={100}
            value={energyLevel ?? 75}
            onChange={e => handleEnergy(e.target.value)}
            className="w-full accent-cyan-400 mb-2" />
          <div className="flex items-center gap-2">
            <span style={{ color: eLabel.color, fontWeight: 600 }} className="text-xs">{eLabel.label}</span>
            <span style={{ color: '#8B8A85' }} className="text-xs">— {eLabel.desc}</span>
          </div>
        </div>

        {/* Q8 — Track length by platform */}
        <div>
          <FieldLabel>8. אורך טראק לפי פלטפורמה</FieldLabel>
          <div className="flex gap-2 flex-wrap mb-2">
            {Object.entries(PLATFORM_MAP).map(([key, p]) => {
              const bars = calcBars(p.seconds, effectiveBpm);
              return (
                <Chip key={key} active={trackLength === key} onClick={() => handlePlatform(key)}>
                  {p.label} {p.duration}
                </Chip>
              );
            })}
          </div>
          {trackLength && (() => {
            const p = PLATFORM_MAP[trackLength];
            const bars = calcBars(p.seconds, effectiveBpm);
            return (
              <p style={{ color: '#8B8A85' }} className="text-xs">
                {p.label} · {p.duration} · {p.seconds}s · ~{bars} בארים @ {effectiveBpm} BPM
              </p>
            );
          })()}
          {!trackLength && (
            <p style={{ color: '#8B8A85' }} className="text-xs">לא נבחרה פלטפורמה — משך ידני למטה</p>
          )}
        </div>
      </div>

      {/* ── Craft guide ── */}
      <div style={{ background: '#0A0A0C', border: '1px solid #1A1A1E' }} className="rounded px-3 py-2 mb-4">
        <div style={{ color: '#46C7FF', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.08em' }} className="text-xs mb-1">
          סטנדרט מלאכה — Tale Of Us · Anyma · ARTBAT · Stephan Bodzin
        </div>
        <div style={{ color: '#8B8A85' }} className="text-xs">
          סולם מינורי מדויק · rolling bassline · dark pads · four-on-the-floor kick · big reverb · professional club-ready mix
        </div>
      </div>

      {/* ── Prompt textarea ── */}
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
          <FieldLabel>משך (שניות{trackLength ? ` · ${PLATFORM_MAP[trackLength].label}` : ''})</FieldLabel>
          <input type="number" dir="ltr" value={duration} onChange={e => { setDuration(e.target.value); setTrackLength(null); }}
            style={S} className="w-full rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <FieldLabel>וריאציות (1–4)</FieldLabel>
          <input type="number" min={1} max={4} dir="ltr" value={batchSize} onChange={e => setBatchSize(e.target.value)}
            style={S} className="w-full rounded px-3 py-2 text-sm" />
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

      {/* ── טליה QA verdict ── */}
      {status === 'done' && qaStatus !== 'idle' && (
        <div style={{
          background: '#0D0D10',
          border: `1px solid ${
            qaStatus !== 'done'                      ? '#232326' :
            qaResult?.verdict === 'APPROVED'         ? '#166534' :
            qaResult?.verdict === 'REJECTED'         ? '#991B1B' : '#92400E'
          }`,
        }} className="rounded p-4 mb-4">
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em' }} className="text-xs uppercase mb-2 flex items-center gap-2">
            <span style={{ color: '#8B8A85' }}>טליה — QA</span>
            {qaStatus === 'loading' && <RefreshCw size={12} className="animate-spin" style={{ color: '#8B8A85' }} />}
            {qaStatus === 'done' && qaResult?.verdict && (
              <span style={{ color: qaResult.verdict === 'APPROVED' ? '#22C55E' : qaResult.verdict === 'REJECTED' ? '#EF4444' : '#F59E0B', fontWeight: 700 }}>
                {qaResult.verdict === 'APPROVED' ? '✓ אושר' : qaResult.verdict === 'REJECTED' ? '✗ נדחה' : '⚠ דורש תיקון'}
              </span>
            )}
            {qaStatus === 'error' && <span style={{ color: '#EF4444' }}>שגיאת QA</span>}
          </div>
          {qaStatus === 'loading' && <p style={{ color: '#8B8A85' }} className="text-xs">טליה בודקת את הפלט...</p>}
          {qaStatus === 'done' && qaResult && (
            <>
              <p style={{ color: '#F2F1ED' }} className="text-sm mb-3">{qaResult.summary}</p>
              <div className="space-y-1 mb-1">
                {Object.entries(qaResult.criteria || {}).map(([key, val]) => (
                  <div key={key} className="flex items-start gap-2 text-xs">
                    <span style={{ color: val.status === 'PASS' ? '#22C55E' : val.status === 'FAIL' ? '#EF4444' : val.status === 'LISTEN_REQUIRED' ? '#46C7FF' : '#F59E0B', minWidth: 14, flexShrink: 0 }}>
                      {val.status === 'PASS' ? '✓' : val.status === 'FAIL' ? '✗' : val.status === 'LISTEN_REQUIRED' ? '👂' : '⚠'}
                    </span>
                    <span style={{ color: '#8B8A85' }}><strong style={{ color: '#F2F1ED' }}>{key.replace(/_/g, ' ')}</strong> — {val.note}</span>
                  </div>
                ))}
              </div>
              {qaResult.fix_if_rejected && (
                <div style={{ background: '#131316', border: '1px solid #232326', color: '#F59E0B' }} className="rounded p-2 mt-3 text-xs">
                  תיקון מוצע: {qaResult.fix_if_rejected}
                </div>
              )}
            </>
          )}
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
