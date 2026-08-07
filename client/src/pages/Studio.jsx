import React, { useState, useRef, useEffect } from 'react';

const MAJOR_KEYS = ['E', 'C', 'D'];
const MINOR_KEYS = ['G', 'F', 'B', 'A', 'D'];
const REFERENCE_ARTISTS = ['Tale Of Us', 'Anyma', 'ARTBAT', 'Stephan Bodzin', 'Adriatique', 'Colyn', 'Innellea', 'Yotto'];

const CONTEXT_MAP = {
  peak:       { bpm: 127, label: 'Peak Hour' },
  opening:    { bpm: 121, label: 'Opening' },
  chill:      { bpm: 112, label: 'Chill' },
  irrelevant: { bpm: 124, label: 'לא רלוונטי' },
};

const BPM_BUTTONS = [122, 124, 125, 126, 127, 128, 130];

const PLATFORM_MAP = {
  tiktok:     { seconds: 120, label: 'TikTok',     duration: '~2:00' },
  spotify:    { seconds: 180, label: 'Spotify',    duration: '~3:00' },
  soundcloud: { seconds: 210, label: 'SoundCloud', duration: '~3:30' },
  club:       { seconds: 240, label: 'Club / DJ',  duration: '~4:00' },
};

function weirdnessLabel(v) {
  if (v <= 25) return { label: 'קונבנציונלי', desc: 'Heavy melodic techno טהור — Tale Of Us · Anyma', color: '#46C7FF' };
  if (v <= 50) return { label: 'מאוזן',        desc: 'Twist קל — Stephan Bodzin, subtle IDM touches', color: '#22C55E' };
  if (v <= 75) return { label: 'ניסיוני',       desc: 'IDM elements, מבנה לא סטנדרטי', color: '#F59E0B' };
  return         { label: 'כאוטי',         desc: 'Glitch / industrial / avant-garde', color: '#EF4444' };
}

function energyLabel(v) {
  if (v <= 25) return { label: 'נמוך — Breakdown', desc: 'אמביינט, אטמוספרי, מינימלי', color: '#8B8A85' };
  if (v <= 50) return { label: 'בינוני — Groove',   desc: 'גרוב יציב, mid-set', color: '#46C7FF' };
  if (v <= 75) return { label: 'גבוה — Drive',      desc: 'אינטנסיבי, בנייה לשיא', color: '#22C55E' };
  return         { label: 'מקסימלי — Peak',    desc: 'שעת פיק, maximum floor impact', color: '#EF4444' };
}

const STUDIOS = {
  studioone: {
    label: 'Studio One Pro',
    lead: 'תום',
    teamDisplay: 'תום • ליאם • עידו',
    desc: 'Scratch Pads, Splice integration, parallel compression — flow מהיר מרעיון לתוצאה',
    color: '#F59E0B',
  },
  cubase: {
    label: 'Cubase 15',
    lead: 'יוני',
    teamDisplay: 'יוני • אור • שי',
    desc: 'Logical Editor, MIDI Remote, Direct Routing — שליטה MIDI מלאה ו-routing מורכב',
    color: '#46C7FF',
  },
};

const S = { background: '#131316', border: '1px solid #232326', color: '#F2F1ED' };

