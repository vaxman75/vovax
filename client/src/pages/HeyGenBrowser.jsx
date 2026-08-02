import React, { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';

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

// --- Avatar scoring for Top Picks ---
const AVATAR_INCLUDE = ['dark', 'night', 'moody', 'minimal', 'urban', 'street', 'studio', 'underground', 'casual'];
const AVATAR_EXCLUDE = ['office', 'corporate', 'sofa', 'business', 'bright', 'suit'];

function scoreAvatar(a) {
  const name = (a.name || '').toLowerCase();
  if (AVATAR_EXCLUDE.some((w) => name.includes(w))) return 0;
  return AVATAR_INCLUDE.filter((w) => name.includes(w)).length;
}

// --- Voice scoring for Top Picks ---
const VOICE_PREFER_LANG = ['english'];
const VOICE_AVOID_GENDER = [];
const VOICE_AVOID_LANG   = ['arabic', 'chinese', 'japanese', 'turkish', 'portuguese', 'russian', 'hindi'];

function scoreVoice(v) {
  const lang = (v.language || '').toLowerCase();
  if (VOICE_AVOID_LANG.some((l) => lang.includes(l))) return 0;
  return VOICE_PREFER_LANG.some((l) => lang.includes(l)) ? 1 : 0;
}

// --- AvatarCard shared component ---
function AvatarCard({ a, highlight }) {
  return (
    <div
      style={{
        background: highlight ? '#0D1A1F' : '#0E0E11',
        border: `1px solid ${highlight ? '#46C7FF' : '#232326'}`,
        borderRadius: 8,
      }}
      className="p-3 flex gap-3"
    >
      {a.preview_image_url && (
        <img src={a.preview_image_url} alt={a.name}
          className="rounded shrink-0"
          style={{ width: 56, height: 56, objectFit: 'cover', border: '1px solid #232326' }} />
      )}
      <div className="flex flex-col justify-between min-w-0">
        <div>
          <p className="text-sm font-medium truncate">{a.name}</p>
          {a.gender && <p style={{ color: '#8B8A85' }} className="text-xs">{a.gender}</p>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <code style={{ color: '#46C7FF', background: '#131316', borderRadius: 4 }}
            className="text-xs px-1 py-0.5 truncate block">
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
      {error  && <div style={{ background: '#131316', border: '1px solid #FF5A64', color: '#FF5A64' }} className="rounded p-3 text-sm">{error}</div>}
      {!loading && !error && children}
    </div>
  );
}

export default function HeyGenBrowser() {
  const [avatars, setAvatars]         = useState([]);
  const [voices, setVoices]           = useState([]);
  const [avatarLoading, setAL]        = useState(true);
  const [voiceLoading, setVL]         = useState(true);
  const [avatarError, setAE]          = useState(null);
  const [voiceError, setVE]           = useState(null);
  const [voiceFilter, setVoiceFilter] = useState('');
  const [avatarFilter, setAvatarFilter] = useState('');

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

  const topAvatars = avatars
    .map((a) => ({ ...a, _score: scoreAvatar(a) }))
    .filter((a) => a._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);

  const topAvatarIds = new Set(topAvatars.map((a) => a.avatar_id));

  const filteredAvatars = avatars.filter((a) => {
    const q = avatarFilter.toLowerCase();
    return !q || a.name?.toLowerCase().includes(q) || a.gender?.toLowerCase().includes(q);
  });

  const topVoices = voices
    .map((v) => ({ ...v, _score: scoreVoice(v) }))
    .filter((v) => v._score > 0)
    .slice(0, 5);

  const topVoiceIds = new Set(topVoices.map((v) => v.voice_id));

  const filteredVoices = voices.filter((v) => {
    const q = voiceFilter.toLowerCase();
    return !q || v.name?.toLowerCase().includes(q) || v.language?.toLowerCase().includes(q) || v.gender?.toLowerCase().includes(q);
  });

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

      {/* Persona reminder */}
      <div style={{ background: '#0E0E11', border: '1px solid #232326', borderRadius: 8 }} className="p-4 mb-8">
        <p style={{ color: '#46C7FF', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-widest mb-2">
          לאיזו פרסונה אתה בוחר?
        </p>
        <div className="flex gap-4 text-sm">
          <div style={{ flex: 1, borderRight: '1px solid #232326', paddingRight: 16 }}>
            <p className="font-semibold mb-1">VOVAX / אלכס</p>
            <p style={{ color: '#8B8A85' }} className="text-xs leading-relaxed">
              גוף ראשון אישי. טון אינטימי. אווטאר שמייצג אמן טכנו underground ברצינות — ויזואל כהה, מינימלי.
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <p className="font-semibold mb-1">Signal Detected</p>
            <p style={{ color: '#8B8A85' }} className="text-xs leading-relaxed">
              סקאוט/קיוריטור אנונימי (@underground.signal). מציג את VOVAX כתגלית — לא אלכס מדבר בעצמו. טון נלהב יותר, אסתטיקת לייף underground.
            </p>
          </div>
        </div>
        <p style={{ color: '#8B8A85' }} className="text-xs mt-3">
          → תיעוד מלא: <code style={{ color: '#46C7FF' }}>docs/signal-detected-persona.md</code>
        </p>
      </div>

      {/* ── AVATARS ── */}
      <Section title={`אווטארים (${avatars.length})`} loading={avatarLoading} error={avatarError}>

        {/* Top Picks */}
        {topAvatars.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: '#46C7FF', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-widest">
                המלצות מובילות
              </span>
              <span style={{ color: '#8B8A85' }} className="text-xs">— מסוננות לפי אסתטיקת VOVAX</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {topAvatars.map((a) => <AvatarCard key={a.avatar_id} a={a} highlight />)}
            </div>
          </div>
        )}

        {/* Full list */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: '#8B8A85' }} className="text-xs">רשימה מלאה ({avatars.length})</span>
            <input
              dir="ltr" value={avatarFilter} onChange={(e) => setAvatarFilter(e.target.value)}
              style={{ background: '#131316', border: '1px solid #232326', color: '#F2F1ED' }}
              className="rounded px-2 py-1 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              placeholder="חפש לפי שם..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {filteredAvatars.map((a) => (
              <AvatarCard key={a.avatar_id} a={a} highlight={topAvatarIds.has(a.avatar_id)} />
            ))}
            {filteredAvatars.length === 0 && (
              <p style={{ color: '#8B8A85' }} className="text-sm col-span-2">אין תוצאות.</p>
            )}
          </div>
        </div>
      </Section>

      {/* ── VOICES ── */}
      <Section title={`קולות (${voices.length})`} loading={voiceLoading} error={voiceError}>

        {/* Top Picks */}
        {topVoices.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: '#46C7FF', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-widest">
                המלצות מובילות
              </span>
              <span style={{ color: '#8B8A85' }} className="text-xs">— קולות באנגלית</span>
            </div>
            <div style={{ border: '1px solid #46C7FF', borderRadius: 8, overflow: 'hidden' }}>
              <table className="w-full text-sm">
                <tbody>
                  {topVoices.map((v, i) => (
                    <tr key={v.voice_id} style={{ borderTop: i > 0 ? '1px solid #1a2a2e' : undefined, background: '#0D1A1F' }}>
                      <td className="px-3 py-2 font-medium">{v.name}</td>
                      <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{v.language || '—'}</td>
                      <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{v.gender || '—'}</td>
                      <td className="px-3 py-2">
                        <code style={{ color: '#46C7FF', background: '#131316', borderRadius: 4 }} className="text-xs px-1 py-0.5">{v.voice_id}</code>
                      </td>
                      <td className="px-3 py-2"><CopyButton value={v.voice_id} /></td>
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
            <input
              dir="ltr" value={voiceFilter} onChange={(e) => setVoiceFilter(e.target.value)}
              style={{ background: '#131316', border: '1px solid #232326', color: '#F2F1ED' }}
              className="rounded px-2 py-1 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              placeholder="חפש לפי שם, שפה, מגדר..."
            />
          </div>
          <div style={{ border: '1px solid #232326', borderRadius: 8, overflow: 'hidden' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0E0E11', borderBottom: '1px solid #232326' }}>
                  <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">שם</th>
                  <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">שפה</th>
                  <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">מגדר</th>
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
                    <td className="px-3 py-2 font-medium">{v.name}</td>
                    <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{v.language || '—'}</td>
                    <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{v.gender || '—'}</td>
                    <td className="px-3 py-2">
                      <code style={{ color: '#46C7FF', background: '#131316', borderRadius: 4 }} className="text-xs px-1 py-0.5">{v.voice_id}</code>
                    </td>
                    <td className="px-3 py-2"><CopyButton value={v.voice_id} /></td>
                  </tr>
                ))}
                {filteredVoices.length === 0 && (
                  <tr><td colSpan={5} style={{ color: '#8B8A85' }} className="px-3 py-4 text-center text-sm">אין תוצאות.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </div>
  );
}
