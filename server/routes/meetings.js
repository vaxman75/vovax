import { Router } from 'express';
import pool from '../db/index.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM meetings ORDER BY date DESC, created_at DESC');
  res.json(rows.map((r) => ({
    id: r.id,
    date: r.date,
    title: r.title,
    notes: r.notes,
    decisions: r.decisions,
    created_at: r.created_at,
  })));
});

router.post('/', async (req, res) => {
  const { id, date, title, notes, decisions } = req.body;
  if (!id || !date || !title) return res.status(400).json({ error: 'missing fields' });
  const { rows } = await pool.query(
    'INSERT INTO meetings (id, date, title, notes, decisions, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING RETURNING *',
    [id, date, title, notes || null, JSON.stringify(decisions || []), Date.now()]
  );
  res.json(rows[0] || { id });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM meetings WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
