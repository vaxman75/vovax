import { Router } from 'express';
import pool from '../db/index.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM ops_items ORDER BY created_at DESC');
  const grouped = { active: [], waiting: [], done: [] };
  for (const r of rows) {
    const status = r.status === 'done' ? 'done' : r.status === 'waiting' ? 'waiting' : 'active';
    grouped[status].push({
      id: r.id, item: r.title, owner: r.owner || '—',
      dept: r.notes || '—', updated: new Date(r.created_at).toISOString(),
    });
  }
  res.json(grouped);
});

router.post('/', async (req, res) => {
  const { id, item, owner, dept, nextOwner } = req.body;
  if (!id || !item) return res.status(400).json({ error: 'missing fields' });
  const { rows } = await pool.query(
    'INSERT INTO ops_items (id, title, status, owner, notes, created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [id, item, 'active', owner || null, dept || null, Date.now()]
  );
  res.json({ ...rows[0], nextOwner });
});

router.patch('/:id', async (req, res) => {
  const { status } = req.body;
  const { rows } = await pool.query(
    'UPDATE ops_items SET status=$1 WHERE id=$2 RETURNING *',
    [status, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

export default router;
