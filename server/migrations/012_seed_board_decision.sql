-- Seed: board meeting record — department wiring decision 2026-08-06
INSERT INTO decisions_log (title, decision, decided_by, scope, notes, decided_at)
SELECT
  'חיבור כל מחלקות החברה לבקאנד — ישיבת הנהלה 2026-08-06',
  'כל 10 המחלקות שהיו בתצוגה בלבד חוברו לבקאנד עם טבלאות DB ייעודיות: production_queue (הפקה), label_catalog (AVOVAX), website_tasks (אתר), security_log (סייבר), hiring_log (גיוס), decisions_log (Core), sales_pipeline (מכירות). הנדסה מציגה דפלויים בזמן אמת + כפתור Alive Check. סייבר מציגה הערכת אבטחה מלאה — API key scoping, כיסוי אודיט, ובידוד רשת. כל 15 מחלקות מחזירות נתונים תקינים.',
  'אלון (Board Secretary) — בהוראת המשתמש',
  'company',
  'הוחלט לאחר ביקורת הנדסית שגילתה 10 מחלקות ללא אינטגרציה. ביצוע: migration 011, 7 טבלאות חדשות, 7 route handlers, 7 React components, commit 89de968. אומת: כל 15 endpoints מחזירים employees + נתונים, אפס שגיאות.',
  1754438400000
WHERE NOT EXISTS (
  SELECT 1 FROM decisions_log
  WHERE title = 'חיבור כל מחלקות החברה לבקאנד — ישיבת הנהלה 2026-08-06'
);
