import { Router } from 'express';

const router = Router();
const EL_BASE = 'https://api.elevenlabs.io/v1';

router.post('/tts', async (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  const { voice_id, text, model_id = 'eleven_multilingual_v2', voice_settings } = req.body;
  if (!voice_id || !text) return res.status(400).json({ error: 'voice_id and text required' });

  const upstream = await fetch(`${EL_BASE}/text-to-speech/${voice_id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
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

router.get('/voices', async (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  const upstream = await fetch(`${EL_BASE}/voices`, {
    headers: { 'xi-api-key': apiKey },
  });
  const data = await upstream.json();
  res.status(upstream.status).json(data);
});

export default router;
