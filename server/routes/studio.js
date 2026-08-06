import { Router } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pool from '../db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

function loadSkill(filename) {
  try { return readFileSync(join(__dirname, '../employees', filename), 'utf-8'); }
  catch { return null; }
}

const STUDIO_LEADS = {
  studioone: { skillFile: 'tom-studioone.md', name: 'תום' },
  cubase:    { skillFile: 'yoni-cubase.md',   name: 'יוני' },
};

// POST /api/studio/chat — no auth, multi-turn with vision support
router.post('/chat', async (req, res) => {
  const { message, studio, params, imageBase64, imageMimeType, history } = req.body ?? {};
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });
  if (!studio || !STUDIO_LEADS[studio]) return res.status(400).json({ error: 'studio must be studioone or cubase' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const lead = STUDIO_LEADS[studio];
  const skill = loadSkill(lead.skillFile);

  let sessionContext = '';
  if (params) {
    const p = params;
    sessionContext = `\n\n## פרמטרי הסשן הנוכחי
BPM: ${p.bpm ?? 'לא נבחר'}
הקשר שעה: ${p.context ?? 'לא נבחר'}
רמת אנרגיה: ${p.energyLevel ?? 'לא נבחרה'}/100
רמת ניסיוניות: ${p.weirdness ?? 0}/100
פלטפורמה: ${p.platform ?? 'לא נבחרה'}${p.lyrics ? `\nמילים/ווקאל:\n${p.lyrics}` : ''}

הפרמטרים האלה הם רקע לסשן השיתופי — הם מכוונים את הכיוון, לא מחייבים.`;
  }

  const systemPrompt = skill
    ? skill + sessionContext
    : `אתה ${lead.name}, מנהל אולפן ב-VOVAX. ענה בעברית.${sessionContext}`;

  const userContent = imageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: imageMimeType ?? 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: message.trim() },
      ]
    : message.trim();

  const messages = [
    ...(Array.isArray(history) ? history : []),
    { role: 'user', content: userContent },
  ];

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data?.error?.message ?? 'API error' });
    res.json({ response: data.content?.[0]?.text?.trim() ?? '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/studio/mastering — submit track to production_queue
router.post('/mastering', async (req, res) => {
  const { title, trackId, notes, studio } = req.body ?? {};
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });

  try {
    const studioLabel = studio === 'cubase' ? 'Cubase 15' : 'Studio One Pro';
    const { rows } = await pool.query(
      `INSERT INTO production_queue (track_id, title, stage, assigned_to, notes)
       VALUES ($1, $2, 'mix', 'נוי', $3)
       RETURNING id, title, stage, assigned_to, created_at`,
      [trackId ?? null, title.trim(), notes?.trim() ?? `סשן מ-${studioLabel}`]
    );
    res.json({ ok: true, entry: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
