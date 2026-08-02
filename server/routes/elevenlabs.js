import { Router } from 'express';
import pool from '../db/index.js';

const router = Router();
const EL_BASE = 'https://api.elevenlabs.io/v1';

router.get('/settings', async (_req, res) => {
  const { rows } = await pool.query("SELECT settings FROM tool_settings WHERE tool = 'elevenlabs'");
  res.json(rows[0]?.settings || { voice_id: '' });
});

router.put('/settings', async (req, res) => {
  const { voice_id = '' } = req.body;
  await pool.query(
    `INSERT INTO tool_settings (tool, settings) VALUES ('elevenlabs', $1)
     ON CONFLICT (tool) DO UPDATE SET settings = $1`,
    [{ voice_id }]
  );
  res.json({ ok: true });
});

router.post('/tts', async (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  const { voice_id, text, model_id = 'eleven_multilingual_v2', voice_settings } = req.body;
  if (!voice_id || !text) return res.status(400).json({ error: 'voice_id and text required' });

  const upstream = await fetch(`${EL_BASE}/text-to-speech/${voice_id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
    body: JSON.stringify({ text, model_id, voice_settings }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return res.status(upstream.status).json({ error: err });
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  const buffer = await upstream.arrayBuffer();
  res.send(Buffer.from(buffer));
});

router.get('/voices', async (_req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || apiKey === 'placeholder') return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  const upstream = await fetch(`${EL_BASE}/voices`, { headers: { 'xi-api-key': apiKey } });
  const data = await upstream.json();
  const voices = (data.voices ?? []).map(({ voice_id, name, category, labels, preview_url }) => ({
    voice_id, name, category,
    gender:   labels?.gender   ?? null,
    accent:   labels?.accent   ?? null,
    age:      labels?.age      ?? null,
    use_case: labels?.use_case ?? null,
    preview_url: preview_url ?? null,
  }));
  res.status(upstream.status).json({ voices });
});

export default router;
