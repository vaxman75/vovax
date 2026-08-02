import { Router } from 'express';

const router = Router();
const PIXAZO_BASE = 'https://gateway.pixazo.ai';

router.post('/generate', async (req, res) => {
  const apiKey = process.env.PIXAZO_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'PIXAZO_API_KEY not set' });

  const { model = 'ace-step', ...params } = req.body;
  if (!params.prompt) return res.status(400).json({ error: 'prompt required' });

  const upstream = await fetch(`${PIXAZO_BASE}/${model}/v1/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey,
    },
    body: JSON.stringify(params),
  });

  const data = await upstream.json();
  res.status(upstream.status).json(data);
});

router.get('/status/:requestId', async (req, res) => {
  const apiKey = process.env.PIXAZO_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'PIXAZO_API_KEY not set' });

  const upstream = await fetch(
    `${PIXAZO_BASE}/v2/requests/status/${req.params.requestId}`,
    { headers: { 'Ocp-Apim-Subscription-Key': apiKey } }
  );

  const data = await upstream.json();
  res.status(upstream.status).json(data);
});

export default router;
