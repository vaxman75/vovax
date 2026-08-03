import React, { useState, useEffect, useRef, useCallback } from 'react';

const API = '';
const TOKEN_KEY = 'vovax_admin_token';

const DEPT_ORDER = [
  'publishing', 'brand', 'music', 'art', 'distribution',
  'production', 'sales', 'avovax', 'website', 'engineering',
  'cyber', 'finance', 'personal', 'core',
];

const DEPT_META_FALLBACK = {
  music:        { label: 'יצירת מוזיקה',    icon: '🎵' },
  art:          { label: 'אמנות וויזואל',   icon: '🎨' },
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

function MusicPage({ employees }) {
  const [deptData, setDeptData] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/admin/dept/music`, { headers: authHdr() })
      .then(r => r.ok ? r.json() : null).then(setDeptData);
  }, []);

  const tracks = deptData?.tracks ?? [];

  return (
    <div dir="rtl" style={{ padding: '24px 28px' }}>
      <h1 style={{ color: '#F2F1ED', fontSize: 20, margin: '0 0 4px' }}>🎵 יצירת מוזיקה</h1>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 20px' }}>{employees.length} עובדים — עמית (מנהל)</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 24 }}>
        {employees.map(e => (
          <div key={e.id} style={{ background: '#131316', border: '1px solid #1a1a1d', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ color: '#F2F1ED', fontSize: 12, fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: '#555', fontSize: 11 }}>{e.role}</div>
            {e.manager && <div style={{ color: '#333', fontSize: 10 }}>← {e.manager}</div>}
          </div>
        ))}
      </div>

      <h2 style={{ color: '#8B8A85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
        טראקים אחרונים — {tracks.length}
      </h2>
      {!deptData && <p style={{ color: '#555', fontSize: 13 }}>טוען…</p>}
      {tracks.map(t => (
        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #1a1a1d', fontSize: 13 }}>
          <span style={{ color: '#F2F1ED' }}>{t.title}</span>
          <span style={{ color: '#555', fontSize: 11 }}>{t.genre ?? ''}</span>
        </div>
      ))}
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
    if (!deptKey)                  return <OverviewPage data={data} setPage={setPage} />;
    if (deptKey === 'publishing')  return <PublishingPage employees={deptEmployees} onAction={load} />;
    if (deptKey === 'brand')       return <BrandPage employees={deptEmployees} />;
    if (deptKey === 'distribution') return <DistributionPage employees={deptEmployees} />;
    if (deptKey === 'music')       return <MusicPage employees={deptEmployees} />;
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
