import { Router } from 'express';

const router = Router();
const PIXAZO_BASE = 'https://gateway.pixazo.ai';

router.post('/generate', async (req, res) => {
  const apiKey = process.env.PIXAZO_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'PIXAZO_API_KEY not set' });

  const upstream = await fetch(`${PIXAZO_BASE}/ai-model-api/v1/image-to-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey,
    },
    body: JSON.stringify(req.body),
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
