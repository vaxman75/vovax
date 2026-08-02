import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, RefreshCw, Clock, Send, Eye } from 'lucide-react';

const TOPIC_LABELS = {
  track_release: 'הוצאת טראק', gig_announcement: 'הכרזת הופעה',
  behind_scenes: 'מאחורי הקלעים', studio_session: 'סשן סטודיו', fan_message: 'הודעה לקהל',
  discovery: 'גילוי', track_feature: 'הייליט טראק', underground_pick: 'בחירת underground',
  artist_spotlight: 'זרקור על אמן', genre_deep_dive: 'עומק ז\'אנר',
};
const PLATFORM_LABEL = { instagram: 'Instagram', tiktok: 'TikTok' };
const STATUS_LABEL = { pending: 'ממתין', approved: 'מאושר', rejected: 'נדחה', published: 'פורסם' };
const STATUS_COLOR = { pending: '#F59E0B', approved: '#46C7FF', rejected: '#FF5A64', published: '#22c55e' };
const CHANNEL_COLOR = { vovax: '#46C7FF', signal: '#8B8A85' };

function StatusBadge({ status }) {
  return (
    <span style={{ background: '#131316', border: `1px solid ${STATUS_COLOR[status]}`, color: STATUS_COLOR[status], borderRadius: 4 }}
      className="text-xs px-2 py-0.5">{STATUS_LABEL[status] ?? status}</span>
  );
}

function ChannelBadge({ channel }) {
  return (
    <span style={{ background: '#131316', border: `1px solid ${CHANNEL_COLOR[channel]}`, color: CHANNEL_COLOR[channel], borderRadius: 4 }}
      className="text-xs px-2 py-0.5 font-mono">{channel === 'vovax' ? 'VOVAX' : 'Signal Detected'}</span>
  );
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000)   return 'עכשיו';
  if (diff < 3600000) return `לפני ${Math.floor(diff / 60000)} דקות`;
  if (diff < 86400000) return `לפני ${Math.floor(diff / 3600000)} שעות`;
  return `לפני ${Math.floor(diff / 86400000)} ימים`;
}

