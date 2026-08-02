import React, { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
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

function Section({ title, loading, error, children }) {
  return (
    <div className="mb-8">
      <h2 style={{ color: '#8B8A85', fontFamily: "'Space Grotesk', sans-serif", borderBottom: '1px solid #232326' }}
        className="text-xs uppercase tracking-widest pb-2 mb-4">{title}</h2>
      {loading && (
        <div className="flex items-center gap-2" style={{ color: '#8B8A85' }}>
          <RefreshCw size={14} className="animate-spin" /> טוען...
        </div>
      )}
      {error && (
        <div style={{ background: '#131316', border: '1px solid #FF5A64', color: '#FF5A64' }} className="rounded p-3 text-sm">
          {error}
        </div>
      )}
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

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-8" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14"
          fill="none" stroke="#46C7FF" strokeWidth="1.5" className="pulse-line" />
      </svg>

      {/* Avatars */}
      <Section title={`אווטארים (${avatars.length})`} loading={avatarLoading} error={avatarError}>
        <div className="grid grid-cols-2 gap-3">
          {avatars.map((a) => (
            <div key={a.avatar_id} style={{ background: '#0E0E11', border: '1px solid #232326', borderRadius: 8 }} className="p-3 flex gap-3">
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
                  <code style={{ color: '#46C7FF', background: '#131316', borderRadius: 4 }} className="text-xs px-1 py-0.5 truncate block">
                    {a.avatar_id}
                  </code>
                  <CopyButton value={a.avatar_id} />
                </div>
              </div>
            </div>
          ))}
          {!avatarLoading && avatars.length === 0 && (
            <p style={{ color: '#8B8A85' }} className="text-sm col-span-2">לא נמצאו אווטארים בחשבון.</p>
          )}
        </div>
      </Section>

      {/* Voices */}
      <Section title={`קולות (${filteredVoices.length}${voiceFilter ? ` מתוך ${voices.length}` : ''})`} loading={voiceLoading} error={voiceError}>
        {voices.length > 6 && (
          <input
            dir="ltr"
            value={voiceFilter}
            onChange={(e) => setVoiceFilter(e.target.value)}
            style={{ background: '#131316', border: '1px solid #232326', color: '#F2F1ED' }}
            className="w-full rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            placeholder="סנן לפי שם, שפה, מגדר..."
          />
        )}
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
                <tr key={v.voice_id} style={{ borderTop: i > 0 ? '1px solid #232326' : undefined, background: i % 2 === 0 ? '#0A0A0C' : '#0D0D10' }}>
                  <td className="px-3 py-2 font-medium">{v.name}</td>
                  <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{v.language || '—'}</td>
                  <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{v.gender || '—'}</td>
                  <td className="px-3 py-2">
                    <code style={{ color: '#46C7FF', background: '#131316', borderRadius: 4 }} className="text-xs px-1 py-0.5">
                      {v.voice_id}
                    </code>
                  </td>
                  <td className="px-3 py-2">
                    <CopyButton value={v.voice_id} />
                  </td>
                </tr>
              ))}
              {!voiceLoading && filteredVoices.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: '#8B8A85' }} className="px-3 py-4 text-center text-sm">
                    {voices.length === 0 ? 'לא נמצאו קולות בחשבון.' : 'אין תוצאות לסינון הזה.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
