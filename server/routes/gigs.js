import { Router } from 'express';
import pool from '../db/index.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM gigs ORDER BY date ASC');
  res.json(rows.map((r) => ({
    id: r.id, date: r.date, venue: r.venue, city: r.city,
    startTime: r.status, endTime: r.notes,
    slotType: 'headline', setStatus: 'בעבודה',
    ...JSON.parse(r.notes && r.notes.startsWith('{') ? r.notes : '{}'),
  })));
});

router.post('/', async (req, res) => {
  const { id, date, venue, city, startTime, endTime, slotType, fee, notes, setStatus } = req.body;
  if (!id || !date || !venue) return res.status(400).json({ error: 'missing fields' });
  const meta = JSON.stringify({ startTime, endTime, slotType, fee, setStatus, notes });
  const { rows } = await pool.query(
    'INSERT INTO gigs (id, venue, date, city, status, notes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING RETURNING *',
    [id, venue, date, city || null, startTime || '', meta, Date.now()]
  );
  res.json(rows[0] || { id });
});

router.patch('/:id/status', async (req, res) => {
  const { setStatus } = req.body;
  const { rows } = await pool.query('SELECT notes FROM gigs WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  let meta = {};
  try { meta = JSON.parse(rows[0].notes); } catch {}
  meta.setStatus = setStatus;
  await pool.query('UPDATE gigs SET notes=$1 WHERE id=$2', [JSON.stringify(meta), req.params.id]);
  res.json({ ok: true });
});

export default router;
