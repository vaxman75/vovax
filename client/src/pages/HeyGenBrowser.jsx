import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, RefreshCw, Play, Square } from 'lucide-react';

// --- Clipboard with execCommand fallback ---
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={copy} style={{ color: copied ? '#22c55e' : '#46C7FF' }} className="flex items-center gap-1 text-xs shrink-0">
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'הועתק' : 'העתק'}
    </button>
  );
}

function VoicePreviewButton({ url }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  if (!url) return null;
  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); audioRef.current.currentTime = 0; setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };
  return (
    <>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} />
      <button onClick={toggle}
        style={{ color: playing ? '#FF5A64' : '#8B8A85', border: '1px solid #232326', background: '#131316' }}
        className="rounded px-2 py-1 text-xs flex items-center gap-1 shrink-0">
        {playing ? <><Square size={10} /> עצור</> : <><Play size={10} /> נגן</>}
      </button>
    </>
  );
}

// --- Persona-aware avatar scoring ---
const PERSONA_AVATAR = {
  vovax:  { include: ['dark', 'night', 'moody', 'minimal', 'underground', 'studio', 'street'], exclude: ['office', 'corporate', 'sofa', 'business', 'bright', 'suit', 'formal'] },
  signal: { include: ['urban', 'street', 'casual', 'outdoor', 'city', 'energetic', 'night', 'underground'], exclude: ['office', 'corporate', 'sofa', 'business', 'formal', 'suit'] },
};

function scoreAvatar(a, persona) {
  const name = (a.name || '').toLowerCase();
  const { include, exclude } = PERSONA_AVATAR[persona] ?? PERSONA_AVATAR.vovax;
  if (exclude.some((w) => name.includes(w))) return 0;
  return include.filter((w) => name.includes(w)).length;
}

// --- Voice scoring (HeyGen voice names are generic — score by language + capability) ---
function scoreVoice(v) {
  const lang = (v.language || '').toLowerCase();
  if (!lang.includes('english')) return 0;
  let score = 1;
  if (v.emotion_support) score += 1;
  if (v.preview_audio)   score += 1;
  return score;
}

