import React, { useState, useEffect, useRef, useCallback } from 'react';
import Studio from './Studio.jsx';

const API = '';
const TOKEN_KEY = 'vovax_admin_token';

const DEPT_ORDER = [
  'publishing', 'brand', 'music', 'art', 'distribution',
  'production', 'sales', 'avovax', 'website', 'engineering',
  'cyber', 'finance', 'personal', 'recruiting', 'core',
];

const DEPT_META_FALLBACK = {
  music:        { label: 'יצירת מוזיקה',    icon: '🎵' },
  art:          { label: 'ART',             icon: '🎨' },
  publishing:   { label: 'פרסום אוטומטי',   icon: '📢' },
  brand:        { label: 'מותג וקול',       icon: '🔊' },
  distribution: { label: 'הפצה',            icon: '📡' },
  production:   { label: 'הפקה',            icon: '🎛️' },
  sales:        { label: 'מכירות ולייבלים', icon: '💼' },
  avovax:       { label: 'AVOVAX Label',     icon: '🏷️' },
  website:      { label: 'אתר',             icon: '🌐' },
  engineering:  { label: 'הנדסה',           icon: '⚙️' },
  cyber:        { label: 'סייבר',           icon: '🔒' },
  finance:      { label: 'כספים',           icon: '💰' },
  personal:     { label: 'ליבה אישית',      icon: '👤' },
  recruiting:   { label: 'גיוס וכישרונות',  icon: '🤝' },
  core:         { label: 'VOVAX Core',       icon: '⭐' },
};

const ST_CLR  = { published: '#4CAF50', approved: '#46C7FF', pending: '#FFB347', rejected: '#555' };
const QA_CLR  = { pass: '#4CAF50', fail: '#FF4444' };
const DEPLOY_CLR   = { SUCCESS: '#4CAF50', FAILED: '#FF4444', CRASHED: '#FF4444', BUILDING: '#46C7FF', DEPLOYING: '#46C7FF', SLEEPING: '#555', REMOVED: '#555', WAITING: '#FFB347' };
const DEPLOY_LABEL = { SUCCESS: '✓ הצלחה', FAILED: '✗ נכשל', CRASHED: '✗ קרס', BUILDING: '⏳ בנייה', DEPLOYING: '⏳ דפלוי', SLEEPING: '💤 ישן', REMOVED: 'הוסר', WAITING: '⏳ ממתין' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken()    { return localStorage.getItem(TOKEN_KEY); }
function authHdr()     { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }; }
function fmtTime(ms)   { return new Date(Number(ms)).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }); }
function fmtDate(ms)   { return new Date(Number(ms)).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function fmtIso(iso)   { return new Date(iso).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }); }

// ── Colours & chips ───────────────────────────────────────────────────────────

function StatusChip({ status }) {
  const clr = ST_CLR[status] ?? '#8B8A85';
  const lbl = { published: 'פורסם', approved: 'אושר', pending: 'ממתין', rejected: 'נדחה' }[status] ?? status;
  return <span style={{ fontSize: 10, color: clr, border: `1px solid ${clr}`, borderRadius: 4, padding: '1px 6px' }}>{lbl}</span>;
}

