import React, { useState, useEffect, useRef, useCallback } from 'react';

const API = '';
const TOKEN_KEY = 'vovax_admin_token';
const CH = { vovax: 'VOVAX', signal: 'Signal Detected' };
const ST_CLR = { published: '#4CAF50', approved: '#46C7FF', pending: '#FFB347', rejected: '#8B8A85' };
const DEPLOY_CLR = { SUCCESS: '#4CAF50', FAILED: '#FF4444', CRASHED: '#FF4444', BUILDING: '#46C7FF', DEPLOYING: '#46C7FF', SLEEPING: '#8B8A85', REMOVED: '#8B8A85', WAITING: '#FFB347' };
const DEPLOY_LABEL = { SUCCESS: '✓ הצלחה', FAILED: '✗ נכשל', CRASHED: '✗ קרס', BUILDING: '⏳ בנייה', DEPLOYING: '⏳ דפלוי', SLEEPING: '💤 ישן', REMOVED: 'הוסר', WAITING: '⏳ ממתין' };
const EMPLOYEES = [
  { id: '', label: 'כללי (VOVAX context)' },
  { id: 'yuval', label: 'יובל — בדיקת תוכן' },
  { id: 'asaf', label: 'אסף — מנהל פרסום' },
  { id: 'tal', label: 'טל — תסריט' },
  { id: 'adam', label: 'אדם — אבטחה' },
  { id: 'nadav', label: 'נדב — ניטור' },
  { id: 'shira', label: 'שירה — מותג' },
];