// --- AvatarCard ---
function AvatarCard({ a, highlight }) {
  return (
    <div style={{ background: highlight ? '#0D1A1F' : '#0E0E11', border: `1px solid ${highlight ? '#46C7FF' : '#232326'}`, borderRadius: 8 }}
      className="p-3 flex gap-3">
      {a.preview_image_url && (
        <img src={a.preview_image_url} alt={a.name} className="rounded shrink-0"
          style={{ width: 56, height: 56, objectFit: 'cover', border: '1px solid #232326' }} />
      )}
      <div className="flex flex-col justify-between min-w-0">
        <div>
          <p className="text-sm font-medium truncate">{a.name}</p>
          {a.gender && <p style={{ color: '#8B8A85' }} className="text-xs">{a.gender}</p>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <code style={{ color: '#46C7FF', background: '#131316', borderRadius: 4 }} className="text-xs px-1 py-0.5 truncate block">
            {a.avatar_id}
          </code>
          <CopyButton value={a.avatar_id} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, loading, error, children }) {
  return (
    <div className="mb-8">
      <h2 style={{ color: '#8B8A85', fontFamily: "'Space Grotesk', sans-serif", borderBottom: '1px solid #232326' }}
        className="text-xs uppercase tracking-widest pb-2 mb-4">{title}</h2>
      {loading && <div className="flex items-center gap-2" style={{ color: '#8B8A85' }}><RefreshCw size={14} className="animate-spin" /> טוען...</div>}
      {error   && <div style={{ background: '#131316', border: '1px solid #FF5A64', color: '#FF5A64' }} className="rounded p-3 text-sm">{error}</div>}
      {!loading && !error && children}
    </div>
  );
}

export default function HeyGenBrowser() {
  const [avatars, setAvatars]           = useState([]);
  const [voices, setVoices]             = useState([]);
  const [avatarLoading, setAL]          = useState(true);
  const [voiceLoading, setVL]           = useState(true);
  const [avatarError, setAE]            = useState(null);
  const [voiceError, setVE]             = useState(null);
  const [voiceFilter, setVoiceFilter]   = useState('');
  const [avatarFilter, setAvatarFilter] = useState('');

  // Persona selector — drives Top Picks scoring for avatars
  const [persona, setPersona] = useState('vovax');

  useEffect(() => {
    fetch('/api/heygen/avatars')
      .then((r) => r.json())
      .then((d) => { if (d.error) setAE(d.error); else setAvatars(d.avatars ?? []); })
      .catch(() => setAE('הבקשה נכשלה'))
      .finally(() => setAL(false));

    fetch('/api/heygen/voices')
      .then((r) => r.json())
      .then((d) => { if (d.error) setVE(d.error); else setVoices(d.voices ?? []); })
      .catch(() => setVE('הבקשה נכשלה'))
      .finally(() => setVL(false));
  }, []);

  // Avatar Top Picks — re-scored when persona changes
  const topAvatars = avatars
    .map((a) => ({ ...a, _score: scoreAvatar(a, persona) }))
    .filter((a) => a._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);

  const topAvatarIds = new Set(topAvatars.map((a) => a.avatar_id));

  const filteredAvatars = avatars.filter((a) => {
    const q = avatarFilter.toLowerCase();
    return !q || a.name?.toLowerCase().includes(q) || a.gender?.toLowerCase().includes(q);
  });

  // Voice Top Picks — English + emotion_support
  const topVoices = voices
    .map((v) => ({ ...v, _score: scoreVoice(v) }))
    .filter((v) => v._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);

  const topVoiceIds = new Set(topVoices.map((v) => v.voice_id));

  const filteredVoices = voices.filter((v) => {
    const q = voiceFilter.toLowerCase();
    return !q || v.name?.toLowerCase().includes(q) || v.language?.toLowerCase().includes(q) || v.gender?.toLowerCase().includes(q);
  });

  const personaLabel = { vovax: 'VOVAX / אלכס', signal: 'Signal Detected' };

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · RON — HEYGEN
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold mb-1">אווטארים וקולות זמינים</h1>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-6">רשימה מחשבון HeyGen שלך — לחץ "העתק" כדי לקחת ID לעמוד HeyGen</p>

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-6" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14"
          fill="none" stroke="#46C7FF" strokeWidth="1.5" className="pulse-line" />
      </svg>

      {/* ── Persona selector (interactive) ── */}
      <div style={{ background: '#0E0E11', border: '1px solid #232326', borderRadius: 8 }} className="p-4 mb-8">
        <p style={{ color: '#46C7FF', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-widest mb-3">
          לאיזו פרסונה אתה בוחר? — Top Picks ישתנו בהתאם
        </p>
        <div className="flex gap-3 mb-3">
          {[
            { key: 'vovax',  title: 'VOVAX / אלכס',    desc: 'גוף ראשון אישי. טון אינטימי. אמן טכנו underground — ויזואל כהה, מינימלי.' },
            { key: 'signal', title: 'Signal Detected', desc: 'סקאוט אנונימי (@underground.signal). מציג את VOVAX כתגלית — טון נלהב, אסתטיקת לייף underground.' },
          ].map(({ key, title, desc }) => (
            <button
              key={key}
              onClick={() => setPersona(key)}
              style={{
                flex: 1,
                background: persona === key ? '#0D1A1F' : '#131316',
                border: `1px solid ${persona === key ? '#46C7FF' : '#232326'}`,
                borderRadius: 8,
                textAlign: 'right',
                cursor: 'pointer',
                padding: '12px',
              }}
            >
              <p style={{ color: persona === key ? '#46C7FF' : '#F2F1ED', fontWeight: 600 }} className="text-sm mb-1">{title}</p>
              <p style={{ color: '#8B8A85' }} className="text-xs leading-relaxed">{desc}</p>
            </button>
          ))}
        </div>
        <p style={{ color: '#8B8A85' }} className="text-xs">
          בחירה נוכחית: <span style={{ color: '#46C7FF' }}>{personaLabel[persona]}</span> ·
          תיעוד מלא: <code style={{ color: '#46C7FF' }}>docs/signal-detected-persona.md</code>
        </p>
      </div>

      {/* ── AVATARS ── */}
      <Section title={`אווטארים (${avatars.length})`} loading={avatarLoading} error={avatarError}>

        {/* Top Picks — persona-aware */}
        {topAvatars.length > 0 ? (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: '#46C7FF', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-widest">המלצות מובילות</span>
              <span style={{ color: '#8B8A85' }} className="text-xs">— לפי {personaLabel[persona]}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {topAvatars.map((a) => <AvatarCard key={a.avatar_id} a={a} highlight />)}
            </div>
          </div>
        ) : (
          !avatarLoading && (
            <div style={{ background: '#131316', border: '1px solid #232326', borderRadius: 8 }} className="p-3 mb-6">
              <p style={{ color: '#8B8A85' }} className="text-xs">לא נמצאו אווטארים עם מילות מפתח מתאימות לפרסונה זו — גלול לרשימה המלאה.</p>
            </div>
          )
        )}

        {/* Full list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: '#8B8A85' }} className="text-xs">רשימה מלאה ({avatars.length})</span>
            <input dir="ltr" value={avatarFilter} onChange={(e) => setAvatarFilter(e.target.value)}
              style={{ background: '#131316', border: '1px solid #232326', color: '#F2F1ED' }}
              className="rounded px-2 py-1 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              placeholder="חפש לפי שם..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {filteredAvatars.map((a) => <AvatarCard key={a.avatar_id} a={a} highlight={topAvatarIds.has(a.avatar_id)} />)}
            {filteredAvatars.length === 0 && <p style={{ color: '#8B8A85' }} className="text-sm col-span-2">אין תוצאות.</p>}
          </div>
        </div>
      </Section>

      {/* ── VOICES ── */}
      <Section title={`קולות (${voices.length})`} loading={voiceLoading} error={voiceError}>

        {/* Top Picks — English + emotion */}
        {topVoices.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: '#46C7FF', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-widest">המלצות מובילות</span>
              <span style={{ color: '#8B8A85' }} className="text-xs">— קולות באנגלית עם תמיכת רגש ו-preview</span>
            </div>
            <div style={{ border: '1px solid #46C7FF', borderRadius: 8, overflow: 'hidden' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#0D1A1F', borderBottom: '1px solid #1a2a2e' }}>
                    <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">שם</th>
                    <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">שפה</th>
                    <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">מגדר</th>
                    <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">יכולות</th>
                    <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">Voice ID</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {topVoices.map((v, i) => (
                    <tr key={v.voice_id} style={{ borderTop: i > 0 ? '1px solid #1a2a2e' : undefined, background: '#0D1A1F' }}>
                      <td className="px-3 py-2 font-medium">{v.name || '—'}</td>
                      <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{v.language || '—'}</td>
                      <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{v.gender || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {v.emotion_support && <span style={{ background: '#131316', border: '1px solid #232326', color: '#46C7FF', borderRadius: 4 }} className="text-xs px-1.5 py-0.5">רגש</span>}
                          {v.support_pause   && <span style={{ background: '#131316', border: '1px solid #232326', color: '#8B8A85', borderRadius: 4 }} className="text-xs px-1.5 py-0.5">pause</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <code style={{ color: '#46C7FF', background: '#131316', borderRadius: 4 }} className="text-xs px-1 py-0.5">{v.voice_id}</code>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <VoicePreviewButton url={v.preview_audio} />
                          <CopyButton value={v.voice_id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Full list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: '#8B8A85' }} className="text-xs">רשימה מלאה ({voices.length})</span>
            <input dir="ltr" value={voiceFilter} onChange={(e) => setVoiceFilter(e.target.value)}
              style={{ background: '#131316', border: '1px solid #232326', color: '#F2F1ED' }}
              className="rounded px-2 py-1 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              placeholder="חפש לפי שם, שפה, מגדר..." />
          </div>
          <div style={{ border: '1px solid #232326', borderRadius: 8, overflow: 'hidden' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0E0E11', borderBottom: '1px solid #232326' }}>
                  <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">שם</th>
                  <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">שפה</th>
                  <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">מגדר</th>
                  <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">יכולות</th>
                  <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">Voice ID</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredVoices.map((v, i) => (
                  <tr key={v.voice_id} style={{
                    borderTop: i > 0 ? '1px solid #232326' : undefined,
                    background: topVoiceIds.has(v.voice_id) ? '#0D1A1F' : (i % 2 === 0 ? '#0A0A0C' : '#0D0D10'),
                  }}>
                    <td className="px-3 py-2 font-medium">{v.name || '—'}</td>
                    <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{v.language || '—'}</td>
                    <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{v.gender || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {v.emotion_support && <span style={{ background: '#131316', border: '1px solid #232326', color: '#46C7FF', borderRadius: 4 }} className="text-xs px-1.5 py-0.5">רגש</span>}
                        {v.support_pause   && <span style={{ background: '#131316', border: '1px solid #232326', color: '#8B8A85', borderRadius: 4 }} className="text-xs px-1.5 py-0.5">pause</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <code style={{ color: '#46C7FF', background: '#131316', borderRadius: 4 }} className="text-xs px-1 py-0.5">{v.voice_id}</code>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <VoicePreviewButton url={v.preview_audio} />
                        <CopyButton value={v.voice_id} />
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVoices.length === 0 && (
                  <tr><td colSpan={6} style={{ color: '#8B8A85' }} className="px-3 py-4 text-center text-sm">אין תוצאות.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </div>
  );
}
