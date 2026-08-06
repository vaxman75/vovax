import React, { useState, useEffect, useRef } from 'react';

export default function Brief() {
  const [loading,    setLoading]    = useState(true);
  const [date,       setDate]       = useState('');
  const [existing,   setExisting]   = useState(null); // { brief, replied_at } or null
  const [text,       setText]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [error,      setError]      = useState('');
  const textareaRef = useRef();

  useEffect(() => {
    fetch('/api/brief/today')
      .then(r => r.json())
      .then(data => {
        setDate(data.date ?? '');
        if (data.brief) {
          setExisting(data.brief);
          setText(data.brief.brief ?? '');
        }
      })
      .catch(() => setError('שגיאת רשת — לא ניתן לטעון מצב נוכחי'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (editing && textareaRef.current) textareaRef.current.focus();
  }, [editing]);

  async function submit(e) {
    e?.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/brief/today', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief: text.trim() }),
      });
      const data = await r.json();
      if (data.ok) {
        setExisting(data.entry);
        setDone(true);
        setEditing(false);
      } else {
        setError(data.error ?? 'שגיאה לא ידועה');
      }
    } catch {
      setError('שגיאת רשת');
    } finally {
      setSubmitting(false);
    }
  }

  const page = {
    minHeight: '100vh', background: '#0A0A0C', color: '#F2F1ED',
    fontFamily: "'Space Grotesk', sans-serif",
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    padding: 24,
  };

  const card = {
    maxWidth: 520, width: '100%', direction: 'rtl',
  };

  if (loading) {
    return (
      <div style={page}>
        <div style={{ color: '#555', fontSize: 14 }}>טוען...</div>
      </div>
    );
  }

  // Submitted and not editing
  if ((existing || done) && !editing) {
    const displayText = existing?.brief ?? text;
    return (
      <div style={page}>
        <div style={card}>
          <p style={{ color: '#8B8A85', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px' }}>
            VOVAX · Team A · {date}
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 20px' }}>בריף בוקר</h1>

          <div style={{ background: '#0B1F0B', border: '1px solid #22C55E33', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <p style={{ color: '#22C55E', fontSize: 12, fontWeight: 700, margin: '0 0 10px', letterSpacing: '0.05em' }}>✓ נמסר — המחזור האוטונומי יקרא אותו</p>
            <p style={{ fontSize: 15, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap', color: '#F2F1ED' }}>{displayText}</p>
          </div>

          <p style={{ color: '#8B8A85', fontSize: 12, lineHeight: 1.6, margin: '0 0 16px' }}>
            ACE-Step (Team A) יפיק טראק בשעה 10:00 לפי הבריף הזה.<br/>
            אפשר לעדכן בריף לפני 10:00 — לאחר מכן הוא כבר נקרא.
          </p>

          <button type="button" onClick={() => { setEditing(true); setDone(false); }}
            style={{ background: 'transparent', border: '1px solid #333', color: '#8B8A85', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>
            עדכן בריף
          </button>
        </div>
      </div>
    );
  }

  // Input form
  return (
    <div style={page}>
      <div style={card}>
        <p style={{ color: '#8B8A85', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px' }}>
          VOVAX · Team A · {date}
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>מה הסגנון של היום?</h1>
        <p style={{ color: '#8B8A85', fontSize: 13, lineHeight: 1.65, margin: '0 0 24px' }}>
          כתוב בחופשי — הטקסט שלך יהפוך להוראת הייצור של המחזור האוטונומי (10:00).<br/>
          אם לא תגיב עד 10:00, המחזור לא יפעל היום.
        </p>

        <form onSubmit={submit}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus={!editing}
            placeholder="לדוגמה: משהו כבד ותעשייתי עם ויברציות ברלין, אנרגיה גבוהה, BPM גבוה, אפל ומתוח..."
            style={{
              width: '100%', minHeight: 140, padding: 14, fontSize: 14,
              lineHeight: 1.75, resize: 'vertical', boxSizing: 'border-box',
              background: '#131316', border: '1px solid #2a2a2e', color: '#F2F1ED',
              borderRadius: 8, fontFamily: "'Space Grotesk', sans-serif",
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#F59E0B'; }}
            onBlur={e => { e.target.style.borderColor = '#2a2a2e'; }}
          />

          {error && (
            <p style={{ color: '#EF4444', fontSize: 12, margin: '6px 0 0' }}>{error}</p>
          )}

          <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="submit" disabled={submitting || !text.trim()}
              style={{
                background: '#F59E0B', color: '#0A0A0C', borderRadius: 8,
                padding: '10px 24px', fontWeight: 700, fontSize: 14,
                border: 'none', cursor: 'pointer',
                opacity: (submitting || !text.trim()) ? 0.45 : 1,
                transition: 'opacity 0.1s',
              }}>
              {submitting ? 'שומר...' : 'שלח בריף →'}
            </button>

            {editing && (
              <button type="button"
                onClick={() => { setEditing(false); setText(existing?.brief ?? ''); setError(''); }}
                style={{ background: 'transparent', border: '1px solid #333', color: '#8B8A85', borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}>
                ביטול
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
