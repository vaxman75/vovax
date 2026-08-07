import { Router } from 'express';
import multer from 'multer';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pool from '../db/index.js';
import { uploadToMasteringFolder } from './google.js';
import { getLatestTrend } from './trends.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

const AUDIO_MIME_TYPES = new Set([
  'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mpeg', 'audio/mp3',
  'audio/aiff', 'audio/x-aiff',
  'audio/flac', 'audio/x-flac',
  'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB — generous for uncompressed masters
  fileFilter: (_req, file, cb) => {
    if (!AUDIO_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}. Expected an audio file (wav/mp3/aiff/flac/ogg/m4a).`));
    }
    cb(null, true);
  },
});

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
סולם: ${p.key ?? 'לא נבחר'}
רפרנס אמן: ${p.referenceArtist ?? 'לא נבחר'}
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

// POST /api/studio/mastering-upload — standalone entry point: upload an
// already-existing track file (no chat session required) for mix/master help.
// File goes to Google Drive (VOVAX-Mastering-Uploads folder); the Drive link
// is stored in production_queue for עמרי/נוי/זיב to pick up.
router.post('/mastering-upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { title, notes, requestType } = req.body ?? {};
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });
    if (!req.file) return res.status(400).json({ error: 'file required' });

    try {
      const driveFile = await uploadToMasteringFolder(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      const stage = requestType === 'master' ? 'master' : 'mix';
      const noteText = [
        `קובץ קיים הועלה ישירות למאסטרינג (ללא סשן) — ${driveFile.link}`,
        notes?.trim() || null,
      ].filter(Boolean).join(' | ');

      const { rows } = await pool.query(
        `INSERT INTO production_queue (track_id, title, stage, assigned_to, notes)
         VALUES (NULL, $1, $2, 'נוי', $3)
         RETURNING id, title, stage, assigned_to, created_at`,
        [title.trim(), stage, noteText]
      );
      res.json({ ok: true, entry: rows[0], driveLink: driveFile.link });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// GET /api/studio/variation-suggestion — informational only (Team B is human-driven,
// Alex makes the real creative call). Shows what the last few sessions used and what
// current trend data supports, so the variation quota is visible, not just hoped for.
router.get('/variation-suggestion', async (_req, res) => {
  try {
    const { rows: recent } = await pool.query(
      `SELECT * FROM creative_variation_log WHERE team='B' ORDER BY created_at DESC LIMIT 3`
    );
    const trend = await getLatestTrend().catch(() => null);

    if (!recent.length) {
      return res.json({ recentAxes: trend
        ? `אין עדיין היסטוריית סשנים. מגמה נוכחית: BPM ${trend.bpm_min}-${trend.bpm_max}, major=[${trend.major_keys}], minor=[${trend.minor_keys}].`
        : null });
    }

    const last = recent[0];
    const keys = recent.map(r => r.key_signature).filter(Boolean).join(' / ');
    const refs = recent.map(r => r.reference_artist).filter(Boolean).join(' / ');
    const bpms = recent.map(r => r.bpm).filter(Boolean).join(' / ');
    const vocals = recent.map(r => r.has_vocal_feature ? 'עם ווקאל' : 'בלי ווקאל').join(' / ');

    let line = `${recent.length} הסשנים האחרונים: סולם ${keys} · BPM ${bpms} · רפרנס ${refs} · ${vocals}.`;
    if (trend) {
      line += ` מגמה נוכחית תומכת ב-BPM ${trend.bpm_min}-${trend.bpm_max}` +
        (trend.guri_opportunity_flag ? ', וקולאבים עם ווקאל מציגים ביצועים חזקים בצ׳ארטים כרגע — שווה לשקול.' : '.');
    }
    res.json({ recentAxes: line, lastEntry: last });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/studio/session-log — log Team B's actual chosen params when a session starts.
// No enforcement (Alex decides), just visibility — same table as Team A for direct comparison.
router.post('/session-log', async (req, res) => {
  const { keySignature, isMajor, bpm, hasVocalFeature, referenceArtist, arrangementEnergy, trackRef } = req.body ?? {};
  try {
    const { rows: recent } = await pool.query(
      `SELECT * FROM creative_variation_log WHERE team='B' ORDER BY created_at DESC LIMIT 1`
    );
    const last = recent[0] ?? null;
    const axesVaried = [];
    if (last) {
      if (last.is_major !== !!isMajor) axesVaried.push('key');
      if (last.bpm == null || Math.abs(last.bpm - (bpm ?? 0)) >= 3) axesVaried.push('bpm');
      if (!!last.has_vocal_feature !== !!hasVocalFeature) axesVaried.push('vocal');
      if (last.reference_artist !== referenceArtist) axesVaried.push('reference_artist');
      if (last.arrangement_energy !== arrangementEnergy) axesVaried.push('arrangement_energy');
    }

    await pool.query(
      `INSERT INTO creative_variation_log
       (team, track_ref, key_signature, is_major, bpm, has_vocal_feature, reference_artist, arrangement_energy, axes_varied, created_at)
       VALUES ('B', $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [trackRef ?? null, keySignature ?? null, !!isMajor, bpm ?? null, !!hasVocalFeature,
       referenceArtist ?? null, arrangementEnergy ?? null, axesVaried.join(','), Date.now()]
    );
    res.json({ ok: true, axesVaried });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
