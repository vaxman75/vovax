import { Router } from 'express';
import pool from '../db/index.js';

const router = Router();
const HEYGEN_BASE = 'https://api.heygen.com';

router.get('/settings', async (_req, res) => {
  const { rows } = await pool.query("SELECT settings FROM tool_settings WHERE tool = 'heygen'");
  res.json(rows[0]?.settings || { avatar_id: '', voice_id: '' });
});

router.put('/settings', async (req, res) => {
  const { avatar_id = '', voice_id = '' } = req.body;
  await pool.query(
    `INSERT INTO tool_settings (tool, settings) VALUES ('heygen', $1)
     ON CONFLICT (tool) DO UPDATE SET settings = $1`,
    [{ avatar_id, voice_id }]
  );
  res.json({ ok: true });
});

router.post('/generate', async (req, res) => {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HEYGEN_API_KEY not set' });

  const upstream = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify(req.body),
  });

  const data = await upstream.json();
  res.status(upstream.status).json(data);
});

router.get('/status/:videoId', async (req, res) => {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HEYGEN_API_KEY not set' });

  const upstream = await fetch(
    `${HEYGEN_BASE}/v1/video_status.get?video_id=${req.params.videoId}`,
    { headers: { 'X-Api-Key': apiKey } }
  );

  const data = await upstream.json();
  res.status(upstream.status).json(data);
});

export default router;