function QaChip({ status, reason }) {
  if (!status) return <span style={{ fontSize: 10, color: '#555' }}>QA ⏳</span>;
  const clr = QA_CLR[status] ?? '#555';
  return (
    <span title={reason ?? ''} style={{ fontSize: 10, color: clr, border: `1px solid ${clr}`, borderRadius: 4, padding: '1px 6px' }}>
      QA {status === 'pass' ? '✓' : '✗'}
    </span>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const d = await r.json();
      if (!r.ok) { setErr('סיסמה שגויה'); setLoading(false); return; }
      localStorage.setItem(TOKEN_KEY, d.token);
      onLogin();
    } catch { setErr('שגיאת חיבור'); setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 320, padding: 32 }}>
        <p style={{ color: '#46C7FF', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 8px' }}>VOVAX</p>
        <h1 style={{ color: '#F2F1ED', fontSize: 22, margin: '0 0 28px' }}>Command Center</h1>
        <form onSubmit={submit} dir="rtl">
          <input type="password" placeholder="סיסמה" value={pw} onChange={e => setPw(e.target.value)} autoFocus
            style={{ width: '100%', background: '#131316', border: '1px solid #232326', borderRadius: 6, color: '#F2F1ED', padding: '10px 12px', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }} />
          {err && <p style={{ color: '#FF4444', fontSize: 12, margin: '0 0 10px' }}>{err}</p>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', background: '#46C7FF', color: '#0A0A0C', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {loading ? '…' : 'כניסה'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage, data, onLogout, onRefresh, refreshing }) {
  const pendingVovax  = data?.pending?.length ?? 0;
  const pendingSignal = data?.pendingSignal ?? 0;
  const totalPending  = pendingVovax + pendingSignal;
  const deptMeta      = data?.deptMeta ?? DEPT_META_FALLBACK;

  const navItem = (key, label, icon, badge) => {
    const active = page === key;
    return (
      <button key={key} onClick={() => setPage(key)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'right', background: active ? '#18181C' : 'none', border: 'none', borderRadius: 6, color: active ? '#F2F1ED' : '#8B8A85', padding: '6px 10px', fontSize: 13, cursor: 'pointer', justifyContent: 'flex-start' }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {badge > 0 && (
          <span style={{ background: '#FF4444', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '1px 5px' }}>{badge}</span>
        )}
      </button>
    );
  };

  return (
    <div dir="rtl" style={{ width: 200, minWidth: 200, background: '#0D0D10', borderLeft: '1px solid #1a1a1d', height: '100vh', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', padding: '0 8px', overflow: 'hidden' }}>
      {/* Logo */}
      <div style={{ padding: '14px 10px 10px', borderBottom: '1px solid #1a1a1d', marginBottom: 6 }}>
        <div style={{ color: '#46C7FF', fontSize: 12, fontWeight: 700, letterSpacing: '0.15em' }}>VOVAX</div>
        <div style={{ color: '#555', fontSize: 10 }}>Command Center</div>
      </div>

      {/* Overview */}
      <div style={{ marginBottom: 6 }}>
        {navItem('overview', 'Overview', '🏠', totalPending)}
      </div>

      {/* Studio — the live co-creation session, distinct from the autonomous "יצירת מוזיקה" pipeline below */}
      <div style={{ marginBottom: 6 }}>
        <button onClick={() => setPage('studio')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'right',
            background: page === 'studio' ? '#F59E0B22' : '#F59E0B14',
            border: `1px solid ${page === 'studio' ? '#F59E0B' : '#F59E0B55'}`,
            borderRadius: 6, color: '#F59E0B', padding: '8px 10px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', justifyContent: 'flex-start',
          }}>
          <span style={{ fontSize: 15 }}>🎚️</span>
          <span style={{ flex: 1 }}>האולפן</span>
        </button>
      </div>

      <div style={{ borderTop: '1px solid #1a1a1d', paddingTop: 6, flex: 1, overflowY: 'auto' }}>
        {DEPT_ORDER.map(dKey => {
          const m = deptMeta[dKey] ?? DEPT_META_FALLBACK[dKey];
          if (!m) return null;
          const badge = dKey === 'publishing' ? totalPending : 0;
          return navItem(`dept/${dKey}`, m.label, m.icon, badge);
        })}
      </div>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid #1a1a1d', paddingTop: 8, paddingBottom: 12 }}>
        {navItem('chat', 'שיחה עם הצוות', '💬', 0)}
        <div style={{ display: 'flex', gap: 6, padding: '6px 10px 0' }}>
          <button onClick={onRefresh} disabled={refreshing}
            style={{ flex: 1, background: 'none', border: '1px solid #232326', color: '#8B8A85', borderRadius: 4, padding: '4px 0', fontSize: 10, cursor: 'pointer' }}>
            {refreshing ? '↻' : 'רענן'}
          </button>
          <button onClick={onLogout}
            style={{ flex: 1, background: 'none', border: 'none', color: '#555', fontSize: 10, cursor: 'pointer' }}>
            יציאה
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Overview page ─────────────────────────────────────────────────────────────

function OverviewPage({ data, setPage }) {
  const pending      = data?.pending ?? [];
  const activity     = data?.activity ?? [];
  const qaToday      = data?.qaToday ?? [];
  const deploys      = data?.deploys ?? [];
  const allEmps      = data?.employees ?? [];
  const deptMeta     = data?.deptMeta ?? DEPT_META_FALLBACK;
  const pendingSignal = data?.pendingSignal ?? 0;

  const grouped = {};
  for (const a of activity) {
    if (!grouped[a.channel]) grouped[a.channel] = {};
    grouped[a.channel][a.status] = a.cnt;
  }
  const qaPassed = qaToday.filter(r => r.qa_status === 'pass').length;
  const qaFailed = qaToday.filter(r => r.qa_status === 'fail').length;
  const lastDeploy = deploys[0];

  return (
    <div dir="rtl" style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 6px' }}>Overview</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 24px' }}>
        {new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {/* Snapshot bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
        {[
          { label: 'ממתין לאישור', value: (pending.length + pendingSignal) || '✓', clr: (pending.length + pendingSignal) > 0 ? '#FFB347' : '#4CAF50' },
          { label: 'QA היום',      value: `${qaPassed}✓ ${qaFailed}✗`,              clr: qaFailed > 0 ? '#FF4444' : '#4CAF50' },
          { label: 'טראקים ב-DB', value: data?.trackCount ?? '…',                   clr: '#46C7FF' },
          { label: 'דפלוי אחרון',  value: lastDeploy ? DEPLOY_LABEL[lastDeploy.status] ?? lastDeploy.status : '—', clr: lastDeploy ? (DEPLOY_CLR[lastDeploy.status] ?? '#555') : '#555' },
        ].map(s => (
          <div key={s.label} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ color: s.clr, fontSize: 16, fontWeight: 700, marginBottom: 3 }}>{s.value}</div>
            <div style={{ color: '#555', fontSize: 11 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Department cards */}
      <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>מחלקות</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 28 }}>
        {DEPT_ORDER.map(dKey => {
          const m = deptMeta[dKey] ?? DEPT_META_FALLBACK[dKey];
          if (!m) return null;
          const count = allEmps.filter(e => e.dept === dKey).length;
          const manager = allEmps.find(e => e.dept === dKey && !e.manager);
          return (
            <button key={dKey} onClick={() => setPage(`dept/${dKey}`)}
              style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 14px', textAlign: 'right', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#46C7FF'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1a1a1d'}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
              <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
              {manager && <div style={{ color: '#555', fontSize: 10 }}>{manager.name}</div>}
              <div style={{ color: '#555', fontSize: 10 }}>{count} עובדים</div>
            </button>
          );
        })}
      </div>

      {/* Pending items — links only, no approve buttons */}
      {pending.length > 0 && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
            ממתין לאישור — {pending.length} VOVAX{pendingSignal > 0 ? ` · ${pendingSignal} Signal` : ''}
          </h2>
          {pending.slice(0, 5).map(item => (
            <div key={item.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#F2F1ED', fontSize: 13, fontWeight: 600, marginLeft: 8 }}>{item.topic}</span>
                <QaChip status={item.qa_status} reason={item.qa_reason} />
                {item.track_title && <span style={{ color: '#555', fontSize: 11, marginRight: 8 }}>🎵 {item.track_title}</span>}
              </div>
              <button onClick={() => setPage('dept/publishing')}
                style={{ background: 'none', border: '1px solid #46C7FF', color: '#46C7FF', borderRadius: 5, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
                לאישור →
              </button>
            </div>
          ))}
          {pending.length > 5 && (
            <button onClick={() => setPage('dept/publishing')}
              style={{ background: 'none', border: 'none', color: '#46C7FF', fontSize: 12, cursor: 'pointer', padding: 0 }}>
              + {pending.length - 5} נוספות בדף פרסום
            </button>
          )}
        </>
      )}

      {/* Activity */}
      {Object.keys(grouped).length > 0 && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '20px 0 10px' }}>פעילות היום</h2>
          {Object.entries(grouped).map(([ch, sts]) => (
            <div key={ch} style={{ fontSize: 13, color: '#F2F1ED', marginBottom: 4 }}>
              <span style={{ color: '#555' }}>{ch === 'vovax' ? 'VOVAX' : 'Signal'}: </span>
              {Object.entries(sts).map(([st, cnt]) => (
                <span key={st} style={{ color: ST_CLR[st] ?? '#F2F1ED', marginLeft: 12 }}>{cnt} {st}</span>
              ))}
            </div>
          ))}
        </>
      )}

      {/* Last deploy */}
      {deploys.length > 0 && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '20px 0 10px' }}>Railway — אחרון</h2>
          {deploys.slice(0, 3).map((d, i) => (
            <div key={i} style={{ fontSize: 12, color: '#555', marginBottom: 3 }}>
              <span style={{ color: DEPLOY_CLR[d.status] ?? '#555', marginLeft: 8 }}>{DEPLOY_LABEL[d.status] ?? d.status}</span>
              {fmtIso(d.createdAt)}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Employee card ─────────────────────────────────────────────────────────────

function EmployeeCard({ emp, onChat }) {
  return (
    <div style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ color: '#F2F1ED', fontSize: 13, fontWeight: 600 }}>{emp.name}</div>
        <div style={{ color: '#555', fontSize: 11 }}>{emp.role}</div>
        {emp.manager && <div style={{ color: '#333', fontSize: 10 }}>→ {emp.manager}</div>}
      </div>
      {emp.skillFile && (
        <button onClick={() => onChat(emp.id)}
          style={{ background: 'none', border: '1px solid #232326', color: '#8B8A85', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
          שוחח
        </button>
      )}
    </div>
  );
}

// ── Media renderer ────────────────────────────────────────────────────────────

function MediaBlock({ url }) {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.match(/\.(mp3|wav|ogg|m4a)($|\?)/))
    return <audio controls src={url} style={{ width: '100%', marginTop: 6 }} />;
  if (lower.match(/\.(mp4|webm|mov)($|\?)/))
    return <video controls src={url} style={{ width: '100%', maxHeight: 200, marginTop: 6, borderRadius: 6 }} />;
  if (lower.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/))
    return <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: 200, marginTop: 6, borderRadius: 6 }} />;
  return null;
}

// ── Publishing department page ────────────────────────────────────────────────

function RejectModal({ item, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [busy,   setBusy]   = useState(false);

  async function confirm() {
    setBusy(true);
    await onConfirm(item.id, reason);
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 10, background: '#1a1010', border: '1px solid #3a1a1a', borderRadius: 8, padding: '12px 14px' }}>
      <p style={{ color: '#FF4444', fontSize: 12, margin: '0 0 8px' }}>דחייה + חידוש אוטומטי — ורסיה חדשה תוגש ל-HeyGen עם אותו טראק ונושא.</p>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="סיבת דחייה (אופציונלי)…"
        rows={2}
        style={{ width: '100%', background: '#131316', border: '1px solid #2a1a1a', borderRadius: 5, color: '#F2F1ED', padding: '6px 10px', fontSize: 12, resize: 'none', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={confirm} disabled={busy}
          style={{ background: '#2a0a0a', border: '1px solid #FF4444', color: '#FF4444', borderRadius: 5, padding: '5px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {busy ? '…' : '✗ אשר דחייה + חדש'}
        </button>
        <button onClick={onCancel}
          style={{ background: 'none', border: '1px solid #333', color: '#555', borderRadius: 5, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
          ביטול
        </button>
      </div>
    </div>
  );
}

function PublishingPage({ employees, onAction }) {
  const [deptData,   setDeptData]   = useState(null);
  const [approving,  setApproving]  = useState({});
  const [rejectOpen, setRejectOpen] = useState({});
  const [regen,      setRegen]      = useState({});
  const [tab,        setTab]        = useState('vovax');
  const [loadErr,    setLoadErr]    = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/dept/publishing`, { headers: authHdr() });
      const d = await r.json();
      if (!r.ok) { setLoadErr(d.error ?? `שגיאת שרת ${r.status}`); return; }
      setDeptData(d);
    } catch (e) { setLoadErr(e.message); }
  }, []);

  useEffect(() => {
    load();
    // Poll every 15s so rendering items flip to pending automatically
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function approve(id) {
    setApproving(a => ({ ...a, [id]: true }));
    await fetch(`${API}/api/publish/vovax/${id}/approve`, { method: 'POST', headers: authHdr() });
    await load();
    onAction();
    setApproving(a => ({ ...a, [id]: false }));
  }

  async function reject(id, reason) {
    const r = await fetch(`${API}/api/publish/vovax/${id}/reject`, {
      method: 'POST', headers: authHdr(),
      body: JSON.stringify({ reason }),
    });
    const d = await r.json();
    setRejectOpen(o => ({ ...o, [id]: false }));
    if (d.regenerated) setRegen(rg => ({ ...rg, [id]: d.regenerated }));
    await load();
    onAction();
  }

  const vovax  = deptData?.vovax  ?? [];
  const signal = deptData?.signal ?? [];
  const items  = tab === 'vovax' ? vovax : signal;

  const renderingCount = vovax.filter(i => i.status === 'rendering').length;

  const tabBtn = (key, label, count) => (
    <button onClick={() => setTab(key)}
      style={{ background: tab === key ? '#18181C' : 'none', border: 'none', color: tab === key ? '#F2F1ED' : '#555', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer', borderBottom: tab === key ? '2px solid #46C7FF' : '2px solid transparent' }}>
      {label} {count > 0 && <span style={{ color: '#FFB347', fontSize: 11 }}>({count})</span>}
    </button>
  );

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>📢 פרסום אוטומטי</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>{employees.length} עובדים — אסף (מנהל)</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 24 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 11 }}>{e.role}</div>
          </div>
        ))}
      </div>

      <div style={{ borderBottom: '1px solid #1a1a1d', marginBottom: 16 }}>
        {tabBtn('vovax',  'VOVAX',           vovax.filter(i => i.status === 'pending').length)}
        {tabBtn('signal', 'Signal Detected', signal.filter(i => i.status === 'pending').length)}
        {renderingCount > 0 && (
          <span style={{ fontSize: 11, color: '#46C7FF', marginRight: 12, verticalAlign: 'middle' }}>
            ⏳ {renderingCount} מתייצרים ב-HeyGen…
          </span>
        )}
      </div>

      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      {!deptData && !loadErr && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}

      {items.map(item => {
        const isPending  = item.status === 'pending';
        const isRendering = item.status === 'rendering';
        const channel    = tab;
        const regenInfo  = regen[item.id];

        return (
          <div key={item.id} style={{ background: '#0f0f12', border: `1px solid ${isPending && item.video_url ? '#1a2e1a' : isPending ? '#2a2010' : '#1a1a1d'}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#F2F1ED', fontWeight: 600, fontSize: 14 }}>{item.topic}</span>
                <StatusChip status={item.status} />
                <QaChip status={item.qa_status} reason={item.qa_reason} />
                {item.avatar_gender && (
                  <span style={{ fontSize: 10, color: item.avatar_gender === 'female' ? '#FF9ECD' : '#9EC4FF', border: `1px solid ${item.avatar_gender === 'female' ? '#FF9ECD' : '#9EC4FF'}`, borderRadius: 4, padding: '1px 6px' }}>
                    {item.avatar_gender === 'female' ? '♀' : '♂'} {item.avatar_gender}
                  </span>
                )}
                {item.regenerated_from && (
                  <span style={{ fontSize: 10, color: '#46C7FF', border: '1px solid #46C7FF', borderRadius: 4, padding: '1px 6px' }}>
                    חידוש #{item.rejection_count ?? 1}
                  </span>
                )}
              </div>
              <span style={{ color: '#555', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(item.created_at)}</span>
            </div>

            {/* Track */}
            {item.track_title && (
              <p style={{ color: '#8B8A85', fontSize: 12, margin: '0 0 10px' }}>
                🎵 {item.track_title}{item.track_genre ? ` · ${item.track_genre}` : ''}
              </p>
            )}

            {/* Rendering spinner */}
            {isRendering && (
              <div style={{ background: '#131316', border: '1px solid #1a2a3a', borderRadius: 8, padding: '16px', textAlign: 'center', margin: '0 0 10px' }}>
                <div style={{ color: '#46C7FF', fontSize: 13, marginBottom: 4 }}>⏳ HeyGen מייצר וידאו…</div>
                <div style={{ color: '#555', fontSize: 11 }}>יעודכן אוטומטית כשיסיים (בד"כ 3–8 דקות)</div>
                <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>
                  job: <code style={{ color: '#8B8A85' }}>{item.heygen_video_id}</code>
                </div>
              </div>
            )}

            {/* Finished video — shown prominently BEFORE approve/reject */}
            {item.video_url && (
              <div style={{ margin: '0 0 12px', borderRadius: 10, overflow: 'hidden', background: '#000', maxWidth: 320 }}>
                <video
                  controls
                  preload="metadata"
                  src={item.video_url}
                  style={{ width: '100%', display: 'block', maxHeight: 480 }}
                />
              </div>
            )}

            {/* Script text — always shown */}
            <p style={{ color: item.video_url ? '#8B8A85' : '#F2F1ED', fontSize: 13, lineHeight: 1.6, margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>
              "{item.script ?? ''}"
            </p>

            {/* QA failure detail */}
            {item.qa_status === 'fail' && item.qa_reason && (
              <div style={{ color: '#FF4444', fontSize: 12, margin: '0 0 10px', padding: '6px 10px', borderRight: '2px solid #FF4444', background: '#1a1010', borderRadius: 4 }}>
                {item.qa_reason}
                {item.qa_issues?.length > 0 && <div style={{ marginTop: 3 }}>{item.qa_issues.join(' · ')}</div>}
              </div>
            )}

            {/* Notes (rejection reason from prior version) */}
            {item.notes && item.notes !== 'HeyGen render failed — text only' && (
              <div style={{ color: '#555', fontSize: 11, margin: '0 0 10px', padding: '4px 8px', background: '#131316', borderRadius: 4 }}>
                הערה: {item.notes}
              </div>
            )}

            {/* Approve / Reject — VOVAX pending only, never on rendering items */}
            {isPending && channel === 'vovax' && (
              <>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => approve(item.id)}
                    disabled={approving[item.id]}
                    style={{ background: '#1a2e1a', border: '1px solid #4CAF50', color: '#4CAF50', borderRadius: 5, padding: '7px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {approving[item.id] ? '…' : '✓ אשר ופרסם'}
                  </button>
                  <button
                    onClick={() => setRejectOpen(o => ({ ...o, [item.id]: !o[item.id] }))}
                    disabled={approving[item.id]}
                    style={{ background: '#1a1010', border: '1px solid #555', color: '#8B8A85', borderRadius: 5, padding: '7px 20px', fontSize: 13, cursor: 'pointer' }}
                  >
                    ✗ דחה
                  </button>
                </div>

                {rejectOpen[item.id] && (
                  <RejectModal
                    item={item}
                    onConfirm={reject}
                    onCancel={() => setRejectOpen(o => ({ ...o, [item.id]: false }))}
                  />
                )}

                {regenInfo && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ color: '#4CAF50' }}>✓ מחולל מחדש — </span>
                    <span style={{ color: '#555' }}>
                      {regenInfo.status === 'rendering' ? 'HeyGen מייצר גרסה חדשה…' : 'גרסה חדשה נכנסה לתור'}
                    </span>
                  </div>
                )}
              </>
            )}

            {isPending && channel === 'signal' && (
              <div style={{ marginTop: 8 }}>
                <span style={{ color: '#555', fontSize: 11 }}>Signal — תצוגה בלבד בממשק זה</span>
              </div>
            )}
          </div>
        );
      })}

      {items.length === 0 && deptData && (
        <p style={{ color: '#4CAF50', fontSize: 13 }}>אין פריטים {tab === 'vovax' ? 'VOVAX' : 'Signal'} ✓</p>
      )}
    </div>
  );
}

// ── Brand & Voice page ────────────────────────────────────────────────────────

function BrandPage({ employees }) {
  const [deptData, setDeptData] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/admin/dept/brand`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : null).then(setDeptData);
  }, []);

  const qa = deptData?.qa ?? [];
  const passed = qa.filter(r => r.qa_status === 'pass').length;
  const failed = qa.filter(r => r.qa_status === 'fail').length;

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>🔊 מותג וקול</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>{employees.length} עובדים — שירה (מנהלת)</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 24 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 13, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 11 }}>{e.role}</div>
            {e.id === 'yuval' && <div style={{ color: '#46C7FF', fontSize: 10, marginTop: 2 }}>QA לכל הצינורות</div>}
          </div>
        ))}
      </div>

      <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
        היסטוריית QA — {passed} עברו · {failed} נכשלו
      </h2>

      {!deptData && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}
      {qa.length === 0 && deptData && <p style={{ color: '#555', fontSize: 13 }}>אין נתוני QA</p>}

      {qa.map(r => (
        <div key={r.id} style={{ background: '#131316', border: `1px solid ${r.qa_status === 'fail' ? '#2a1010' : '#1a1d1a'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <QaChip status={r.qa_status} reason={r.qa_reason} />
              <span style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{r.topic}</span>
              <span style={{ color: '#555', fontSize: 11 }}>{r.channel === 'vovax' ? 'VOVAX' : 'Signal'}</span>
            </div>
            <span style={{ color: '#555', fontSize: 11 }}>{fmtDate(r.qa_at)}</span>
          </div>
          {r.qa_reason && <div style={{ color: r.qa_status === 'fail' ? '#FF4444' : '#4CAF50', fontSize: 12 }}>{r.qa_reason}</div>}
          {r.qa_issues?.length > 0 && <div style={{ color: '#FF6644', fontSize: 11, marginTop: 2 }}>{r.qa_issues.join(' · ')}</div>}
          <div style={{ color: '#333', fontSize: 11, marginTop: 4 }}>"{(r.script ?? '').slice(0, 80)}…"</div>
        </div>
      ))}
    </div>
  );
}

