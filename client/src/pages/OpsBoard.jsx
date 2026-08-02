import React, { useState, useEffect } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STAGES = [
  { key: 'active', label: 'בעבודה עכשיו' },
  { key: 'waiting', label: 'ממתין להעברה' },
  { key: 'done', label: 'הושלם לאחרונה' },
];

export default function OpsBoard() {
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ item: '', owner: '', dept: '', nextOwner: '' });

  useEffect(() => {
    fetch('/api/ops').then((r) => r.json()).then(setBoard).catch(() => setBoard({ active: [], waiting: [], done: [] }));
  }, []);

  const showError = (msg) => { setError(msg); setTimeout(() => setError(null), 3000); };

  const addItem = async () => {
    if (!draft.item.trim() || !board) return;
    const entry = { id: uid(), item: draft.item.trim(), owner: draft.owner.trim() || '—', dept: draft.dept.trim() || '—', nextOwner: draft.nextOwner.trim(), updated: new Date().toISOString() };
    setBoard((b) => ({ ...b, active: [entry, ...b.active] }));
    setDraft({ item: '', owner: '', dept: '', nextOwner: '' });
    setShowAdd(false);
    try {
      await fetch('/api/ops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    } catch { showError('השמירה נכשלה'); }
  };

  const moveItem = async (fromStage, id, toStage) => {
    const item = board[fromStage].find((x) => x.id === id);
    if (!item) return;
    setBoard((b) => ({
      ...b,
      [fromStage]: b[fromStage].filter((x) => x.id !== id),
      [toStage]: [{ ...item, updated: new Date().toISOString() }, ...b[toStage]],
    }));
    try {
      await fetch(`/api/ops/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: toStage }) });
    } catch { showError('עדכון נכשל'); }
  };

  const inputStyle = { background: '#131316', border: '1px solid #232326', color: '#F2F1ED' };

  if (!board) return <div className="min-h-screen flex items-center justify-center"><div style={{ color: '#8B8A85' }} className="text-sm">טוען...</div></div>;

  return (
    <div className="max-w-xl mx-auto px-5 py-8">
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · AVIV — OPS COORDINATION
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold mb-1">לוח תיאום פעולות</h1>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-5">מי עובד על מה עכשיו, ומה עובר ליד מי הבא</p>

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-6" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14" fill="none" stroke="#46C7FF" strokeWidth="1.5" className="pulse-line" />
      </svg>

      <div className="flex items-center justify-between mb-4">
        <span style={{ color: '#8B8A85' }} className="text-xs">{board.active.length} פעילים · {board.waiting.length} ממתינים</span>
        <button onClick={() => setShowAdd((v) => !v)} style={{ color: '#46C7FF' }} className="text-xs flex items-center gap-1"><Plus size={14} /> פריט חדש</button>
      </div>

      {showAdd && (
        <div style={{ background: '#131316', border: '1px solid #232326' }} className="rounded p-4 mb-6 space-y-2">
          {[['item', 'מה זה (למשל: טראק חדש מ-ACE-Step)'], ['owner', 'בעל המשימה (למשל: בן)'], ['dept', 'מחלקה (למשל: יצירה)'], ['nextOwner', 'למי עובר הבא (למשל: טליה — QA)']].map(([k, ph]) => (
            <input key={k} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} placeholder={ph} style={inputStyle} className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" onKeyDown={(e) => { if (e.key === 'Enter' && k === 'nextOwner') addItem(); }} />
          ))}
          <button onClick={addItem} style={{ background: '#46C7FF', color: '#0A0A0C' }} className="rounded px-4 py-2 text-sm w-full">הוסף</button>
        </div>
      )}

      {error && <div style={{ color: '#FF5A64' }} className="text-sm mb-4">{error}</div>}

      <div className="space-y-8">
        {STAGES.map((stage) => (
          <div key={stage.key}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", color: stage.key === 'done' ? '#8B8A85' : '#F2F1ED' }} className="text-sm font-semibold uppercase tracking-wide mb-3">
              {stage.label} ({board[stage.key].length})
            </h2>
            {board[stage.key].length === 0 ? (
              <p style={{ color: '#8B8A85' }} className="text-sm">אין כאן כלום עכשיו</p>
            ) : (
              <ul className="space-y-2">
                {board[stage.key].map((it) => (
                  <li key={it.id} style={{ background: '#131316', border: '1px solid #232326' }} className="rounded px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{it.item}</span>
                      <span style={{ color: '#8B8A85' }} className="text-xs shrink-0">{formatDate(it.updated)}</span>
                    </div>
                    <div style={{ color: '#8B8A85' }} className="text-xs mb-2">
                      {it.dept} · אצל {it.owner}
                      {it.nextOwner && stage.key !== 'done' && <span> <ArrowLeft size={10} className="inline" /> הבא: {it.nextOwner}</span>}
                    </div>
                    <div className="flex gap-2">
                      {stage.key === 'active' && <button onClick={() => moveItem('active', it.id, 'waiting')} style={{ color: '#46C7FF' }} className="text-xs">�� ממתין להעברה</button>}
                      {stage.key === 'waiting' && <button onClick={() => moveItem('waiting', it.id, 'done')} style={{ color: '#46C7FF' }} className="text-xs">→ סמן כהושלם</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