function Chip({ active, onClick, children, color }) {
  const c = color ?? '#46C7FF';
  return (
    <button type="button" onClick={onClick}
      style={{
        border: `1px solid ${active ? c : '#232326'}`,
        color: active ? c : '#8B8A85',
        background: active ? `${c}15` : 'transparent',
        borderRadius: 6,
        padding: '4px 12px',
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}>
      {children}
    </button>
  );
}

// ── Phase 1: Studio choice ────────────────────────────────────────────────────

function StudioChoice({ onSelect, onUpload }) {
  return (
    <div dir="rtl" style={{ maxWidth: 680, margin: '48px auto', padding: '0 20px', fontFamily: "'Space Grotesk', sans-serif", color: '#F2F1ED' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#46C7FF', marginBottom: 6 }}>Studio</h2>
      <p style={{ color: '#8B8A85', fontSize: 13, marginBottom: 36 }}>
        שני אולפנים עצמאיים — כל אחד עם צוות, כלים, ושיטת עבודה שונה. בחר אחד להתחיל.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {Object.entries(STUDIOS).map(([key, s]) => (
          <button key={key} type="button" onClick={() => onSelect(key)}
            style={{
              ...S,
              borderRadius: 12,
              padding: 24,
              textAlign: 'right',
              cursor: 'pointer',
              border: `1px solid ${s.color}33`,
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.background = `${s.color}08`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${s.color}33`; e.currentTarget.style.background = '#131316'; }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: s.color, marginBottom: 8 }}>{s.label}</div>
            <div style={{ color: '#F2F1ED', fontSize: 12, marginBottom: 12, opacity: 0.75 }}>{s.teamDisplay}</div>
            <div style={{ color: '#8B8A85', fontSize: 12, lineHeight: 1.6 }}>{s.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button type="button" onClick={onUpload}
          style={{ background: 'none', border: 'none', color: '#8B8A85', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
          כבר יש לי טראק מוכן — העלה ישירות למאסטרינג (בלי סשן) ←
        </button>
      </div>
    </div>
  );
}

// ── Standalone upload: existing track straight to mastering, no chat session ──

function MasteringUpload({ onBack }) {
  const [title, setTitle]             = useState('');
  const [requestType, setRequestType] = useState('mix');
  const [notes, setNotes]             = useState('');
  const [file, setFile]               = useState(null);
  const [status, setStatus]           = useState(null); // null | 'uploading' | { ok, ... } | { error }
  const fileRef = useRef();

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || !file) return;
    setStatus('uploading');
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('requestType', requestType);
      fd.append('notes', notes.trim());
      fd.append('file', file);
      const r = await fetch('/api/studio/mastering-upload', { method: 'POST', body: fd });
      const data = await r.json();
      setStatus(r.ok ? { ok: true, ...data } : { error: data.error ?? 'שגיאה לא ידועה' });
    } catch (err) {
      setStatus({ error: 'שגיאת רשת: ' + err.message });
    }
  }

  return (
    <div dir="rtl" style={{ maxWidth: 560, margin: '32px auto', padding: '0 20px', fontFamily: "'Space Grotesk', sans-serif", color: '#F2F1ED' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button type="button" onClick={onBack} style={{ color: '#8B8A85', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>← חזרה</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#22C55E' }}>העלאת טראק קיים למאסטרינג</span>
      </div>
      <p style={{ color: '#8B8A85', fontSize: 12, marginBottom: 24 }}>
        לטראק שכבר קיים ורק צריך עזרה במיקס/מאסטרינג — בלי לעבור סשן שיתופי. הקובץ עולה ל-Google Drive
        (תיקיית VOVAX-Mastering-Uploads) ונכנס ישירות לתור של נוי/זיב.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ color: '#8B8A85', fontSize: 12, marginBottom: 6 }}>שם הטראק</div>
          <input value={title} onChange={e => setTitle(e.target.value)} required
            style={{ ...S, width: '100%', borderRadius: 8, padding: '8px 12px', fontSize: 13, boxSizing: 'border-box' }} />
        </div>

        <div>
          <div style={{ color: '#8B8A85', fontSize: 12, marginBottom: 6 }}>סוג בקשה</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['mix', 'מיקס'], ['master', 'מאסטרינג']].map(([v, label]) => (
              <button key={v} type="button" onClick={() => setRequestType(v)}
                style={{
                  border: `1px solid ${requestType === v ? '#22C55E' : '#232326'}`,
                  color: requestType === v ? '#22C55E' : '#8B8A85',
                  background: requestType === v ? '#22C55E15' : 'transparent',
                  borderRadius: 6, padding: '6px 16px', fontSize: 12, cursor: 'pointer',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ color: '#8B8A85', fontSize: 12, marginBottom: 6 }}>קובץ אודיו</div>
          <input ref={fileRef} type="file" accept="audio/*"
            onChange={e => setFile(e.target.files?.[0] ?? null)} required
            style={{ ...S, width: '100%', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxSizing: 'border-box' }} />
          {file && <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>{file.name} — {(file.size / 1024 / 1024).toFixed(1)}MB</div>}
        </div>

        <div>
          <div style={{ color: '#8B8A85', fontSize: 12, marginBottom: 6 }}>הערות <span style={{ color: '#555' }}>(אופציונלי)</span></div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="למשל: הבס חלש מדי, צריך יותר הד על הפאדים..."
            style={{ ...S, width: '100%', borderRadius: 8, padding: 10, minHeight: 70, resize: 'vertical', fontSize: 12, boxSizing: 'border-box' }} />
        </div>

        <button type="submit" disabled={status === 'uploading' || !title.trim() || !file}
          style={{
            background: '#22C55E', color: '#0A0A0C', borderRadius: 8, padding: '12px 0',
            fontWeight: 700, fontSize: 14, border: 'none',
            cursor: (status === 'uploading' || !title.trim() || !file) ? 'not-allowed' : 'pointer',
            opacity: (status === 'uploading' || !title.trim() || !file) ? 0.5 : 1,
          }}>
          {status === 'uploading' ? 'מעלה...' : 'העלה למאסטרינג →'}
        </button>

        {status?.ok && (
          <div style={{ color: '#22C55E', fontSize: 12 }}>
            נשלח לנוי ✓ — ID #{status.entry?.id} · <a href={status.driveLink} target="_blank" rel="noreferrer" style={{ color: '#46C7FF' }}>קובץ ב-Drive</a>
          </div>
        )}
        {status?.error && <div style={{ color: '#EF4444', fontSize: 12 }}>{status.error}</div>}
      </form>
    </div>
  );
}

// ── Phase 2: Session params ───────────────────────────────────────────────────

function SessionParams({ studio, onStart, onBack }) {
  const meta = STUDIOS[studio];
  const [context, setContext]         = useState('peak');
  const [bpmOverride, setBpmOverride] = useState(null);
  const [weirdness, setWeirdness]     = useState(0);
  const [energyLevel, setEnergyLevel] = useState(75);
  const [platform, setPlatform]       = useState('club');
  const [lyrics, setLyrics]           = useState('');
  const [isMajor, setIsMajor]         = useState(false);
  const [keyLetter, setKeyLetter]     = useState('G');
  const [referenceArtist, setReferenceArtist] = useState(REFERENCE_ARTISTS[0]);
  const [suggestion, setSuggestion]   = useState(null);

  useEffect(() => {
    fetch('/api/studio/variation-suggestion')
      .then(r => r.json())
      .then(setSuggestion)
      .catch(() => setSuggestion(null));
  }, []);

  const effectiveBpm = bpmOverride ?? CONTEXT_MAP[context]?.bpm ?? 124;
  const wLabel = weirdnessLabel(weirdness);
  const eLabel = energyLabel(energyLevel);
  const key = `${keyLetter} ${isMajor ? 'major' : 'minor'}`;
  const arrangementEnergy = weirdness > 50 ? 'percussive-tech-leaning' : energyLevel > 70 ? 'festival-anthem' : 'deep-cinematic';
  const hasVocalFeature = lyrics.trim().length > 0;

  function start() {
    const params = { context, bpm: effectiveBpm, weirdness, energyLevel, platform: PLATFORM_MAP[platform]?.label, lyrics, key, referenceArtist };
    fetch('/api/studio/session-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        keySignature: key, isMajor, bpm: effectiveBpm,
        hasVocalFeature, referenceArtist, arrangementEnergy,
        trackRef: `studio-${studio}-${Date.now()}`,
      }),
    }).catch(() => {});
    onStart(params);
  }

  return (
    <div dir="rtl" style={{ maxWidth: 600, margin: '32px auto', padding: '0 20px', fontFamily: "'Space Grotesk', sans-serif", color: '#F2F1ED' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button type="button" onClick={onBack} style={{ color: '#8B8A85', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>← חזרה</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: meta.color }}>{meta.label}</span>
        <span style={{ color: '#8B8A85', fontSize: 12 }}>עם {meta.lead}</span>
      </div>

      {suggestion?.recentAxes && (
        <div style={{ ...S, borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 11, color: '#8B8A85' }}>
          <div style={{ color: '#F59E0B', fontWeight: 700, marginBottom: 4 }}>המלצת גיוון</div>
          {suggestion.recentAxes}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Key */}
        <div>
          <div style={{ color: '#8B8A85', fontSize: 12, marginBottom: 8 }}>סולם (Key)</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <Chip active={!isMajor} onClick={() => setIsMajor(false)} color={meta.color}>Minor</Chip>
            <Chip active={isMajor} onClick={() => setIsMajor(true)} color={meta.color}>Major</Chip>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(isMajor ? MAJOR_KEYS : MINOR_KEYS).map(k => (
              <Chip key={k} active={keyLetter === k} onClick={() => setKeyLetter(k)} color={meta.color}>{k}</Chip>
            ))}
          </div>
        </div>

        {/* Reference artist */}
        <div>
          <div style={{ color: '#8B8A85', fontSize: 12, marginBottom: 8 }}>רפרנס אמן</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {REFERENCE_ARTISTS.map(a => (
              <Chip key={a} active={referenceArtist === a} onClick={() => setReferenceArtist(a)} color={meta.color}>{a}</Chip>
            ))}
          </div>
        </div>

        {/* BPM */}
        <div>
          <div style={{ color: '#8B8A85', fontSize: 12, marginBottom: 8 }}>BPM</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {BPM_BUTTONS.map(b => (
              <Chip key={b} active={bpmOverride === b} onClick={() => setBpmOverride(bpmOverride === b ? null : b)} color={meta.color}>{b}</Chip>
            ))}
            <Chip active={bpmOverride === null} onClick={() => setBpmOverride(null)} color={meta.color}>
              לפי הקשר ({CONTEXT_MAP[context]?.bpm})
            </Chip>
          </div>
        </div>

        {/* Context */}
        <div>
          <div style={{ color: '#8B8A85', fontSize: 12, marginBottom: 8 }}>הקשר שעה</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(CONTEXT_MAP).map(([k, v]) => (
              <Chip key={k} active={context === k} onClick={() => setContext(k)} color={meta.color}>{v.label}</Chip>
            ))}
          </div>
        </div>

        {/* Weirdness slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#8B8A85', fontSize: 12 }}>ניסיוניות</span>
            <span style={{ color: wLabel.color, fontSize: 12, fontWeight: 600 }}>{wLabel.label}</span>
          </div>
          <div style={{ color: '#8B8A85', fontSize: 11, marginBottom: 6 }}>{wLabel.desc}</div>
          <input type="range" min={0} max={100} value={weirdness} onChange={e => setWeirdness(+e.target.value)}
            style={{ width: '100%', accentColor: wLabel.color }} />
        </div>

        {/* Energy slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#8B8A85', fontSize: 12 }}>אנרגיה</span>
            <span style={{ color: eLabel.color, fontSize: 12, fontWeight: 600 }}>{eLabel.label}</span>
          </div>
          <div style={{ color: '#8B8A85', fontSize: 11, marginBottom: 6 }}>{eLabel.desc}</div>
          <input type="range" min={0} max={100} value={energyLevel} onChange={e => setEnergyLevel(+e.target.value)}
            style={{ width: '100%', accentColor: eLabel.color }} />
        </div>

        {/* Platform */}
        <div>
          <div style={{ color: '#8B8A85', fontSize: 12, marginBottom: 8 }}>פלטפורמה יעד</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(PLATFORM_MAP).map(([k, v]) => (
              <Chip key={k} active={platform === k} onClick={() => setPlatform(k)} color={meta.color}>
                {v.label} {v.duration}
              </Chip>
            ))}
          </div>
        </div>

        {/* Lyrics / vocal */}
        <div>
          <div style={{ color: '#8B8A85', fontSize: 12, marginBottom: 4 }}>מילים / ווקאל <span style={{ color: '#555' }}>(אופציונלי)</span></div>
          <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>
            VOVAX תומך ב-lyrics דרך ACE-Step — כתוב כאן כיוון ל-{meta.lead}, עבור ל-ACE-Step לייצור בפועל.
          </div>
          <textarea value={lyrics} onChange={e => setLyrics(e.target.value)}
            placeholder={"[verse]\nמילים...\n\n[chorus]\nמילים..."}
            style={{ ...S, borderRadius: 8, padding: 10, width: '100%', minHeight: 80, resize: 'vertical', fontSize: 12, boxSizing: 'border-box' }} />
        </div>

        <button type="button" onClick={start}
          style={{ background: meta.color, color: '#0A0A0C', borderRadius: 8, padding: '12px 0', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
          התחל סשן עם {meta.lead} →
        </button>
      </div>
    </div>
  );
}

// ── Phase 3: Chat ─────────────────────────────────────────────────────────────

function StudioChat({ studio, params, onBack }) {
  const meta = STUDIOS[studio];
  const [messages, setMessages] = useState([]);
  const [history, setHistory]   = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [imageBase64, setImageBase64]   = useState(null);
  const [imageMimeType, setImageMimeType] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showMastering, setShowMastering] = useState(false);
  const [masteringTitle, setMasteringTitle] = useState('');
  const [masteringStatus, setMasteringStatus] = useState(null);

  const imageRef = useRef();
  const bottomRef = useRef();

  const wLabel = weirdnessLabel(params.weirdness ?? 0);
  const eLabel = energyLabel(params.energyLevel ?? 75);

  function handleImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target.result;
      const [header, data] = result.split(',');
      const mime = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
      setImageBase64(data);
      setImageMimeType(mime);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  }

  async function sendMessage(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text && !imageBase64) return;

    const displayText = text || '(תמונה)';
    setMessages(prev => [...prev, { role: 'user', text: displayText, imagePreview }]);
    setInput('');

    const capImage = imageBase64;
    const capMime  = imageMimeType;
    setImageBase64(null); setImageMimeType(null); setImagePreview(null);
    setLoading(true);

    const historyUserContent = capImage
      ? [
          { type: 'image', source: { type: 'base64', media_type: capMime ?? 'image/jpeg', data: capImage } },
          { type: 'text', text: displayText },
        ]
      : displayText;

    try {
      const r = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: displayText,
          studio,
          params,
          imageBase64: capImage,
          imageMimeType: capMime,
          history,
        }),
      });
      const data = await r.json();
      const reply = data.response ?? data.error ?? 'שגיאה לא ידועה';
      setHistory(prev => [
        ...prev,
        { role: 'user',      content: historyUserContent },
        { role: 'assistant', content: reply },
      ]);
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'שגיאת רשת: ' + err.message }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  async function submitMastering() {
    if (!masteringTitle.trim()) return;
    try {
      const r = await fetch('/api/studio/mastering', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: masteringTitle, studio }),
      });
      const data = await r.json();
      setMasteringStatus(data.ok ? `נשלח לנוי ✓ — ID #${data.entry?.id}` : 'שגיאה: ' + data.error);
    } catch {
      setMasteringStatus('שגיאת רשת');
    }
  }

  const hadExchange = messages.length >= 2;

  return (
    <div dir="rtl" style={{
      maxWidth: 700, margin: '0 auto', padding: '16px 20px 0',
      fontFamily: "'Space Grotesk', sans-serif", color: '#F2F1ED',
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexShrink: 0 }}>
        <button type="button" onClick={onBack} style={{ color: '#8B8A85', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>← פרמטרים</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: meta.color }}>{meta.label}</span>
        <span style={{ color: '#8B8A85', fontSize: 12 }}>סשן עם {meta.lead}</span>
      </div>

      {/* Session summary pill */}
      <div style={{ ...S, borderRadius: 7, padding: '6px 12px', marginBottom: 10, fontSize: 11, display: 'flex', gap: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        <span>BPM: <span style={{ color: meta.color }}>{params.bpm}</span></span>
        {params.key && <span>סולם: <span style={{ color: '#F2F1ED' }}>{params.key}</span></span>}
        {params.referenceArtist && <span>רפרנס: <span style={{ color: '#F2F1ED' }}>{params.referenceArtist}</span></span>}
        <span>אנרגיה: <span style={{ color: eLabel.color }}>{eLabel.label}</span></span>
        <span>ניסיוניות: <span style={{ color: wLabel.color }}>{wLabel.label}</span></span>
        {params.platform && <span>פלטפורמה: <span style={{ color: '#F2F1ED' }}>{params.platform}</span></span>}
        {params.lyrics && <span style={{ color: '#22C55E' }}>🎤 ווקאל</span>}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 48 }}>
            שלח הודעה ל-{meta.lead} כדי להתחיל את הסשן
          </div>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-start' : 'flex-end' }}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>{isUser ? 'אתה' : meta.lead}</div>
              {m.imagePreview && (
                <img src={m.imagePreview} alt="" style={{ maxWidth: 180, borderRadius: 6, marginBottom: 4 }} />
              )}
              <div style={{
                ...S,
                borderRadius: 8, padding: '8px 12px', maxWidth: '80%', fontSize: 13, lineHeight: 1.65,
                background: isUser ? '#0D1A20' : '#131316',
                border: `1px solid ${isUser ? meta.color + '22' : '#232326'}`,
                whiteSpace: 'pre-wrap',
              }}>
                {m.text}
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>{meta.lead}</div>
            <div style={{ ...S, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#555' }}>מעבד...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Post-creation panel */}
      {hadExchange && (
        <div style={{ ...S, borderRadius: 8, padding: 12, margin: '8px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#8B8A85', marginBottom: 8 }}>לאחר הסשן:</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: showMastering ? 10 : 0 }}>
            <button type="button" onClick={() => setShowMastering(v => !v)}
              style={{ background: '#22C55E22', border: '1px solid #22C55E55', color: '#22C55E', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
              שלח למאסטרינג (נוי)
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8B8A85' }}>
              <span style={{ color: '#46C7FF' }}>🎤</span>
              <span>
                ווקאל/מילים: ACE-Step כבר תומך ב-lyrics field — עבור ל-<span style={{ color: '#46C7FF' }}>ACE-Step</span> לייצור בפועל
              </span>
            </div>
          </div>
          {showMastering && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input value={masteringTitle} onChange={e => setMasteringTitle(e.target.value)}
                  placeholder="שם הטראק..."
                  style={{ ...S, flex: 1, borderRadius: 6, padding: '6px 10px', fontSize: 12 }} />
                <button type="button" onClick={submitMastering}
                  style={{ background: '#22C55E', color: '#0A0A0C', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  שלח
                </button>
              </div>
              {masteringStatus && <div style={{ color: '#22C55E', fontSize: 12 }}>{masteringStatus}</div>}
            </div>
          )}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={sendMessage} style={{ flexShrink: 0, paddingBottom: 14 }}>
        {imagePreview && (
          <div style={{ marginBottom: 6, position: 'relative', display: 'inline-block' }}>
            <img src={imagePreview} alt="" style={{ height: 56, borderRadius: 6 }} />
            <button type="button" onClick={() => { setImageBase64(null); setImageMimeType(null); setImagePreview(null); }}
              style={{ position: 'absolute', top: -5, right: -5, background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer', lineHeight: '18px', textAlign: 'center', padding: 0 }}>
              ×
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="file" accept="image/*" ref={imageRef} style={{ display: 'none' }}
            onChange={e => handleImageFile(e.target.files?.[0])} />
          <button type="button" onClick={() => imageRef.current?.click()}
            style={{ ...S, borderRadius: 8, padding: '8px 12px', fontSize: 15, cursor: 'pointer', flexShrink: 0 }}>
            📎
          </button>
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder={`הודעה ל-${meta.lead}...`}
            style={{ ...S, flex: 1, borderRadius: 8, padding: '8px 12px', fontSize: 13 }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
          <button type="submit" disabled={loading}
            style={{ background: meta.color, color: '#0A0A0C', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', flexShrink: 0, opacity: loading ? 0.5 : 1 }}>
            שלח
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function Studio() {
  const [studio, setStudio] = useState(null);
  const [phase,  setPhase]  = useState(1); // 1=choice, 2=params, 3=chat, 4=standalone upload
  const [params, setParams] = useState(null);

  if (phase === 1) {
    return <StudioChoice onSelect={s => { setStudio(s); setPhase(2); }} onUpload={() => setPhase(4)} />;
  }
  if (phase === 4) {
    return <MasteringUpload onBack={() => setPhase(1)} />;
  }
  if (phase === 2) {
    return (
      <SessionParams
        studio={studio}
        onStart={p => { setParams(p); setPhase(3); }}
        onBack={() => setPhase(1)}
      />
    );
  }
  return (
    <StudioChat
      studio={studio}
      params={params}
      onBack={() => setPhase(2)}
    />
  );
}