function PendingCard({ item, onApprove, onReject }) {
  const [avatarId, setAvatarId] = useState(item.avatar_id || '');
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState(false);

  const approve = async () => {
    setLoading(true);
    await onApprove(item.id, avatarId || null);
    setLoading(false);
  };

  const reject = async () => {
    setLoading(true);
    await onReject(item.id, rejectNote);
    setLoading(false);
  };

  return (
    <div style={{ background: '#0E0E11', border: '1px solid #F59E0B', borderRadius: 8 }} className="p-4 mb-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <ChannelBadge channel={item.channel} />
        <StatusBadge status={item.status} />
        <span style={{ background: '#131316', border: '1px solid #232326', color: '#8B8A85', borderRadius: 4 }} className="text-xs px-2 py-0.5">
          {PLATFORM_LABEL[item.platform]}
        </span>
        <span style={{ color: '#46C7FF' }} className="text-xs">{TOPIC_LABELS[item.topic] ?? item.topic}</span>
        <span style={{ color: '#8B8A85' }} className="text-xs mr-auto flex items-center gap-1">
          <Clock size={11} /> {timeAgo(item.created_at)}
        </span>
      </div>

      {/* Script preview */}
      <div style={{ background: '#131316', border: '1px solid #232326', borderRadius: 6 }} className="p-3 mb-3">
        <p style={{ color: '#8B8A85' }} className="text-xs mb-1">סקריפט (אנגלית)</p>
        <p className="text-sm leading-relaxed">{item.script}</p>
      </div>

      {/* Avatar ID input */}
      <div className="mb-3">
        <label style={{ color: '#8B8A85' }} className="text-xs block mb-1">Avatar ID (אופציונלי — להוסיף לפני אישור)</label>
        <input
          dir="ltr" value={avatarId} onChange={(e) => setAvatarId(e.target.value)}
          style={{ background: '#131316', border: '1px solid #232326', color: '#F2F1ED' }}
          className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
          placeholder="avatar_id מ-HeyGen Assets"
        />
      </div>

      {/* Reject note */}
      {showReject && (
        <div className="mb-3">
          <label style={{ color: '#FF5A64' }} className="text-xs block mb-1">סיבת דחייה (אופציונלי)</label>
          <input
            dir="rtl" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
            style={{ background: '#131316', border: '1px solid #FF5A64', color: '#F2F1ED' }}
            className="w-full rounded px-3 py-2 text-sm focus:outline-none"
            placeholder="למשל: לא מתאים לתזמון הזה"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={approve} disabled={loading}
          style={{ background: '#22c55e', color: '#0A0A0C' }}
          className="rounded px-4 py-2 text-sm font-semibold flex items-center gap-1 flex-1 justify-center"
        >
          <Check size={14} /> אשר לפרסום
        </button>
        {!showReject ? (
          <button onClick={() => setShowReject(true)} style={{ background: '#131316', border: '1px solid #FF5A64', color: '#FF5A64' }}
            className="rounded px-4 py-2 text-sm flex items-center gap-1">
            <X size={14} /> דחה
          </button>
        ) : (
          <button onClick={reject} disabled={loading} style={{ background: '#FF5A64', color: '#0A0A0C' }}
            className="rounded px-4 py-2 text-sm font-semibold flex items-center gap-1">
            <X size={14} /> אשר דחייה
          </button>
        )}
      </div>
    </div>
  );
}

export default function Publish() {
  const [pending, setPending]   = useState([]);
  const [history, setHistory]   = useState([]);
  const [loadingP, setLoadingP] = useState(true);
  const [loadingH, setLoadingH] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genPlatform, setGenPlatform] = useState('instagram');
  const [tab, setTab] = useState('pending');

  const fetchPending = useCallback(async () => {
    setLoadingP(true);
    const r = await fetch('/api/publish/vovax/pending');
    const d = await r.json();
    setPending(d.items ?? []);
    setLoadingP(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingH(true);
    const r = await fetch('/api/publish/history');
    const d = await r.json();
    setHistory(d.items ?? []);
    setLoadingH(false);
  }, []);

  useEffect(() => { fetchPending(); fetchHistory(); }, [fetchPending, fetchHistory]);

  const handleApprove = async (id, avatarId) => {
    await fetch(`/api/publish/vovax/${id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_id: avatarId }),
    });
    fetchPending(); fetchHistory();
  };

  const handleReject = async (id, notes) => {
    await fetch(`/api/publish/vovax/${id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    fetchPending(); fetchHistory();
  };

  const generateNow = async () => {
    setGenerating(true);
    await fetch('/api/publish/vovax/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: genPlatform }),
    });
    await fetchPending();
    setTab('pending');
    setGenerating(false);
  };

  const pendingCount = pending.length;

  return (
    <div className="max-w-2xl mx-auto px-5 py-8">
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · RON — PUBLISH
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold mb-1">תור פרסום</h1>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-6">
        VOVAX — אישור ידני לפני כל פרסום · Signal Detected — אוטומטי לחלוטין
      </p>

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-6" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14"
          fill="none" stroke="#46C7FF" strokeWidth="1.5" className="pulse-line" />
      </svg>

      {/* Manual generate (for testing / bypass Zapier) */}
      <div style={{ background: '#0E0E11', border: '1px solid #232326', borderRadius: 8 }} className="p-4 mb-6">
        <p style={{ color: '#8B8A85' }} className="text-xs uppercase tracking-widest mb-3">צור פוסט VOVAX ידנית</p>
        <div className="flex gap-2">
          {['instagram', 'tiktok'].map((p) => (
            <button key={p} onClick={() => setGenPlatform(p)}
              style={{ background: genPlatform === p ? '#46C7FF' : '#131316', border: `1px solid ${genPlatform === p ? '#46C7FF' : '#232326'}`, color: genPlatform === p ? '#0A0A0C' : '#8B8A85' }}
              className="rounded px-3 py-1.5 text-xs font-medium">
              {p === 'instagram' ? 'Instagram' : 'TikTok'}
            </button>
          ))}
          <button onClick={generateNow} disabled={generating}
            style={{ background: generating ? '#232326' : '#46C7FF', color: generating ? '#8B8A85' : '#0A0A0C', marginRight: 'auto' }}
            className="rounded px-4 py-1.5 text-sm font-semibold flex items-center gap-1">
            {generating ? <><RefreshCw size={13} className="animate-spin" /> יוצר...</> : <><Send size={13} /> צור טיוטה</>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {[
          { key: 'pending', label: `ממתין לאישור${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'history', label: 'היסטוריה' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ background: tab === t.key ? '#131316' : 'transparent', border: `1px solid ${tab === t.key ? '#46C7FF' : '#232326'}`, color: tab === t.key ? '#46C7FF' : '#8B8A85' }}
            className="rounded px-4 py-2 text-sm">
            {t.label}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === 'pending' && (
        <div>
          {loadingP && <div className="flex items-center gap-2" style={{ color: '#8B8A85' }}><RefreshCw size={14} className="animate-spin" /> טוען...</div>}
          {!loadingP && pending.length === 0 && (
            <div style={{ background: '#0E0E11', border: '1px solid #232326', borderRadius: 8 }} className="p-6 text-center">
              <Eye size={24} style={{ color: '#8B8A85', margin: '0 auto 8px' }} />
              <p style={{ color: '#8B8A85' }} className="text-sm">אין פוסטים ממתינים לאישור.</p>
              <p style={{ color: '#8B8A85' }} className="text-xs mt-1">Zapier יוצר טיוטות לפי לוח הזמנים, או השתמש בכפתור למעלה.</p>
            </div>
          )}
          {pending.map((item) => (
            <PendingCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
          ))}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div>
          {loadingH && <div className="flex items-center gap-2" style={{ color: '#8B8A85' }}><RefreshCw size={14} className="animate-spin" /> טוען...</div>}
          {!loadingH && (
            <div style={{ border: '1px solid #232326', borderRadius: 8, overflow: 'hidden' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#0E0E11', borderBottom: '1px solid #232326' }}>
                    <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">ערוץ</th>
                    <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">נושא</th>
                    <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">פלטפורמה</th>
                    <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">סטטוס</th>
                    <th style={{ color: '#8B8A85' }} className="text-xs text-right px-3 py-2 font-normal">מתי</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr><td colSpan={5} style={{ color: '#8B8A85' }} className="px-3 py-6 text-center text-sm">אין היסטוריה עדיין.</td></tr>
                  )}
                  {history.map((item, i) => (
                    <tr key={item.id} style={{ borderTop: i > 0 ? '1px solid #232326' : undefined, background: i % 2 === 0 ? '#0A0A0C' : '#0D0D10' }}>
                      <td className="px-3 py-2"><ChannelBadge channel={item.channel} /></td>
                      <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{TOPIC_LABELS[item.topic] ?? item.topic}</td>
                      <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{PLATFORM_LABEL[item.platform]}</td>
                      <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
                      <td style={{ color: '#8B8A85' }} className="px-3 py-2 text-xs">{timeAgo(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
