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

function PreviewButton({ url }) {
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

function Tag({ children }) {
  if (!children) return null;
  return (
    <span style={{ background: '#131316', border: '1px solid #232326', color: '#8B8A85', borderRadius: 4 }}
      className="text-xs px-1.5 py-0.5">{children}</span>
  );
}

// --- Voice scoring for Top Picks ---
const PREFER_USE_CASE = ['social_media', 'entertainment', 'characters', 'narrative_story', 'video_games'];
const AVOID_USE_CASE  = ['news_item', 'meditation', 'children_stories', 'audiobook'];
const PREFER_NAME     = ['dark', 'deep', 'dramatic', 'intense', 'gritty', 'mysterious', 'night', 'shadow'];
const AVOID_NAME      = ['child', 'kid', 'bright', 'cheerful', 'corporate', 'calm'];

function scoreVoice(v) {
  const name     = (v.name     || '').toLowerCase();
  const useCase  = (v.use_case || '').toLowerCase();
  if (AVOID_USE_CASE.some((u) => useCase.includes(u))) return 0;
  if (AVOID_NAME.some((w) => name.includes(w)))        return 0;
  let score = 0;
  if (PREFER_USE_CASE.some((u) => useCase.includes(u))) score += 2;
  if (PREFER_NAME.some((w) => name.includes(w)))        score += 1;
  return score;
}

function VoiceRow({ v, highlight, index }) {
  return (
    <tr style={{
      borderTop: index > 0 ? `1px solid ${highlight ? '#1a2a2e' : '#232326'}` : undefined,
      background: highlight ? '#0D1A1F' : (index % 2 === 0 ? '#0A0A0C' : '#0D0D10'),
    }}>
      <td className="px-3 py-2">
        <p className="font-medium">{v.name}</p>
        {v.category && <p style={{ color: '#8B8A85' }} className="text-xs">{v.category}</p>}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          <Tag>{v.gender}</Tag>
          <Tag>{v.accent}</Tag>
          <Tag>{v.age}</Tag>
          <Tag>{v.use_case}</Tag>
        </div>
      </td>
      <td className="px-3 py-2">
        <code style={{ color: '#46C7FF', background: '#131316', borderRadius: 4 }} className="text-xs px-1 py-0.5 break-all">
          {v.voice_id}
        </code>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 justify-end">
          <PreviewButton url={v.preview_url} />
          <CopyButton value={v.voice_id} />
        </div>
      </td>
    </tr>
  );
}

export default function ElevenLabsBrowser() {
  const [voices, setVoices]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [filter, setFilter]       = useState('');
  const [catFilter, setCatFilter] = useState('all');

  useEffect(() => {
    fetch('/api/elevenlabs/voices')
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setVoices(d.voices ?? []); })
      .catch(() => setError('הבקשה נכשלה'))
      .finally(() => setLoading(false));
  }, []);

  const topVoices = voices
    .map((v) => ({ ...v, _score: scoreVoice(v) }))
    .filter((v) => v._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);

  const topVoiceIds = new Set(topVoices.map((v) => v.voice_id));

  const categories = ['all', ...Array.from(new Set(voices.map((v) => v.category).filter(Boolean)))];

  const filtered = voices.filter((v) => {
    const q = filter.toLowerCase();
    const matchText = !q || [v.name, v.gender, v.accent, v.age, v.use_case].some((f) => f?.toLowerCase().includes(q));
    const matchCat  = catFilter === 'all' || v.category === catFilter;
    return matchText && matchCat;
  });

  const tableHead = (
    <thead>
      <tr style={{ background: '#0E0E11', borderBottom: '1px solid #232326' }}>
        <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">שם</th>
        <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">תגיות</th>
        <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">Voice ID</th>
        <th className="px-3 py-2 w-28" />
      </tr>
    </thead>
  );

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · RON — ELEVENLABS
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold mb-1">קולות זמינים</h1>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-6">
        רשימה מחשבון ElevenLabs שלך — לחץ "נגן" להאזנה, "העתק" לקחת Voice ID לעמוד ElevenLabs
      </p>

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-6" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14"
          fill="none" stroke="#46C7FF" strokeWidth="1.5" className="pulse-line" />
      </svg>

      {loading && (
        <div className="flex items-center gap-2" style={{ color: '#8B8A85' }}>
          <RefreshCw size={14} className="animate-spin" /> טוען קולות...
        </div>
      )}
      {error && (
        <div style={{ background: '#131316', border: '1px solid #FF5A64', color: '#FF5A64' }} className="rounded p-3 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Top Picks */}
          {topVoices.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: '#46C7FF', fontFamily: "'Space Grotesk', sans-serif" }} className="text-xs uppercase tracking-widest">
                  המלצות מובילות
                </span>
                <span style={{ color: '#8B8A85' }} className="text-xs">— קולות שמתאימים לאסתטיקת VOVAX/underground</span>
              </div>
              <div style={{ border: '1px solid #46C7FF', borderRadius: 8, overflow: 'hidden' }}>
                <table className="w-full text-sm">
                  {tableHead}
                  <tbody>
                    {topVoices.map((v, i) => <VoiceRow key={v.voice_id} v={v} highlight index={i} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {topVoices.length === 0 && (
            <div style={{ background: '#131316', border: '1px solid #232326', borderRadius: 8 }} className="p-3 mb-6">
              <p style={{ color: '#8B8A85' }} className="text-xs">לא נמצאו קולות מתאימים לפי הקריטריונים — גלול לרשימה המלאה.</p>
            </div>
          )}

          {/* Filters for full list */}
          <div className="flex gap-2 mb-3 flex-wrap">
            <input
              dir="ltr" value={filter} onChange={(e) => setFilter(e.target.value)}
              style={{ background: '#131316', border: '1px solid #232326', color: '#F2F1ED' }}
              className="rounded px-3 py-2 text-sm flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="חפש לפי שם, מגדר, מבטא, גיל..."
            />
            {categories.map((c) => (
              <button key={c} onClick={() => setCatFilter(c)}
                style={{
                  background: catFilter === c ? '#46C7FF' : '#131316',
                  border: '1px solid ' + (catFilter === c ? '#46C7FF' : '#232326'),
                  color: catFilter === c ? '#0A0A0C' : '#8B8A85',
                }}
                className="rounded px-3 py-2 text-xs font-medium shrink-0">
                {c === 'all' ? `הכל (${voices.length})` : `${c} (${voices.filter((v) => v.category === c).length})`}
              </button>
            ))}
          </div>

          {/* Full list */}
          <div style={{ border: '1px solid #232326', borderRadius: 8, overflow: 'hidden' }}>
            <table className="w-full text-sm">
              {tableHead}
              <tbody>
                {filtered.map((v, i) => (
                  <VoiceRow key={v.voice_id} v={v} highlight={topVoiceIds.has(v.voice_id)} index={i} />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ color: '#8B8A85' }} className="px-3 py-6 text-center text-sm">
                      {voices.length === 0 ? 'לא נמצאו קולות בחשבון.' : 'אין תוצאות לסינון הזה.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p style={{ color: '#8B8A85' }} className="text-xs mt-3">
            מציג {filtered.length} מתוך {voices.length} קולות
          </p>
        </>
      )}
    </div>
  );
}
