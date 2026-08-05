# מרשם עלויות VOVAX — Cost Ledger

> מנוהל על ידי נטע. עדכון אחרון: 2026-08.
> כל עלות חייבת מקור. אל תוסיף שורה עם הערכה — רק תיעוד רשמי.

## כלים פעילים

| כלי | ספק | עלות | מחזור | קטגוריה | מקור |
|---|---|---|---|---|---|
| Claude API (Haiku + Sonnet) | Anthropic | לפי שימוש | חודשי | AI / QA Pipeline | dashboard.anthropic.com |
| HeyGen | HeyGen | לפי קרדיטים | חודשי | וידאו | app.heygen.com/billing |
| ElevenLabs | ElevenLabs | לפי קרדיטים | חודשי | TTS | elevenlabs.io/subscription |
| Pixazo / ACE-Step | Pixazo | לפי שימוש | חודשי | יצירת מוזיקה | gateway.pixazo.ai |
| Resend | Resend | לפי שימוש | חודשי | Email Delivery | resend.com/pricing |
| Railway (Hosting + DB) | Railway | לפי שימוש | חודשי | אירוח / DevOps | railway.app/billing |

## כלים שהוחלפו

| כלי | סיבת הפסקה | תאריך |
|---|---|---|
| Suno | הוחלף ב-ACE-Step — חיסכון עלות + עצמאות יצירתית | 2026-08 |

## החלטות "בנה או קנה" פתוחות

| נושא | מצב | אחראי |
|---|---|---|
| Audio polling / status check | נבנה פנימית (Pixazo webhook) | אריאל |
| Email digest | Resend — לבחון build אם נפח גדל | נטע + אריאל |

## הערות

- כל הוספה של כלי חדש בתשלום → תיאום נטע + אריאל לפני חיבור
- שינוי ספק / עלות משמעותי → רשומה ביומן ישיבות אלון