// ── Distribution page ─────────────────────────────────────────────────────────

function DistributionPage({ employees }) {
  const [deptData, setDeptData] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/admin/dept/distribution`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : null).then(setDeptData);
  }, []);

  const tracks = deptData?.tracks ?? [];

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>📡 הפצה</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>{employees.length} עובדים — אורי (מנהל)</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 13, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 11 }}>{e.role}</div>
          </div>
        ))}
      </div>

      <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
        מאגר טראקים — {tracks.length} אחרונים
      </h2>
      {!deptData && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}
      {tracks.map(t => (
        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #1a1a1d', fontSize: 13 }}>
          <span style={{ color: '#F2F1ED' }}>{t.title}</span>
          <span style={{ color: '#555', fontSize: 11 }}>{t.genre ?? ''} · {fmtDate(t.synced_at)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Music page ────────────────────────────────────────────────────────────────

const MQ_STATUS_LABEL = {
  generating:    { label: 'מייצר…',        color: '#46C7FF' },
  talia_qa:      { label: 'QA טליה',        color: '#46C7FF' },
  amit_review:   { label: 'שער עמית',       color: '#FFB347' },
  user_pending:  { label: 'ממתין לאישורך',  color: '#FFD700' },
  user_approved: { label: 'אושר ✓',         color: '#4CAF50' },
  user_rejected: { label: 'נדחה',           color: '#8B8A85' },
  published:     { label: 'פורסם ✓',        color: '#4CAF50' },
  failed:        { label: 'נכשל ✗',         color: '#FF4444' },
};

function MusicPage({ employees }) {
  const [deptData,  setDeptData]  = useState(null);
  const [acting,    setActing]    = useState({});
  const [cycling,   setCycling]   = useState(false);

  const load = () => {
    fetch(`${API}/api/admin/dept/music`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : null).then(setDeptData);
  };
  useEffect(load, []);

  const tracks     = deptData?.tracks     ?? [];
  const musicQueue = deptData?.musicQueue ?? [];
  const pending    = musicQueue.filter(i => i.status === 'user_pending');
  const inProgress = musicQueue.filter(i => ['generating','talia_qa','amit_review'].includes(i.status));
  const done       = musicQueue.filter(i => ['user_approved','user_rejected','published','failed'].includes(i.status));

  const mqAction = async (id, action, body = {}) => {
    setActing(a => ({ ...a, [id]: action }));
    await fetch(`${API}/api/music/${id}/${action}`, {
      method: 'POST', headers: { ...authHdr(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setActing(a => ({ ...a, [id]: null }));
    load();
  };

  const triggerCycle = async () => {
    setCycling(true);
    await fetch(`${API}/api/music/cycle`, { method: 'POST', headers: authHdr() });
    setCycling(false);
    setTimeout(load, 2000);
  };

  const fmtAge = (ms) => {
    const diff = Date.now() - Number(ms);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `לפני ${h}ש׳ ${m}ד׳` : `לפני ${m}ד׳`;
  };

  const MQCard = ({ item }) => {
    const st  = MQ_STATUS_LABEL[item.status] ?? { label: item.status, color: '#8B8A85' };
    const isPending = item.status === 'user_pending';
    return (
      <div style={{ background: '#0D0D10', border: `1px solid ${isPending ? '#FFD70044' : '#1a1a1d'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <span style={{ color: st.color, fontSize: 11, fontWeight: 600 }}>{st.label}</span>
          <span style={{ color: '#444', fontSize: 10 }}>{fmtAge(item.created_at)}</span>
        </div>
        <div style={{ color: '#8B8A85', fontSize: 11, marginBottom: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {item.context_hour && <span>🎯 {item.context_hour}</span>}
          {item.platform     && <span>📱 {item.platform}</span>}
          {item.bpm          && <span>🥁 {item.bpm} BPM</span>}
          {item.duration_s   && <span>⏱ {Math.floor(item.duration_s/60)}:{String(item.duration_s%60).padStart(2,'0')}</span>}
          {item.mood         && <span>💭 {item.mood}</span>}
        </div>
        <div style={{ color: '#F2F1ED', fontSize: 12, lineHeight: 1.4, marginBottom: 8, wordBreak: 'break-word' }} dir="ltr">
          {(item.prompt ?? '').slice(0, 160)}{item.prompt?.length > 160 ? '…' : ''}
        </div>
        {item.talia_verdict && (
          <div style={{ fontSize: 11, color: item.talia_verdict === 'APPROVED' ? '#4CAF50' : item.talia_verdict === 'REJECTED' ? '#FF4444' : '#FFB347', marginBottom: 4 }}>
            טליה: {item.talia_verdict}
            {item.talia_result?.summary ? ` — ${item.talia_result.summary}` : ''}
          </div>
        )}
        {item.amit_reason && (
          <div style={{ fontSize: 11, color: item.amit_approved === true ? '#4CAF50' : item.amit_approved === false ? '#FF9944' : '#8B8A85', marginBottom: 6 }}>
            עמית: {item.amit_reason}
          </div>
        )}
        {item.audio_urls?.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {item.audio_urls.map((u, i) => <audio key={i} controls src={u} style={{ width: '100%', marginTop: 4 }} />)}
          </div>
        )}
        {isPending && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => mqAction(item.id, 'user-approve')} disabled={!!acting[item.id]}
              style={{ background: acting[item.id] ? '#232326' : '#4CAF50', color: '#0A0A0C', border: 'none', borderRadius: 5, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              {acting[item.id] === 'user-approve' ? '…' : 'אשר ✓'}
            </button>
            <button onClick={() => mqAction(item.id, 'user-reject', { reason: 'נדחה על ידי המשתמש' })} disabled={!!acting[item.id]}
              style={{ background: 'transparent', color: '#FF4444', border: '1px solid #FF444466', borderRadius: 5, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>
              {acting[item.id] === 'user-reject' ? '…' : 'דחה ✗'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: 0 }}>🎵 יצירת מוזיקה</h1>
        <button onClick={triggerCycle} disabled={cycling}
          style={{ background: cycling ? '#232326' : '#0D1A20', color: cycling ? '#555' : '#46C7FF', border: '1px solid #46C7FF44', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
          {cycling ? 'מריץ…' : '⚡ הפעל מחזור עמית'}
        </button>
      </div>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>{employees.length} עובדים — עמית (מנהל) · {pending.length} ממתינים לאישורך</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: 24 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <>
          <h2 style={{ color: '#FFD700', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>
            ממתין לאישורך — {pending.length}
          </h2>
          {pending.map(i => <MQCard key={i.id} item={i} />)}
        </>
      )}

      {inProgress.length > 0 && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 10px' }}>
            בייצור — {inProgress.length}
          </h2>
          {inProgress.map(i => <MQCard key={i.id} item={i} />)}
        </>
      )}

      {done.length > 0 && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 10px' }}>
            היסטוריה — {done.length}
          </h2>
          {done.slice(0, 10).map(i => <MQCard key={i.id} item={i} />)}
        </>
      )}

      {musicQueue.length === 0 && !deptData && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}
      {musicQueue.length === 0 && deptData && (
        <p style={{ color: '#555', fontSize: 13 }}>אין פריטים בתור — לחץ "הפעל מחזור עמית" להתחיל</p>
      )}

      {tracks.length > 0 && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '24px 0 10px' }}>
            טראקים אחרונים — {tracks.length}
          </h2>
          {tracks.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1a1a1d', fontSize: 13 }}>
              <span style={{ color: '#F2F1ED' }}>{t.title}</span>
              <span style={{ color: '#555', fontSize: 11 }}>{t.genre ?? ''}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Sales page ────────────────────────────────────────────────────────────────

function SalesPage({ employees }) {
  const [deptData, setDeptData] = useState(null);
  const [loadErr,  setLoadErr]  = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/dept/sales`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setDeptData)
      .catch(e => setLoadErr(String(e)));
  }, []);

  const gigsUpcoming = deptData?.gigsUpcoming ?? [];
  const gigsPast     = deptData?.gigsPast     ?? [];
  const topTracks    = deptData?.topTracks    ?? [];
  const pubStats     = deptData?.pubStats     ?? { published: 0, published_30d: 0 };
  const totalFee     = gigsUpcoming.reduce((s, g) => s + (Number(g.fee) || 0), 0);

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>💼 מכירות ולייבלים</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים — רז (מנהל)
      </p>

      {/* Roster */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6, marginBottom: 28 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
          </div>
        ))}
      </div>

      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      {!deptData && !loadErr && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}

      {deptData && (
        <>
          {/* Snapshot */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 28 }}>
            {[
              { label: 'הופעות קרובות',     value: gigsUpcoming.length,          color: '#46C7FF' },
              { label: 'הכנסות צפויות',     value: totalFee > 0 ? `₪${totalFee.toLocaleString()}` : '—', color: '#4CAF50' },
              { label: 'וידאו פורסמו סה"כ', value: pubStats.published,           color: '#FFB347' },
              { label: 'טראקים לפיץ׳',      value: topTracks.length,             color: '#8B8A85' },
            ].map(s => (
              <div key={s.label} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ color: s.color, fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{s.value}</div>
                <div style={{ color: '#555', fontSize: 11 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Gig pipeline — קרן */}
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
            פייפליין הופעות (קרן) — {gigsUpcoming.length} קרובות
          </h2>

          {gigsUpcoming.length === 0 && (
            <p style={{ color: '#555', fontSize: 13, marginBottom: 20 }}>אין הופעות קרובות</p>
          )}

          {gigsUpcoming.map(g => (
            <div key={g.id} style={{ background: '#131316', border: '1px solid #1a2a1a', borderRadius: 8, padding: '10px 14px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#46C7FF', fontSize: 10, marginBottom: 2 }}>{g.date}</div>
                <div style={{ color: '#F2F1ED', fontSize: 13, fontWeight: 600 }}>{g.venue}</div>
                {g.city && <div style={{ color: '#555', fontSize: 11 }}>{g.city}</div>}
                {(g.slotType || g.startTime) && (
                  <div style={{ color: '#8B8A85', fontSize: 10 }}>
                    {g.slotType}{g.startTime ? ` · ${g.startTime}` : ''}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'left' }}>
                {g.fee
                  ? <div style={{ color: '#4CAF50', fontSize: 14, fontWeight: 700 }}>₪{Number(g.fee).toLocaleString()}</div>
                  : <div style={{ color: '#333', fontSize: 12 }}>טרם תומחר</div>
                }
                {g.setStatus && <div style={{ color: '#555', fontSize: 10, marginTop: 2 }}>{g.setStatus}</div>}
              </div>
            </div>
          ))}

          {gigsPast.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: '#333', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '12px 0 8px' }}>
                עבר — {gigsPast.length}
              </div>
              {gigsPast.slice(-3).reverse().map(g => (
                <div key={g.id} style={{ background: '#0D0D10', border: '1px solid #1a1a1d', borderRadius: 6, padding: '7px 12px', marginBottom: 4, opacity: 0.5, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8B8A85', fontSize: 12 }}>{g.venue}{g.city ? `, ${g.city}` : ''}</span>
                  <span style={{ color: '#555', fontSize: 11 }}>{g.date}{g.fee ? ` · ₪${Number(g.fee).toLocaleString()}` : ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* Top tracks for label pitches — איתן */}
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '8px 0 12px' }}>
            טראקים לפיץ׳ ללייבלים (איתן) — Top {topTracks.length} לפי השמעות
          </h2>

          {topTracks.length === 0 && (
            <p style={{ color: '#555', fontSize: 13 }}>אין טראקים ב-DB</p>
          )}

          <div style={{ background: '#0D0D10', border: '1px solid #1a1a1d', borderRadius: 8, overflow: 'hidden' }}>
            {topTracks.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: i < topTracks.length - 1 ? '1px solid #131316' : 'none' }}>
                <span style={{ color: '#333', fontSize: 11, width: 18, textAlign: 'left', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.permalink_url
                      ? <a href={t.permalink_url} target="_blank" rel="noreferrer" style={{ color: '#F2F1ED', textDecoration: 'none' }}>{t.title}</a>
                      : t.title}
                  </div>
                  {t.genre && <div style={{ color: '#555', fontSize: 10 }}>{t.genre}</div>}
                </div>
                {t.durationFmt && <span style={{ color: '#555', fontSize: 10, flexShrink: 0 }}>{t.durationFmt}</span>}
                <span style={{ color: t.play_count > 1000 ? '#4CAF50' : '#8B8A85', fontSize: 11, fontWeight: 600, flexShrink: 0, minWidth: 50, textAlign: 'right' }}>
                  {(t.play_count ?? 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Art & Visual page ─────────────────────────────────────────────────────────

function ArtPage({ employees }) {
  const [deptData, setDeptData] = useState(null);
  const [loadErr,  setLoadErr]  = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/dept/art`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setDeptData)
      .catch(e => setLoadErr(String(e)));
  }, []);

  const videos = deptData?.videos ?? [];
  const stats  = deptData?.stats  ?? { total_renders: 0, published: 0, this_month: 0 };
  const manager = employees.find(e => !e.manager);

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>🎨 ART</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים{manager ? ` — ${manager.name} (מנהל)` : ''} · צוות דינמי לפי צורך
      </p>

      {/* Roster */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: 28 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
            {e.manager && <div style={{ color: '#333', fontSize: 10 }}>← {e.manager}</div>}
          </div>
        ))}
      </div>

      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      {!deptData && !loadErr && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}

      {deptData && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 28 }}>
            {[
              { label: 'וידאו הופקו (HeyGen)',     value: stats.total_renders, color: '#46C7FF' },
              { label: 'פורסמו',                    value: stats.published,     color: '#4CAF50' },
              { label: 'הפקות החודש',               value: stats.this_month,    color: '#FFB347' },
            ].map(s => (
              <div key={s.label} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ color: s.color, fontSize: 20, fontWeight: 700, marginBottom: 2 }}>{s.value}</div>
                <div style={{ color: '#555', fontSize: 11 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Video gallery */}
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>
            פלט ויזואלי — {videos.length} וידאו אחרונים
          </h2>

          {videos.length === 0 && (
            <p style={{ color: '#555', fontSize: 13 }}>אין וידאו מוכנים עדיין</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {videos.map(v => (
              <div key={v.id} style={{ background: '#0D0D10', border: '1px solid #1a1a1d', borderRadius: 10, overflow: 'hidden' }}>
                <video
                  src={v.video_url}
                  controls
                  preload="metadata"
                  style={{ width: '100%', display: 'block', maxHeight: 220, background: '#000' }}
                />
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{v.topic}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: v.status === 'published' ? '#4CAF50' : '#8B8A85', border: `1px solid ${v.status === 'published' ? '#4CAF50' : '#333'}`, borderRadius: 3, padding: '1px 5px' }}>
                      {v.status === 'published' ? 'פורסם' : v.status}
                    </span>
                    {v.avatar_gender && (
                      <span style={{ fontSize: 10, color: v.avatar_gender === 'female' ? '#FF9ECD' : '#9EC4FF' }}>
                        {v.avatar_gender === 'female' ? '♀' : '♂'}
                      </span>
                    )}
                    <span style={{ color: '#333', fontSize: 10 }}>{fmtDate(v.created_at)}</span>
                  </div>
                  {v.script && (
                    <div style={{ color: '#555', fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
                      "{v.script.slice(0, 80)}{v.script.length > 80 ? '…' : ''}"
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Finance page ──────────────────────────────────────────────────────────────

function FinancePage({ employees }) {
  const [deptData, setDeptData] = useState(null);
  const [loadErr,  setLoadErr]  = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/dept/finance`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setDeptData)
      .catch(e => setLoadErr(String(e)));
  }, []);

  const gigs        = deptData?.gigs        ?? [];
  const totalFees   = deptData?.totalFees   ?? 0;
  const musicStats  = deptData?.musicStats  ?? { total: 0, succeeded: 0, this_month: 0 };
  const renderStats = deptData?.renderStats ?? { total: 0, this_month: 0 };
  const ledger      = deptData?.costLedger  ?? '';
  const gigsWithFee = gigs.filter(g => g.fee);

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>💰 כספים</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים — נטע (מנהלת)
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6, marginBottom: 28 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
          </div>
        ))}
      </div>

      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      {!deptData && !loadErr && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}

      {deptData && (
        <>
          {/* API usage — proxy for variable costs */}
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
            שימוש בכלים — 30 יום אחרונים
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
            {[
              { label: 'Pixazo / ACE-Step (מוזיקה)', value: musicStats.this_month, sub: `${musicStats.total} סה"כ`, color: '#46C7FF' },
              { label: 'HeyGen (וידאו)', value: renderStats.this_month, sub: `${renderStats.total} סה"כ`, color: '#FF9ECD' },
              { label: 'הכנסות הופעות (רשומות)', value: totalFees > 0 ? `₪${totalFees.toLocaleString()}` : '—', sub: `${gigsWithFee.length} הופעות עם עלות`, color: '#4CAF50' },
            ].map(s => (
              <div key={s.label} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ color: s.color, fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{s.value}</div>
                <div style={{ color: '#F2F1ED', fontSize: 11, marginBottom: 2 }}>{s.label}</div>
                <div style={{ color: '#555', fontSize: 10 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Gig income breakdown */}
          {gigsWithFee.length > 0 && (
            <>
              <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
                הכנסות הופעות
              </h2>
              <div style={{ marginBottom: 24 }}>
                {gigsWithFee.map(g => (
                  <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: '#131316', border: '1px solid #1a1a1d', borderRadius: 6, marginBottom: 4 }}>
                    <div>
                      <span style={{ color: '#F2F1ED', fontSize: 12 }}>{g.venue}</span>
                      {g.city && <span style={{ color: '#555', fontSize: 11, marginRight: 6 }}>, {g.city}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ color: '#555', fontSize: 11 }}>{g.date}</span>
                      <span style={{ color: '#4CAF50', fontSize: 13, fontWeight: 600 }}>₪{Number(g.fee).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', fontSize: 13, fontWeight: 700, color: '#4CAF50' }}>
                  סה"כ: ₪{totalFees.toLocaleString()}
                </div>
              </div>
            </>
          )}

          {/* Cost ledger */}
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
            מרשם עלויות (cost-ledger.md)
          </h2>
          {ledger ? (
            <pre style={{ background: '#0D0D10', border: '1px solid #1a1a1d', borderRadius: 8, padding: '14px 16px', color: '#8B8A85', fontSize: 11, lineHeight: 1.7, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', direction: 'ltr', textAlign: 'left' }}>
              {ledger}
            </pre>
          ) : (
            <p style={{ color: '#555', fontSize: 12 }}>cost-ledger.md לא נמצא</p>
          )}
        </>
      )}
    </div>
  );
}

// ── Personal Core page ────────────────────────────────────────────────────────

function PersonalPage({ employees }) {
  const [deptData, setDeptData] = useState(null);
  const [loadErr,  setLoadErr]  = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/dept/personal`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setDeptData)
      .catch(e => setLoadErr(String(e)));
  }, []);

  const tasks   = deptData?.tasks   ?? { active: [], waiting: [], someday: [], done: [] };
  const gigs    = deptData?.gigs    ?? [];
  const manager = employees.find(e => !e.manager);
  const today   = new Date().toISOString().slice(0, 10);
  const upcoming = gigs.filter(g => g.date >= today);
  const past     = gigs.filter(g => g.date < today);

  const SECTION_META = {
    active:  { label: 'פעיל',   color: '#46C7FF' },
    waiting: { label: 'ממתין',  color: '#FFB347' },
    someday: { label: 'יום אחד', color: '#8B8A85' },
    done:    { label: 'הושלם',  color: '#4CAF50' },
  };

  const totalOpen = tasks.active.length + tasks.waiting.length + tasks.someday.length;

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>👤 ליבה אישית</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים{manager ? ` — ${manager.name} (מנהל)` : ''}
      </p>

      {/* Employee roster */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: 28 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
          </div>
        ))}
      </div>

      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      {!deptData && !loadErr && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}

      {/* Tasks — נועה */}
      {deptData && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
            משימות (נועה) — {totalOpen} פתוחות · {tasks.done.length} הושלמו
          </h2>

          {['active', 'waiting', 'someday'].map(section => {
            const items = tasks[section];
            if (!items.length) return null;
            const { label, color } = SECTION_META[section];
            return (
              <div key={section} style={{ marginBottom: 14 }}>
                <div style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {label} — {items.length}
                </div>
                {items.map(t => (
                  <div key={t.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 6, padding: '7px 12px', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#F2F1ED', fontSize: 12 }}>{t.title}</span>
                    <span style={{ color: '#333', fontSize: 10, whiteSpace: 'nowrap', marginRight: 8 }}>{fmtDate(t.added)}</span>
                  </div>
                ))}
              </div>
            );
          })}

          {tasks.done.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: '#4CAF50', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                הושלמו — {tasks.done.length}
              </div>
              {tasks.done.slice(0, 5).map(t => (
                <div key={t.id} style={{ background: '#0D120D', border: '1px solid #1a2a1a', borderRadius: 6, padding: '7px 12px', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.65 }}>
                  <span style={{ color: '#8B8A85', fontSize: 12 }}>{t.title}</span>
                  <span style={{ color: '#333', fontSize: 10, whiteSpace: 'nowrap', marginRight: 8 }}>{t.completed ? fmtDate(t.completed) : ''}</span>
                </div>
              ))}
            </div>
          )}

          {totalOpen === 0 && tasks.done.length === 0 && (
            <p style={{ color: '#555', fontSize: 13, marginBottom: 20 }}>אין משימות עדיין</p>
          )}

          {/* Gigs — מתן */}
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '8px 0 12px' }}>
            הופעות (מתן) — {upcoming.length} קרובות{past.length > 0 ? ` · ${past.length} עברו` : ''}
          </h2>

          {upcoming.length === 0 && past.length === 0 && (
            <p style={{ color: '#555', fontSize: 13, marginBottom: 20 }}>אין הופעות רשומות</p>
          )}

          {upcoming.map(g => (
            <div key={g.id} style={{ background: '#131316', border: '1px solid #1a2a1a', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#46C7FF', fontSize: 11, marginBottom: 2 }}>{g.date}</div>
                <div style={{ color: '#F2F1ED', fontSize: 13, fontWeight: 600 }}>{g.venue}</div>
                {g.city && <div style={{ color: '#555', fontSize: 11 }}>{g.city}</div>}
                {g.slotType && <div style={{ color: '#8B8A85', fontSize: 10 }}>{g.slotType}{g.startTime ? ` · ${g.startTime}` : ''}</div>}
              </div>
              {g.fee && <div style={{ color: '#4CAF50', fontSize: 12, fontWeight: 600 }}>₪{Number(g.fee).toLocaleString()}</div>}
            </div>
          ))}

          {past.length > 0 && (
            <>
              <div style={{ color: '#333', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '12px 0 8px' }}>עבר</div>
              {past.slice(-3).reverse().map(g => (
                <div key={g.id} style={{ background: '#0D0D10', border: '1px solid #1a1a1d', borderRadius: 8, padding: '8px 12px', marginBottom: 6, opacity: 0.5, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ color: '#555', fontSize: 11 }}>{g.date}</div>
                    <div style={{ color: '#8B8A85', fontSize: 12 }}>{g.venue}{g.city ? `, ${g.city}` : ''}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Email / Calendar — not integrated yet */}
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '20px 0 10px' }}>
            אימייל (מאיה) · לוח שנה (תומר)
          </h2>
          <div style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 16px' }}>
            <p style={{ color: '#555', fontSize: 12, margin: 0 }}>בקרוב — ממתין לחיבור Gmail + Google Calendar (Task #6)</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Generic department page ───────────────────────────────────────────────────

function GenericDeptPage({ deptKey, employees }) {
  const meta = DEPT_META_FALLBACK[deptKey] ?? { label: deptKey, icon: '📁' };
  const manager = employees.find(e => !e.manager);

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>{meta.icon} {meta.label}</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים{manager ? ` — ${manager.name} (מנהל)` : ''}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 24 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 13, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 11 }}>{e.role}</div>
            {e.manager && <div style={{ color: '#333', fontSize: 10 }}>← {e.manager}</div>}
          </div>
        ))}
      </div>

      <div style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '14px 16px' }}>
        <p style={{ color: '#555', fontSize: 13, margin: 0 }}>אין אינטגרציה עם Backend עדיין — תצוגת עובדים בלבד.</p>
      </div>
    </div>
  );
}

// ── Global Chat page ──────────────────────────────────────────────────────────

function ChatPage({ allEmployees, initialEmployee }) {
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [employeeId,  setEmployeeId]  = useState(initialEmployee ?? '');
  const [loading,     setLoading]     = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (initialEmployee) setEmployeeId(initialEmployee); }, [initialEmployee]);

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/chat`, {
        method: 'POST', headers: authHdr(),
        body: JSON.stringify({ message: msg, employeeId: employeeId || undefined }),
      });
      const d = await r.json();
      setMessages(m => [...m, { role: 'assistant', text: d.response ?? d.error ?? 'שגיאה', employeeId }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'שגיאת חיבור', employeeId }]);
    }
    setLoading(false);
  }

  const withSkill  = allEmployees.filter(e => e.skillFile);
  const noSkill    = allEmployees.filter(e => !e.skillFile);
  const activeEmp  = allEmployees.find(e => e.id === employeeId);

  return (
    <div dir="rtl" style={{ padding: '24px 28px', maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>💬 שיחה עם הצוות</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>כל {allEmployees.length} עובדים זמינים — עובדים עם SKILL.md מגיבים בתפקיד</p>

      {/* Employee selector */}
      <div style={{ marginBottom: 16 }}>
        <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}
          style={{ width: '100%', background: '#131316', border: '1px solid #232326', color: employeeId ? '#F2F1ED' : '#8B8A85', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}>
          <option value=''>כללי — VOVAX System Context</option>
          <optgroup label="עם SKILL.md (מגיב בתפקיד)">
            {withSkill.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
          </optgroup>
          <optgroup label="ללא SKILL.md (VOVAX context כללי)">
            {noSkill.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
          </optgroup>
        </select>
        {activeEmp && (
          <div style={{ color: '#555', fontSize: 11, padding: '4px 2px' }}>
            {activeEmp.skillFile ? `✓ SKILL.md טעון — ${activeEmp.name} מגיב בתפקיד` : `מגיב עם context כללי — אין SKILL.md ל${activeEmp.name}`}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ minHeight: 200, maxHeight: 420, overflowY: 'auto', marginBottom: 12, borderTop: '1px solid #1a1a1d', paddingTop: 12 }}>
        {messages.length === 0 && (
          <p style={{ color: '#555', fontSize: 13 }}>בחר עובד ושאל שאלה…</p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            {m.role === 'user' ? (
              <div style={{ textAlign: 'right' }}>
                <span style={{ background: '#18181C', border: '1px solid #232326', borderRadius: 8, padding: '7px 12px', display: 'inline-block', fontSize: 13, color: '#F2F1ED' }}>
                  {m.text}
                </span>
              </div>
            ) : (
              <div>
                <div style={{ color: '#46C7FF', fontSize: 10, marginBottom: 3 }}>
                  {m.employeeId ? (allEmployees.find(e => e.id === m.employeeId)?.name ?? m.employeeId) : 'VOVAX System'}
                </div>
                <div style={{ color: '#F2F1ED', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.text}</div>
              </div>
            )}
          </div>
        ))}
        {loading && <p style={{ color: '#555', fontSize: 12 }}>…</p>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="שאל שאלה…"
          style={{ flex: 1, background: '#131316', border: '1px solid #232326', borderRadius: 6, color: '#F2F1ED', padding: '8px 12px', fontSize: 13 }} />
        <button onClick={send} disabled={loading}
          style={{ background: '#46C7FF', color: '#0A0A0C', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          שלח
        </button>
      </div>
    </div>
  );
}

// ── Production (Mix/Master) page ─────────────────────────────────────────────

function ProductionPage({ employees }) {
  const [deptData, setDeptData] = useState(null);
  const [loadErr,  setLoadErr]  = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/dept/production`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setDeptData)
      .catch(e => setLoadErr(String(e)));
  }, []);

  const queue   = deptData?.queue ?? [];
  const manager = employees.find(e => !e.manager);
  const STAGE_CLR = { mix: '#FFB347', master: '#46C7FF', done: '#4CAF50' };
  const STAGE_LBL = { mix: 'מיקס', master: 'מאסטרינג', done: 'הושלם' };

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>🎛️ הפקה</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים{manager ? ` — ${manager.name} (מנהל)` : ''}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: 28 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
          </div>
        ))}
      </div>
      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      {!deptData && !loadErr && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}
      {deptData && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
            תור הפקה — {queue.length} פריטים
          </h2>
          {queue.length === 0 && <p style={{ color: '#555', fontSize: 13 }}>תור ריק — אין פריטי הפקה פעילים</p>}
          {['mix', 'master', 'done'].map(stage => {
            const items = queue.filter(i => i.stage === stage);
            if (!items.length) return null;
            return (
              <div key={stage} style={{ marginBottom: 16 }}>
                <div style={{ color: STAGE_CLR[stage], fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {STAGE_LBL[stage]} — {items.length}
                </div>
                {items.map(item => (
                  <div key={item.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 6, padding: '8px 12px', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#F2F1ED', fontSize: 12 }}>{item.title}</span>
                    <span style={{ color: '#555', fontSize: 10 }}>{item.assigned_to ?? '—'}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── AVOVAX Label page ─────────────────────────────────────────────────────────

function AVOVAXPage({ employees }) {
  const [deptData, setDeptData] = useState(null);
  const [loadErr,  setLoadErr]  = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/dept/avovax`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setDeptData)
      .catch(e => setLoadErr(String(e)));
  }, []);

  const catalog = deptData?.catalog ?? [];
  const manager = employees.find(e => !e.manager);
  const STATUS_CLR = { in_progress: '#FFB347', released: '#4CAF50', shelved: '#555' };
  const STATUS_LBL = { in_progress: 'בעבודה', released: 'שוחרר', shelved: 'מוקפא' };

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>🏷️ AVOVAX Label</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים{manager ? ` — ${manager.name} (מנהל)` : ''}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: 28 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
          </div>
        ))}
      </div>
      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      {!deptData && !loadErr && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}
      {deptData && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
            קטלוג שחרורים — {catalog.length} פריטים
          </h2>
          {catalog.length === 0 && <p style={{ color: '#555', fontSize: 13 }}>אין שחרורים רשומים עדיין</p>}
          {catalog.map(item => (
            <div key={item.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#F2F1ED', fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                {item.artist && <div style={{ color: '#8B8A85', fontSize: 11 }}>{item.artist}</div>}
                {item.release_date && <div style={{ color: '#555', fontSize: 10 }}>{item.release_date}</div>}
              </div>
              <span style={{ color: STATUS_CLR[item.status] ?? '#555', border: `1px solid ${STATUS_CLR[item.status] ?? '#333'}`, borderRadius: 3, padding: '2px 7px', fontSize: 10, flexShrink: 0 }}>
                {STATUS_LBL[item.status] ?? item.status}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Website page ──────────────────────────────────────────────────────────────

function WebsitePage({ employees }) {
  const [deptData, setDeptData] = useState(null);
  const [loadErr,  setLoadErr]  = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/dept/website`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setDeptData)
      .catch(e => setLoadErr(String(e)));
  }, []);

  const tasks   = deptData?.tasks ?? [];
  const manager = employees.find(e => !e.manager);
  const PRIO_CLR   = { high: '#FF4444', normal: '#FFB347', low: '#555' };
  const STATUS_CLR = { open: '#46C7FF', in_progress: '#FFB347', done: '#4CAF50' };
  const STATUS_LBL = { open: 'פתוח', in_progress: 'בעבודה', done: 'הושלם' };
  const open = tasks.filter(t => t.status !== 'done');
  const done = tasks.filter(t => t.status === 'done');

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>🌐 אתר</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים{manager ? ` — ${manager.name} (מנהל)` : ''}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: 28 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
          </div>
        ))}
      </div>
      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      {!deptData && !loadErr && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}
      {deptData && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
            משימות אתר — {open.length} פתוחות · {done.length} הושלמו
          </h2>
          {tasks.length === 0 && <p style={{ color: '#555', fontSize: 13 }}>אין משימות אתר עדיין</p>}
          {open.map(t => (
            <div key={t.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 6, padding: '8px 12px', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIO_CLR[t.priority] ?? '#555', flexShrink: 0, display: 'inline-block' }} />
                <span style={{ color: '#F2F1ED', fontSize: 12 }}>{t.title}</span>
              </div>
              <span style={{ color: STATUS_CLR[t.status] ?? '#555', fontSize: 10 }}>{STATUS_LBL[t.status] ?? t.status}</span>
            </div>
          ))}
          {done.length > 0 && (
            <>
              <div style={{ color: '#333', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '12px 0 8px' }}>הושלמו</div>
              {done.slice(0, 5).map(t => (
                <div key={t.id} style={{ background: '#0D0D10', border: '1px solid #1a1a1d', borderRadius: 6, padding: '7px 12px', marginBottom: 4, opacity: 0.55 }}>
                  <span style={{ color: '#8B8A85', fontSize: 12 }}>{t.title}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Engineering page ──────────────────────────────────────────────────────────

function EngineeringPage({ employees }) {
  const [deptData,     setDeptData]     = useState(null);
  const [loadErr,      setLoadErr]      = useState('');
  const [aliveData,    setAliveData]    = useState(null);
  const [aliveLoading, setAliveLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/admin/dept/engineering`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setDeptData)
      .catch(e => setLoadErr(String(e)));
  }, []);

  async function runAliveCheck() {
    setAliveLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/engineering/alive-check`, { headers: authHdr() });
      setAliveData(await r.json());
    } catch (e) { setLoadErr(String(e)); }
    setAliveLoading(false);
  }

  const deploys = deptData?.deploys ?? [];
  const manager = employees.find(e => !e.manager);
  const problems = (aliveData?.results ?? []).filter(r => !r.fileOk || r.alive === false);

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>⚙️ הנדסה</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים{manager ? ` — ${manager.name} (מנהל)` : ''}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: 28 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
          </div>
        ))}
      </div>
      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
        בדיקת עובדים חיים
      </h2>
      <button onClick={runAliveCheck} disabled={aliveLoading}
        style={{ background: '#131316', border: '1px solid #232326', color: '#46C7FF', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: aliveLoading ? 'default' : 'pointer', marginBottom: 16 }}>
        {aliveLoading ? 'בודק…' : '▶ הרץ Alive Check'}
      </button>
      {aliveData && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'סה"כ עובדים', value: aliveData.summary?.total,    color: '#F2F1ED' },
              { label: 'חיים',         value: aliveData.summary?.alive,    color: '#4CAF50' },
              { label: 'בעיה',         value: (aliveData.summary?.degraded ?? 0) + (aliveData.summary?.dead ?? 0), color: '#FF4444' },
            ].map(s => (
              <div key={s.label} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ color: s.color, fontSize: 18, fontWeight: 700 }}>{s.value}</div>
                <div style={{ color: '#555', fontSize: 11 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {problems.length === 0
            ? <p style={{ color: '#4CAF50', fontSize: 13, marginBottom: 16 }}>כל העובדים פעילים ✓</p>
            : problems.map(r => (
              <div key={r.id} style={{ background: '#1A0D0D', border: '1px solid #2a1a1a', borderRadius: 6, padding: '7px 12px', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#FF9999', fontSize: 12 }}>{r.name} ({r.role})</span>
                <span style={{ color: '#555', fontSize: 11 }}>{r.value}</span>
              </div>
            ))}
        </>
      )}
      {deploys.length > 0 && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '20px 0 12px' }}>
            דפלויים אחרונים
          </h2>
          {deploys.map((d, i) => (
            <div key={i} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 6, padding: '7px 12px', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: DEPLOY_CLR[d.status] ?? '#555', fontSize: 12 }}>{DEPLOY_LABEL[d.status] ?? d.status}</span>
              <span style={{ color: '#555', fontSize: 11 }}>{fmtIso(d.createdAt)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Cybersecurity page ────────────────────────────────────────────────────────

function CyberPage({ employees }) {
  const [deptData, setDeptData] = useState(null);
  const [loadErr,  setLoadErr]  = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/dept/cyber`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setDeptData)
      .catch(e => setLoadErr(String(e)));
  }, []);

  const securityLog = deptData?.securityLog ?? [];
  const assessment  = deptData?.assessment  ?? {};
  const manager     = employees.find(e => !e.manager);
  const SEV_CLR = { critical: '#FF4444', warning: '#FFB347', info: '#4CAF50' };

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>🔒 סייבר</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים{manager ? ` — ${manager.name} (מנהל)` : ''}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: 28 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
          </div>
        ))}
      </div>
      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      {!deptData && !loadErr && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}
      {deptData && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>API Key Scoping</h2>
          {(assessment.apiKeys ?? []).map(k => (
            <div key={k.key} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 6, padding: '7px 12px', marginBottom: 4, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ color: '#46C7FF', fontSize: 11, fontFamily: 'monospace' }}>{k.key}</span>
              <span style={{ color: '#8B8A85', fontSize: 11 }}>{k.scope}</span>
            </div>
          ))}

          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '20px 0 12px' }}>כיסוי אודיט לוגים</h2>
          {(assessment.auditCoverage ?? []).map((item, i) => (
            <div key={i} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 6, padding: '7px 12px', marginBottom: 4, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: item.covered ? '#4CAF50' : '#FF4444', fontSize: 12, flexShrink: 0 }}>{item.covered ? '✓' : '✗'}</span>
              <div>
                <div style={{ color: '#F2F1ED', fontSize: 12 }}>{item.area}</div>
                {item.note && <div style={{ color: '#555', fontSize: 11 }}>{item.note}</div>}
              </div>
            </div>
          ))}

          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '20px 0 12px' }}>בידוד רשת</h2>
          <div style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ color: '#8B8A85', fontSize: 12, margin: 0, lineHeight: 1.7 }}>{assessment.networkIsolation}</p>
          </div>

          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>המלצות פעולה</h2>
          {(assessment.recommendations ?? []).map((r, i) => (
            <div key={i} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 6, padding: '8px 12px', marginBottom: 4, display: 'flex', gap: 10 }}>
              <span style={{ color: '#FFB347', fontSize: 11, flexShrink: 0 }}>{i + 1}.</span>
              <span style={{ color: '#F2F1ED', fontSize: 12 }}>{r}</span>
            </div>
          ))}

          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '20px 0 12px' }}>
            יומן אבטחה — {securityLog.length} אירועים אחרונים
          </h2>
          {securityLog.length === 0 && <p style={{ color: '#555', fontSize: 13 }}>אין אירועים ביומן עדיין</p>}
          {securityLog.map(ev => (
            <div key={ev.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 6, padding: '7px 12px', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: SEV_CLR[ev.severity] ?? '#555', border: `1px solid ${SEV_CLR[ev.severity] ?? '#333'}`, borderRadius: 3, padding: '1px 5px', fontSize: 9 }}>{ev.severity}</span>
                <span style={{ color: '#F2F1ED', fontSize: 12 }}>{ev.description}</span>
              </div>
              <span style={{ color: '#555', fontSize: 10, whiteSpace: 'nowrap' }}>{fmtDate(ev.created_at)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Recruiting page ───────────────────────────────────────────────────────────

function RecruitingPage({ employees }) {
  const [deptData, setDeptData] = useState(null);
  const [loadErr,  setLoadErr]  = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/dept/recruiting`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setDeptData)
      .catch(e => setLoadErr(String(e)));
  }, []);

  const hiringLog = deptData?.hiringLog ?? [];
  const manager   = employees.find(e => !e.manager);
  const STAGE_CLR = { applied: '#46C7FF', screening: '#FFB347', interview: '#FF9ECD', offer: '#4CAF50', hired: '#4CAF50', rejected: '#555' };
  const STAGE_LBL = { applied: 'הגיש', screening: 'סינון', interview: 'ראיון', offer: 'הצעה', hired: 'נקלט', rejected: 'נדחה' };
  const active = hiringLog.filter(h => !['hired', 'rejected'].includes(h.stage));
  const closed = hiringLog.filter(h => ['hired', 'rejected'].includes(h.stage));

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>🤝 גיוס וכישרונות</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים{manager ? ` — ${manager.name} (מנהל)` : ''}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: 28 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
          </div>
        ))}
      </div>
      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      {!deptData && !loadErr && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}
      {deptData && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
            פייפליין גיוס — {active.length} פעיל · {closed.filter(h => h.stage === 'hired').length} נקלטו
          </h2>
          {hiringLog.length === 0 && <p style={{ color: '#555', fontSize: 13 }}>אין מועמדים רשומים עדיין</p>}
          {active.map(h => (
            <div key={h.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#F2F1ED', fontSize: 13, fontWeight: 600 }}>{h.candidate}</div>
                <div style={{ color: '#8B8A85', fontSize: 11 }}>{h.role}{h.dept ? ` · ${h.dept}` : ''}</div>
              </div>
              <span style={{ color: STAGE_CLR[h.stage] ?? '#555', border: `1px solid ${STAGE_CLR[h.stage] ?? '#333'}`, borderRadius: 3, padding: '2px 7px', fontSize: 10, flexShrink: 0 }}>
                {STAGE_LBL[h.stage] ?? h.stage}
              </span>
            </div>
          ))}
          {closed.length > 0 && (
            <>
              <div style={{ color: '#333', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '12px 0 8px' }}>סגורים</div>
              {closed.slice(0, 5).map(h => (
                <div key={h.id} style={{ background: '#0D0D10', border: '1px solid #1a1a1d', borderRadius: 6, padding: '7px 12px', marginBottom: 4, opacity: 0.55, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8B8A85', fontSize: 12 }}>{h.candidate} — {h.role}</span>
                  <span style={{ color: h.stage === 'hired' ? '#4CAF50' : '#555', fontSize: 10 }}>{STAGE_LBL[h.stage] ?? h.stage}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── VOVAX Core page ───────────────────────────────────────────────────────────

function CorePage({ employees }) {
  const [deptData, setDeptData] = useState(null);
  const [loadErr,  setLoadErr]  = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/dept/core`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setDeptData)
      .catch(e => setLoadErr(String(e)));
  }, []);

  const decisions = deptData?.decisions ?? [];
  const SCOPE_CLR = { company: '#46C7FF', dept: '#FFB347', product: '#FF9ECD' };

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>⭐ VOVAX Core</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>
        {employees.length} עובדים
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: 28 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 10 }}>{e.role}</div>
          </div>
        ))}
      </div>
      {loadErr && <p style={{ color: '#FF4444', fontSize: 13 }}>שגיאה: {loadErr}</p>}
      {!deptData && !loadErr && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}
      {deptData && (
        <>
          <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
            יומן החלטות — {decisions.length} רשומות
          </h2>
          {decisions.length === 0 && <p style={{ color: '#555', fontSize: 13 }}>אין החלטות רשומות עדיין — אלון יתעד כאן החלטות ניהוליות</p>}
          {decisions.map(d => (
            <div key={d.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ color: '#F2F1ED', fontSize: 13, fontWeight: 600 }}>{d.title}</div>
                {d.scope && (
                  <span style={{ color: SCOPE_CLR[d.scope] ?? '#555', border: `1px solid ${SCOPE_CLR[d.scope] ?? '#333'}`, borderRadius: 3, padding: '2px 7px', fontSize: 10, flexShrink: 0 }}>
                    {d.scope}
                  </span>
                )}
              </div>
              <div style={{ color: '#8B8A85', fontSize: 12, marginBottom: 6, lineHeight: 1.6 }}>{d.decision}</div>
              <div style={{ display: 'flex', gap: 14, color: '#555', fontSize: 10 }}>
                {d.decided_by && <span>{d.decided_by}</span>}
                <span>{fmtDate(d.decided_at)}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Admin() {
  const [authed,     setAuthed]     = useState(!!getToken());
  const [page,       setPage]       = useState('overview');
  const [data,       setData]       = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chatEmp,    setChatEmp]    = useState('');

  const load = useCallback(async () => {
    if (!getToken()) return;
    setRefreshing(true);
    try {
      const r = await fetch(`${API}/api/admin/dashboard`, { headers: authHdr() });
      if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); setAuthed(false); return; }
      // also fetch track count separately since dashboard doesn't include it
      const d = await r.json();
      setData(d);
    } catch {}
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (authed) { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }
  }, [authed, load]);

  function openChat(empId) { setChatEmp(empId); setPage('chat'); }

  if (!authed) return <LoginScreen onLogin={() => { setAuthed(true); load(); }} />;

  const allEmployees = data?.employees ?? [];
  const deptKey = page.startsWith('dept/') ? page.slice(5) : null;
  const deptEmployees = deptKey ? allEmployees.filter(e => e.dept === deptKey) : [];

  function renderPage() {
    if (page === 'overview')       return <OverviewPage data={data} setPage={setPage} />;
    if (page === 'chat')           return <ChatPage allEmployees={allEmployees} initialEmployee={chatEmp} />;
    if (page === 'studio')         return <Studio />;
    if (!deptKey)                  return <OverviewPage data={data} setPage={setPage} />;
    if (deptKey === 'publishing')   return <PublishingPage employees={deptEmployees} onAction={load} />;
    if (deptKey === 'brand')        return <BrandPage employees={deptEmployees} />;
    if (deptKey === 'distribution') return <DistributionPage employees={deptEmployees} />;
    if (deptKey === 'music')        return <MusicPage employees={deptEmployees} />;
    if (deptKey === 'sales')        return <SalesPage employees={deptEmployees} />;
    if (deptKey === 'art')          return <ArtPage employees={deptEmployees} />;
    if (deptKey === 'finance')      return <FinancePage employees={deptEmployees} />;
    if (deptKey === 'personal')     return <PersonalPage employees={deptEmployees} />;
    if (deptKey === 'production')   return <ProductionPage employees={deptEmployees} />;
    if (deptKey === 'avovax')       return <AVOVAXPage employees={deptEmployees} />;
    if (deptKey === 'website')      return <WebsitePage employees={deptEmployees} />;
    if (deptKey === 'engineering')  return <EngineeringPage employees={deptEmployees} />;
    if (deptKey === 'cyber')        return <CyberPage employees={deptEmployees} />;
    if (deptKey === 'recruiting')   return <RecruitingPage employees={deptEmployees} />;
    if (deptKey === 'core')         return <CorePage employees={deptEmployees} />;
    return <GenericDeptPage deptKey={deptKey} employees={deptEmployees} />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0A0C', color: '#F2F1ED', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <Sidebar
        page={page}
        setPage={(p) => { setChatEmp(''); setPage(p); }}
        data={data}
        onLogout={() => { localStorage.removeItem(TOKEN_KEY); setAuthed(false); }}
        onRefresh={load}
        refreshing={refreshing}
      />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!data ? (
          <div style={{ padding: 40, color: '#555', fontSize: 13 }}>טוען…</div>
        ) : renderPage()}
      </div>
    </div>
  );
}
