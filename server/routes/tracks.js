import { Router } from 'express';
import pool from '../db/index.js';

const router = Router();

// Random track not used in the last N posts (anti-repetition)
router.get('/random-unused', async (req, res) => {
  const lookback = Math.min(parseInt(req.query.lookback ?? '10', 10), 50);
  try {
    const { rows } = await pool.query(
      `WITH recent AS (
         SELECT track_id FROM publish_queue
         WHERE  track_id IS NOT NULL
         ORDER  BY created_at DESC
         LIMIT  $1
       )
       SELECT * FROM tracks
       WHERE  id NOT IN (SELECT track_id FROM recent)
       ORDER  BY RANDOM()
       LIMIT  1`,
      [lookback]
    );

    if (rows[0]) return res.json({ track: rows[0], fallback: false });

    // All tracks used recently — return any random track
    const { rows: any } = await pool.query('SELECT * FROM tracks ORDER BY RANDOM() LIMIT 1');
    res.json({ track: any[0] ?? null, fallback: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full list (sorted by play count — for browsing)
router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, title, genre, play_count, duration_ms FROM tracks ORDER BY play_count DESC'
  );
  res.json({ count: rows.length, tracks: rows });
});

export default router;