function token() { return localStorage.getItem(TOKEN_KEY); }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }; }
function fmtTime(ms) {
  return new Date(Number(ms)).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(ms) {
  return new Date(Number(ms)).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDeployTime(iso) {
  return new Date(iso).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Login screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const r = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await r.json();
      if (!r.ok) { setErr('סיסמה שגויה'); setLoading(false); return; }
      localStorage.setItem(TOKEN_KEY, data.token);
      onLogin();
    } catch {
      setErr('שגיאת חיבור');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 320, padding: 32 }}>
        <p style={{ color: '#46C7FF', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 8px' }}>VOVAX</p>
        <h1 style={{ color: '#F2F1ED', fontSize: 22, margin: '0 0 28px' }}>Command Center</h1>
        <form onSubmit={handleSubmit} dir="rtl">
          <input
            type="password"
            placeholder="סיסמה"
            value={pw}
            onChange={e => setPw(e.target.value)}
            autoFocus
            style={{ width: '100%', background: '#131316', border: '1px solid #232326', borderRadius: 6, color: '#F2F1ED', padding: '10px 12px', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
          />
          {err && <p style={{ color: '#FF4444', fontSize: 12, margin: '0 0 10px' }}>{err}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: '#46C7FF', color: '#0A0A0C', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            {loading ? '…' : 'כניסה'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <h2 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8B8A85', margin: '0 0 10px', borderTop: '1px solid #232326', paddingTop: 16 }}>
      {children}
    </h2>
  );
}

// ── Pending queue ─────────────────────────────────────────────────────────────

function PendingQueue({ items, onAction }) {
  const [acting, setActing] = useState({});

  async function act(id, action) {
    setActing(a => ({ ...a, [id]: action }));
    await fetch(`${API}/api/publish/vovax/${id}/${action}`, { method: 'POST', headers: authHeaders() });
    onAction();
    setActing(a => ({ ...a, [id]: null }));
  }

  if (items.length === 0) {
    return <p style={{ color: '#4CAF50', fontSize: 13, margin: '0 0 16px' }}>אין טיוטות ממתינות ✓</p>;
  }

  return (
    <div style={{ marginBottom: 4 }}>
      {items.map(item => {
        const qa = item.qa_status;
        const qaLabel = qa === 'pass'
          ? <span style={{ color: '#4CAF50', fontSize: 11 }}>QA ✓</span>
          : qa === 'fail'
            ? <span style={{ color: '#FF4444', fontSize: 11 }} title={item.qa_reason}>QA ✗</span>
            : <span style={{ color: '#8B8A85', fontSize: 11 }}>QA ⏳</span>;

        return (
          <div key={item.id} dir="rtl" style={{ background: '#131316', border: '1px solid #232326', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#F2F1ED', fontWeight: 600, fontSize: 13 }}>{item.topic}</span>
                <span style={{ color: '#8B8A85', fontSize: 11 }}>Instagram</span>
                {qaLabel}
              </div>
              <span style={{ color: '#8B8A85', fontSize: 11 }}>{fmtDateTime(item.created_at)}</span>
            </div>

            <p style={{ color: '#F2F1ED', fontSize: 14, lineHeight: 1.5, margin: '0 0 6px' }}>
              "{item.script}"
            </p>

            {item.track_title && (
              <p style={{ color: '#8B8A85', fontSize: 11, margin: '0 0 8px' }}>
                🎵 {item.track_title}{item.track_genre ? ` · ${item.track_genre}` : ''}
              </p>
            )}

            {qa === 'fail' && item.qa_reason && (
              <p style={{ color: '#FF4444', fontSize: 11, margin: '0 0 10px', borderRight: '2px solid #FF4444', paddingRight: 8 }}>
                {item.qa_reason}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
              <button
                onClick={() => act(item.id, 'approve')}
                disabled={!!acting[item.id]}
                style={{ background: '#1a2e1a', border: '1px solid #4CAF50', color: '#4CAF50', borderRadius: 5, padding: '5px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >
                {acting[item.id] === 'approve' ? '…' : '✓ אשר'}
              </button>
              <button
                onClick={() => act(item.id, 'reject')}
                disabled={!!acting[item.id]}
                style={{ background: '#1a1010', border: '1px solid #8B8A85', color: '#8B8A85', borderRadius: 5, padding: '5px 16px', fontSize: 12, cursor: 'pointer' }}
              >
                {acting[item.id] === 'reject' ? '…' : '✗ דחה'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Activity summary ──────────────────────────────────────────────────────────

function ActivitySummary({ activity }) {
  const grouped = {};
  for (const row of activity) {
    if (!grouped[row.channel]) grouped[row.channel] = {};
    grouped[row.channel][row.status] = row.cnt;
  }
  if (Object.keys(grouped).length === 0) {
    return <p style={{ color: '#8B8A85', fontSize: 13 }}>אין פעילות היום</p>;
  }
  return (
    <div style={{ marginBottom: 4 }}>
      {Object.entries(grouped).map(([ch, statuses]) => (
        <div key={ch} dir="rtl" style={{ marginBottom: 6 }}>
          <span style={{ color: '#F2F1ED', fontSize: 13, fontWeight: 600 }}>{CH[ch] ?? ch}: </span>
          {Object.entries(statuses).map(([st, cnt]) => (
            <span key={st} style={{ color: ST_CLR[st] ?? '#F2F1ED', fontSize: 13, marginLeft: 10 }}>
              {cnt} {st}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── QA section ────────────────────────────────────────────────────────────────

function QaSection({ qaToday }) {
  if (qaToday.length === 0) return <p style={{ color: '#8B8A85', fontSize: 13 }}>לא הורץ QA היום</p>;
  const passed = qaToday.filter(r => r.qa_status === 'pass').length;
  const failed = qaToday.filter(r => r.qa_status === 'fail').length;
  return (
    <div dir="rtl">
      <p style={{ margin: '0 0 8px', fontSize: 13 }}>
        <span style={{ color: '#4CAF50' }}>{passed} עברו ✓</span>
        {'  '}
        <span style={{ color: '#FF4444' }}>{failed} נכשלו ✗</span>
        {'  '}
        <span style={{ color: '#8B8A85' }}>— יובל</span>
      </p>
      {qaToday.filter(r => r.qa_status === 'fail').map(r => (
        <div key={r.id} style={{ background: '#1a1010', border: '1px solid #2a1a1a', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
            <span style={{ color: '#FF4444' }}>✗ </span>
            <span style={{ color: '#F2F1ED' }}>{CH[r.channel] ?? r.channel} · {r.topic}</span>
          </div>
          <div style={{ color: '#8B8A85', fontSize: 12 }}>"{(r.script ?? '').slice(0, 80)}…"</div>
          {r.qa_issues?.length > 0 && (
            <div style={{ color: '#FF4444', fontSize: 11, marginTop: 4 }}>{r.qa_issues.join(' · ')}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Signal section (read-only) ────────────────────────────────────────────────

function SignalSection({ items }) {
  if (items.length === 0) return <p style={{ color: '#8B8A85', fontSize: 13 }}>אין פוסטים אחרונים</p>;
  return (
    <div dir="rtl">
      {items.map(item => {
        const qa = item.qa_status;
        const qaLabel = qa === 'pass' ? <span style={{ color: '#4CAF50', fontSize: 11 }}>✓</span>
          : qa === 'fail' ? <span style={{ color: '#FF4444', fontSize: 11 }} title={item.qa_reason}>✗</span>
          : <span style={{ color: '#8B8A85', fontSize: 11 }}>⏳</span>;
        return (
          <div key={item.id} style={{ borderBottom: '1px solid #232326', padding: '8px 0', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#8B8A85' }}>{item.topic} {qaLabel}</span>
              <span style={{ color: '#8B8A85', fontSize: 11 }}>{fmtTime(item.created_at)}</span>
            </div>
            <span style={{ color: item.status === 'published' ? '#4CAF50' : item.status === 'approved' ? '#46C7FF' : '#F2F1ED' }}>
              "{(item.script ?? '').slice(0, 90)}{item.script?.length > 90 ? '…' : ''}"
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Deploys section ───────────────────────────────────────────────────────────

function DeploysSection({ deploys }) {
  if (!deploys || deploys.length === 0) return <p style={{ color: '#8B8A85', fontSize: 13 }}>אין דפלויים ב-48 שעות האחרונות</p>;
  return (
    <div dir="rtl">
      {deploys.map((d, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, marginBottom: 4, alignItems: 'baseline' }}>
          <span style={{ color: DEPLOY_CLR[d.status] ?? '#8B8A85', minWidth: 80 }}>{DEPLOY_LABEL[d.status] ?? d.status}</span>
          <span style={{ color: '#8B8A85', minWidth: 90, fontSize: 12 }}>{fmtDeployTime(d.createdAt)}</span>
          {d.reason && <span style={{ color: '#8B8A85', fontSize: 11 }}>({d.reason})</span>}
        </div>
      ))}
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────

function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [employee, setEmployee] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/chat`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ message: msg, employee: employee || undefined }),
      });
      const data = await r.json();
      setMessages(m => [...m, { role: 'assistant', text: data.response ?? data.error ?? 'שגיאה', employee }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'שגיאת חיבור', employee }]);
    }
    setLoading(false);
  }

  const empLabel = EMPLOYEES.find(e => e.id === employee)?.label ?? 'כללי';

  return (
    <div dir="rtl">
      <div style={{ minHeight: 120, maxHeight: 320, overflowY: 'auto', marginBottom: 10 }}>
        {messages.length === 0 && (
          <p style={{ color: '#8B8A85', fontSize: 13 }}>שאל שאלה על המערכת, הטיוטות, הטראקים, או הפנה לעובד ספציפי…</p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            {m.role === 'user' ? (
              <div style={{ textAlign: 'right' }}>
                <span style={{ background: '#131316', border: '1px solid #232326', borderRadius: 8, padding: '6px 12px', display: 'inline-block', fontSize: 13, color: '#F2F1ED' }}>
                  {m.text}
                </span>
              </div>
            ) : (
              <div>
                <div style={{ color: '#46C7FF', fontSize: 10, marginBottom: 2 }}>
                  {m.employee ? EMPLOYEES.find(e => e.id === m.employee)?.label : 'VOVAX System'}
                </div>
                <div style={{ color: '#F2F1ED', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.text}</div>
              </div>
            )}
          </div>
        ))}
        {loading && <p style={{ color: '#8B8A85', fontSize: 12 }}>…</p>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={employee}
          onChange={e => setEmployee(e.target.value)}
          style={{ background: '#131316', border: '1px solid #232326', color: '#8B8A85', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
        >
          {EMPLOYEES.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="שאל שאלה…"
          style={{ flex: 1, background: '#131316', border: '1px solid #232326', borderRadius: 6, color: '#F2F1ED', padding: '6px 10px', fontSize: 13 }}
        />
        <button
          onClick={send}
          disabled={loading}
          style={{ background: '#46C7FF', color: '#0A0A0C', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          שלח
        </button>
      </div>
    </div>
  );
}

// ── Main Admin page ───────────────────────────────────────────────────────────

export default function Admin() {
  const [authed, setAuthed] = useState(!!token());
  const [data, setData] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token()) return;
    setRefreshing(true);
    try {
      const r = await fetch(`${API}/api/admin/dashboard`, { headers: authHeaders() });
      if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); setAuthed(false); return; }
      setData(await r.json());
      setLastRefresh(new Date());
    } catch {}
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (authed) { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }
  }, [authed, load]);

  if (!authed) return <LoginScreen onLogin={() => { setAuthed(true); }} />;

  const pending = data?.pending ?? [];
  const pendingCount = pending.length;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#0A0A0C', color: '#F2F1ED', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #232326', background: '#0D0D10', padding: '0 24px', display: 'flex', alignItems: 'center', height: 48, position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ color: '#46C7FF', fontSize: 12, fontWeight: 700, letterSpacing: '0.15em' }}>VOVAX</span>
        <span style={{ color: '#8B8A85', fontSize: 12, marginRight: 10 }}>Command Center</span>
        {pendingCount > 0 && (
          <span style={{ background: '#FF4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 7px', marginRight: 8 }}>
            {pendingCount}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefresh && (
            <span style={{ color: '#8B8A85', fontSize: 10 }}>
              עודכן {lastRefresh.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              {refreshing && ' ↻'}
            </span>
          )}
          <button onClick={load} style={{ background: 'none', border: '1px solid #232326', color: '#8B8A85', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
            רענן
          </button>
          <button onClick={() => { localStorage.removeItem(TOKEN_KEY); setAuthed(false); }}
            style={{ background: 'none', border: 'none', color: '#8B8A85', fontSize: 11, cursor: 'pointer' }}>
            יציאה
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px' }}>
        {!data && (
          <p style={{ color: '#8B8A85', fontSize: 13 }}>טוען…</p>
        )}

        {data && <>
          {/* Pending VOVAX */}
          <SectionHeader>
            ממתין לאישורך
            {pendingCount > 0
              ? <span style={{ color: '#FFB347', marginRight: 6 }}> — {pendingCount} {pendingCount === 1 ? 'טיוטה' : 'טיוטות'}</span>
              : <span style={{ color: '#4CAF50', marginRight: 6 }}> — הכל נקי ✓</span>
            }
          </SectionHeader>
          <PendingQueue items={pending} onAction={load} />

          {/* Activity */}
          <SectionHeader>פעילות היום</SectionHeader>
          <ActivitySummary activity={data.activity} />

          {/* QA */}
          <SectionHeader>QA היום — <span style={{ color: '#46C7FF' }}>{data.qaToday?.length ?? 0}</span> בדיקות</SectionHeader>
          <QaSection qaToday={data.qaToday ?? []} />

          {/* Signal (read-only) */}
          <SectionHeader>Signal Detected — אחרונים (תצוגה בלבד)</SectionHeader>
          <SignalSection items={data.signal ?? []} />

          {/* Deploys */}
          <SectionHeader>Railway — 48 שעות אחרונות</SectionHeader>
          <DeploysSection deploys={data.deploys} />

          {/* Chat */}
          <SectionHeader>שיחה עם הצוות</SectionHeader>
          <ChatPanel />
        </>}
      </div>
    </div>
  );
}
