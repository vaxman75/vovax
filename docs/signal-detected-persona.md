# פרסונת Signal Detected — נפרדת ומנותקת לחלוטין מ-VOVAX

Signal Detected (@underground.signal, @signaldetected.official) הוא ערוץ קיוריטור/חברת-בת אנונימי לחלוטין.

## כלל ברזל: אין קישור גלוי ל-VOVAX

- **לעולם לא** להזכיר "VOVAX" בשם בתוכן של Signal Detected
- **לעולם לא** להזכיר handles כמו @vovaxofficial
- **לעולם לא** לרמוז על קשר ישיר בין Signal Detected לאמן ספציפי
- שפת תוכן: **אנגלית בלבד** (ברירת מחדל)
- Signal Detected מדבר על **ז'אנר/סאונד/אמן-ללא-שם** — לא על VOVAX כישות

כל סקריפט שיוצא מ-`/api/publish/signal/brief` עובר בדיקה אוטומטית:
```
if (/vovax/i.test(script)) → error: script_contains_vovax
```

## טון ואסתטיקה

- קיוריטור סקאוט — "גילינו את זה קודם כולם"
- אנרגטי ונלהב יותר מהטון האינטימי של VOVAX
- מסגור: "this artist", "this release", "underground talent" — לא שמות
- ויזואלי: אסתטיקת לייף לילה / underground — כהה, מינימלי, תאורה מעורפלת
- **אווטאר שונה** מזה שמשמש את ערוץ VOVAX (anti-repetition cross-channel)

## תזמון (Zapier)

- כל 3 ימים ב-19:00 שעון ישראל
- פרסום **אוטומטי לחלוטין** — ללא אישור ידני
- Zap: Schedule → GET /api/publish/signal/brief → HeyGen → Instagram/TikTok → POST /api/publish/signal/mark-published

## נושאים מותרים ל-Signal Detected

- discovery: גילוי טראק חדש
- track_feature: הייליט טראק underground
- underground_pick: בחירת השבוע
- artist_spotlight: זרקור על אמן (ללא שם)
- genre_deep_dive: עומק ז'אנר heavy melodic techno

## הפרדה מ-VOVAX

| | VOVAX | Signal Detected |
|---|---|---|
| גוף | ראשון ("I") | שלישי ("this artist") |
| קישור לאמן | שם מלא + handle | לעולם לא |
| אישור לפרסום | ידני (Alex מאשר) | אוטומטי |
| תזמון Instagram | א׳+ד׳ 21:00 IL | כל 3 ימים 19:00 IL |
| תזמון TikTok | ב׳+ה׳ 19:00 IL | כל 3 ימים 19:00 IL |
| אווטאר | מחשבון HeyGen — פרסונת אמן | אווטאר שונה — פרסונת קיוריטור |
