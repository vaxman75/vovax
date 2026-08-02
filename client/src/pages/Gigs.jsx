import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Clock } from 'lucide-react';

const SEED_GIGS = [{
  id: 'seed-gig-001', date: '2026-09-04', venue: 'Gagarin', city: 'תל אביב',
  startTime: '01:00', endTime: '02:30', slotType: 'headline', fee: '', setStatus: 'בעבודה',
  notes: 'יש כבר סט בעבודה. עוד זמן עד המועד.',
}];

const SLOT_LABELS = { headline: 'מופע מרכזי', support: 'תומך', b2b: 'B2B', other: 'אחר' };
const STATUS_OPTIONS = ['בעבודה', 'מוכן', 'סוכם'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Gigs() {
  const [gigs, setGigs] = useState(null);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ date: '', venue: '', city: '', startTime: '', endTime: '', slotType: 'headline', fee: '', notes: '' });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/gigs');
        const stored = await r.json();
        const existingIds = new Set(stored.map((g) => g.id));
        const toSeed = SEED_GIGS.filter((s) => !existingIds.has(s.id));
        await Promise.all(toSeed.map((s) =>
          fetch('/api/gigs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
        ));
        const all = [...stored, ...toSeed].sort((a, b) => new Date(a.date) - new Date(b.date));
        setGigs(all);
      } catch { setGigs([]); }
    })();
  }, []);

  const addGig = async () => {
    if (!draft.date || !draft.venue || !gigs) return;
    const entry = { id: uid(), setStatus: 'בעבודה', ...draft };
    const next = [...gigs, entry].sort((a, b) => new Date(a.date) - new Date(b.date));
    setGigs(next);
    setDraft({ date: '', venue: '', city: '', startTime: '', endTime: '', slotType: 'headline', fee: '', notes: '' });
    setShowAdd(false);
    try {
      await fetch('/api/gigs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    } catch { setError('השמירה נכשלה'); setTimeout(() => setError(null), 3000); }
  };

  const cycleStatus = async (id) => {
    const next = gigs.map((g) => {
      if (g.id !== id) return g;
      const idx = STATUS_OPTIONS.indexOf(g.setStatus);
      return { ...g, setStatus: STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length] };
    });
    setGigs(next);
    const newStatus = next.find((g) => g.id === id)?.setStatus;
    try {
      await fetch(`/api/gigs/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setStatus: newStatus }) });
    } catch {}
  };

  const inputStyle = { background: '#131316', border: '1px solid #232326', color: '#F2F1ED' };

  if (!gigs) return <div className="min-h-screen flex items-center justify-center"><div style={{ color: '#8B8A85' }} className="text-sm">טוען...</div></div>;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = gigs.filter((g) => g.date >= today);
  const past = gigs.filter((g) => g.date < today);

  return (
    <div className="max-w-xl mx-auto px-5 py-8">
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · MATAN — PERFORMANCES
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold mb-1">לוח הופעות</h1>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-5">כל הופעה, הסט שלה, והסטטוס שלה — במקום אחד</p>

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-6" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14" fill="none" stroke="#46C7FF" strokeWidth="1.5" className="pulse-line" />
      </svg>

      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-sm font-semibold uppercase tracking-wide">הופעות קרובות ({upcoming.length})</h2>
        <button onClick={() => setShowAdd((v) => !v)} style={{ color: '#46C7FF' }} className="text-xs flex items-center gap-1"><Plus size={14} /> הוסף הופעה</button>
      </div>

      {showAdd && (
        <div style={{ background: '#131316', border: '1px solid #232326' }} className="rounded p-4 mb-6 space-y-2">
          <input type="date" dir="ltr" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={inputStyle} className="w-full rounded px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} placeholder="מקום (Venue)" style={inputStyle} className="rounded px-3 py-2 text-sm" />
            <input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="עיר" style={inputStyle} className="rounded px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="time" dir="ltr" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} style={inputStyle} className="rounded px-3 py-2 text-sm" />
            <input type="time" dir="ltr" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} style={inputStyle} className="rounded px-3 py-2 text-sm" />
          </div>
          <select value={draft.slotType} onChange={(e) => setDraft({ ...draft, slotType: e.target.value })} style={inputStyle} className="w-full rounded px-3 py-2 text-sm">
            {Object.entries(SLOT_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} placeholder="תמורה (אופציונלי)" style={inputStyle} className="w-full rounded px-3 py-2 text-sm" />
          <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="הערות" style={inputStyle} className="w-full rounded px-3 py-2 text-sm" />
          <button onClick={addGig} style={{ background: '#46C7FF', color: '#0A0A0C' }} className="rounded px-4 py-2 text-sm w-full">שמור הופעה</button>
        </div>
      )}

      {error && <div style={{ color: '#FF5A64' }} className="text-sm mb-4">{error}</div>}

      {upcoming.length === 0 ? (
        <p style={{ color: '#8B8A85' }} className="text-sm mb-8">אין הופעות קרובות רשומות</p>
      ) : (
        <div className="space-y-3 mb-8">
          {upcoming.map((g) => (
            <div key={g.id} style={{ background: '#131316', border: '1px solid #232326' }} className="rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-sm font-bold">{formatDate(g.date)}</span>
                <span style={{ color: '#46C7FF' }} className="text-xs">{SLOT_LABELS[g.slotType] || g.slotType}</span>
              </div>
              <div style={{ color: '#8B8A85' }} className="flex items-center gap-3 text-xs mb-2">
                <span className="flex items-center gap-1"><MapPin size={12} /> {g.venue}{g.city ? `, ${g.city}` : ''}</span>
                {(g.startTime || g.endTime) && (
                  <span dir="ltr" className="flex items-center gap-1"><Clock size={12} /> {g.startTime}–{g.endTime}</span>
                )}
              </div>
              {g.notes && <p className="text-sm mb-2">{g.notes}</p>}
              <button onClick={() => cycleStatus(g.id)} style={{ border: '1px solid #46C7FF', color: '#46C7FF' }} className="rounded px-2 py-1 text-xs">
                סטטוס סט: {g.setStatus} (לחץ לשינוי)
              </button>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#8B8A85' }} className="text-xs uppercase tracking-wide mb-2">הופעות עבר ({past.length})</h2>
          <div className="space-y-1">
            {past.map((g) => (
              <div key={g.id} style={{ color: '#8B8A85' }} className="text-xs">{formatDate(g.date)} — {g.venue}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
