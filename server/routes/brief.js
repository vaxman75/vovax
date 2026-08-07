import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function todayIL() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' });
}

// GET /api/brief/today
router.get('/today', async (_req, res) => {
  try {
    const date = todayIL();
    const { rows } = await pool.query(
      'SELECT date, brief, replied_at FROM morning_brief WHERE date = $1',
      [date]
    );
    res.json({ date, brief: rows[0] ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/brief/today — upsert (allows re-answering before cycle fires)
router.post('/today', async (req, res) => {
  const { brief } = req.body ?? {};
  if (!brief?.trim()) return res.status(400).json({ error: 'brief required' });
  try {
    const date = todayIL();
    const { rows } = await pool.query(
      `INSERT INTO morning_brief (date, brief, replied_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (date) DO UPDATE
         SET brief = EXCLUDED.brief, replied_at = EXCLUDED.replied_at
       RETURNING *`,
      [date, brief.trim(), Date.now()]
    );
    res.json({ ok: true, entry: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin-only cleanup — removes today's brief so runMusicCycle correctly skips
// until the user submits their own real one via /brief.
router.delete('/today', requireAuth, async (_req, res) => {
  try {
    const date = todayIL();
    const { rows } = await pool.query(
      `DELETE FROM morning_brief WHERE date = $1 RETURNING date`,
      [date]
    );
    res.json({ ok: true, deleted: rows[0]?.date ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
