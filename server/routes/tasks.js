import { Router } from 'express';
import pool from '../db/index.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM tasks ORDER BY added_at ASC'
  );
  const grouped = { active: [], waiting: [], someday: [], done: [] };
  for (const row of rows) {
    grouped[row.section].push({
      id: row.id,
      title: row.title,
      added: row.added_at,
      completed: row.completed_at || undefined,
    });
  }
  res.json(grouped);
});

router.post('/', async (req, res) => {
  const { id, title, section } = req.body;
  if (!id || !title || !section) return res.status(400).json({ error: 'missing fields' });
  const { rows } = await pool.query(
    'INSERT INTO tasks (id, title, section, added_at) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, title, section, Date.now()]
  );
  res.json(rows[0]);
});

router.patch('/:id', async (req, res) => {
  const { section } = req.body;
  const completedAt = section === 'done' ? Date.now() : null;
  const { rows } = await pool.query(
    'UPDATE tasks SET section=$1, completed_at=$2 WHERE id=$3 RETURNING *',
    [section, completedAt, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
