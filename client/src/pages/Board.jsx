import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';

// Historical seed meetings — seeded once into the DB on first load
const SEED_MEETINGS = [
  { id: 'seed-018', date: '2026-07-27', title: 'לוח זמנים + פיננסי', notes: 'נוצר אירוע יומן: נסיעה לאילת 28-30.7. AIODE נמצא לגיטימי. MusicPay ו-Celonis נשארים לא מזוהים.', decisions: ['AIODE מומלץ לשילוב, לא לביטול', 'MusicPay ו-Celonis בראש סדר העדיפויות לבירור'] },
  { id: 'seed-017', date: '2026-07-27', title: 'אמנות וויזואל + עוזרים אישיים + ממצאי מייל', notes: 'פוצלה מחלקת דניאל ל-6 עובדים. כל העוזרים האישיים אוחדו תחת עידן. בדיקת קבלות חשפה מנויים חדשים: Midjourney, Luma AI, Melodyne 5, DJ.Studio, Beatport.', decisions: ['עידן = מנהל יחיד לכל 6 העוזרים האישיים', 'כל הרשאה לעוזר אישי עוברת נועם+אדם לפני אישור'] },
  { id: 'seed-016', date: '2026-07-27', title: 'אבטחת סייבר + מדיניות חוצה-חברה', notes: 'הוקמה מחלקת אבטחת סייבר (אדם). נקבעו שלוש מדיניות חוצות-חברה. "עקרון מצוינות" נוסף לכל העובדים.', decisions: ['אדם ונועם עובדים יחד', 'עקרון המצוינות חל אוטומטית על כל עובד עתידי'] },
  { id: 'seed-015', date: '2026-07-27', title: 'Personal Core — תפקיד מורחב למאיה', notes: 'מאיה קיבלה אחריות מפורשת: לעקוב אחרי מיילי התראת אבטחה ולדווח מועמדים לניתוק.', decisions: ['מאיה מדווחת בלבד — הניתוק תמיד ידני ע"י המשתמש'] },
  { id: 'seed-014', date: '2026-07-27', title: 'ניהול אתר — Bandzoogle', notes: 'נוספה דנה. תיקון: האתר בנוי על Bandzoogle (לא Shopify). ל-Bandzoogle אין API בכלל.', decisions: ['עלות Bandzoogle ($22/חודש) נוספה למרשם של נטע'] },
  { id: 'seed-013', date: '2026-07-27', title: 'הפקה, עריכה, מיקסינג ומאסטרינג', notes: 'הוקמה מחלקת הפקה (עמרי). סטמים נקיים = דרישת ברזל. Splice הורחב.', decisions: ['סטמים נקיים = דרישת סף לפני מיקס/מאסטר'] },
  { id: 'seed-012', date: '2026-07-27', title: 'יצירה — הבהרת workflow', notes: 'לפלט של ACE-Step שני שימושים: שימוש ישיר, או השראה בלבד.', decisions: ['אלעד ועמית מחליטים יחד לכל טראק'] },
  { id: 'seed-011', date: '2026-07-27', title: 'פיננסי + יצירה אסטרטגית', notes: 'הוחלט: לרדת מ-Suno ולעבור ל-ACE-Step כברירת מחדל.', decisions: ['יצירה חדשה כברירת מחדל = ACE-Step, לא Suno'] },
  { id: 'seed-010', date: '2026-07-27', title: 'תיאום פעולות — אביב', notes: 'נוסף אביב, מתאם/ת פעולות. לוח תיאום יומי (ops-board).', decisions: ['אביב = תיאום יומי; אלון = החלטות אסטרטגיות שבועיות'] },
  { id: 'seed-009', date: '2026-07-27', title: 'מכירות ולייבלים + הופעות', notes: 'הוקמה מחלקת מכירות (רז). נרשמה הופעה: Gagarin ת"א, 4.9.2026, 01:00-02:30.', decisions: ['כל מנהל פועל לפי "לחשוב שלב קדימה"'] },
  { id: 'seed-008', date: '2026-07-27', title: 'ניהול מוסיקלי', notes: 'הוקמה תת-מחלקה: אלעד מנהל תום (Studio One) ויוני (Cubase) — כל אחד עם מוזיקאי+DJ.', decisions: ['ליאם מחובר בפועל ל-Splice'] },
  { id: 'seed-007', date: '2026-07-27', title: 'יצירה (Creation)', notes: 'הוקמה מחלקת יצירה. בן (ACE-Step) הוא ה-API הבדוק היחיד.', decisions: ['לא בונים אינטגרציה בלי לבדוק API בפועל'] },
  { id: 'seed-006', date: '2026-07-27', title: 'תכנות — נועם + הרשאות', notes: 'נוסף נועם, אחראי הרשאות. נבנתה מטריצת הרשאות לכל העובדים.', decisions: ['נועם לא מבצע פעולות בעצמו — תפקיד ביקורת בלבד'] },
  { id: 'seed-005', date: '2026-07-27', title: 'מחלקה טכנית', notes: 'הוקמה מחלקה טכנית (אריאל, שקד, רועי).', decisions: ['לא נוגעים בתוכן/מותג — רק בתקינות טכנית'] },
  { id: 'seed-004', date: '2026-07-27', title: 'HeyGen — חיבור ישיר', notes: 'נמצא פתרון ל-Signal Detected: חיבור ישיר ל-HeyGen API, עוקף Zapier.', decisions: ['החיבור הישיר ל-HeyGen מחליף Zapier עד הודעה חדשה'] },
  { id: 'seed-003', date: '2026-07-27', title: 'פרסום אוטומטי — Signal Detected', notes: 'צינור פרסום קיים ב-Zapier: Claude→HeyGen→Buffer→Instagram. הוקמו 6 עובדים.', decisions: ['לחשבונות Buffer ו-Instagram אין הרשאות קריאה — חור ממשי'] },
  { id: 'seed-002', date: '2026-07-27', title: 'מותג וקול', notes: 'הוקמה מחלקת מותג וקול (שירה, גל, יובל). כ-240,000 השמעות ב-SoundCloud.', decisions: ['מדריך הקול חי בסקילים, לא ב-storage'] },
  { id: 'seed-001', date: '2026-07-27', title: 'Personal Core', notes: 'הוקמה מחלקת Personal Core (עידן, תומר, מאיה, נועה, רון).', decisions: ['לכל עובד: שם, תפקיד, מנהל ישיר, וסקיל אישי משלו'] },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Board() {
  const [meetings, setMeetings] = useState(null);
  const [taskStats, setTaskStats] = useState(null);
  const [error, setError] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/meetings');
        const stored = await res.json();
        const existingIds = new Set(stored.map((m) => m.id));

        // Seed missing historical meetings
        const toSeed = SEED_MEETINGS.filter((s) => !existingIds.has(s.id));
        await Promise.all(
          toSeed.map((s) =>
            fetch('/api/meetings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(s),
            })
          )
        );

        const all = [...stored, ...toSeed].sort((a, b) => new Date(b.date) - new Date(a.date));
        setMeetings(all);
      } catch {
        setMeetings([]);
      }

      try {
        const tr = await fetch('/api/tasks');
        const t = await tr.json();
        setTaskStats({
          active: (t.active || []).length,
          waiting: (t.waiting || []).length,
          someday: (t.someday || []).length,
          done: (t.done || []).length,
        });
      } catch {
        setTaskStats(false);
      }
    })();
  }, []);

  const addNote = async () => {
    const text = noteText.trim();
    if (!text || !meetings) return;
    const entry = { id: uid(), date: new Date().toISOString().slice(0, 10), title: 'הערה כללית', notes: text, decisions: [] };
    setMeetings((m) => [entry, ...m]);
    setNoteText('');
    setShowAdd(false);
    try {
      await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {
      setError('השמירה נכשלה, נסה שוב');
      setTimeout(() => setError(null), 3000);
    }
  };

  if (meetings === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div style={{ color: '#8B8A85' }} className="text-sm">טוען...</div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-5 py-8">
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · ISHIVAT HANHALA
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold mb-1">ישיבת הנהלה</h1>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-5">איפה כל מחלקה עומדת, ברגע אחד</p>

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-6" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14" fill="none" stroke="#FF5A64" strokeWidth="1.5" className="pulse-line" />
      </svg>

      <div style={{ background: '#131316', border: '1px solid #232326' }} className="rounded p-4 mb-8">
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-sm font-semibold uppercase tracking-wide mb-3">
          תמונת מצב — Personal Core
        </h2>
        {taskStats === null ? (
          <p style={{ color: '#8B8A85' }} className="text-sm">טוען...</p>
        ) : taskStats === false ? (
          <p style={{ color: '#8B8A85' }} className="text-sm">אין עדיין נתונים מהלוח של נועה.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 text-center">
            {[['active', 'פעיל', '#46C7FF'], ['waiting', 'בהמתנה', '#F2F1ED'], ['someday', 'בהמשך', '#F2F1ED'], ['done', 'בוצע', '#8B8A85']].map(([k, label, color]) => (
              <div key={k}>
                <div style={{ color }} className="text-xl font-bold">{taskStats[k]}</div>
                <div style={{ color: '#8B8A85' }} className="text-xs">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-sm font-semibold uppercase tracking-wide">יומן ישיבות</h2>
        <button onClick={() => setShowAdd((v) => !v)} style={{ color: '#46C7FF' }} className="text-xs flex items-center gap-1">
          <Plus size={14} /> הוסף עדכון
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-2 mb-6">
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
            placeholder="מה קרה / הוחלט..."
            style={{ background: '#131316', border: '1px solid #232326', color: '#F2F1ED' }}
            className="flex-1 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <button onClick={addNote} style={{ background: '#46C7FF', color: '#0A0A0C' }} className="rounded px-3 py-2 text-sm shrink-0">שמור</button>
        </div>
      )}

      {error && <div style={{ color: '#FF5A64' }} className="text-sm mb-4">{error}</div>}

      <div className="space-y-6">
        {meetings.map((m) => (
          <div key={m.id} style={{ borderTop: '1px solid #232326' }} className="pt-4">
            <div style={{ color: '#8B8A85', fontFamily: "'Space Grotesk', monospace" }} className="text-xs mb-2">{formatDate(m.date)}</div>
            <div className="text-sm font-semibold mb-1">{m.title}</div>
            {m.notes && <p className="text-sm mb-2" style={{ color: '#C8C7C2' }}>{m.notes}</p>}
            {m.decisions && m.decisions.length > 0 && (
              <ul style={{ color: '#8B8A85' }} className="text-xs list-disc mr-4 space-y-0.5">
                {m.decisions.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
