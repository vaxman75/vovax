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

router.post('/qa', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const { prompt, brief, urls } = req.body;
  if (!prompt || !urls?.length) return res.status(400).json({ error: 'prompt and urls required' });

  const briefLines = [
    brief?.purpose   && `Purpose: ${brief.purpose}`,
    brief?.mood      && `Mood/intent: ${brief.mood}`,
    brief?.reference && `Reference: ${brief.reference}`,
    brief?.context   && `Context/time: ${brief.context}`,
  ].filter(Boolean).join('\n');

  const system = `You are טליה, QA specialist at VOVAX. Evaluate AI-generated music output against VOVAX quality criteria.

VOVAX style: Heavy melodic techno / minimal power grooves / cinematic tension. References: Tale Of Us, Anyma, ARTBAT, Stephan Bodzin.

IMPORTANT: You cannot listen to audio. For listening-dependent criteria (0, 2, 3), provide a precise checklist the user can run while listening, based on what the brief/prompt should have produced.

Criteria:
0. CLEAN STEMS — Separated vocals/instruments, no noise or bleed. Cannot verify without listening.
1. STYLE FIT — Does the prompt target heavy melodic techno correctly? G minor, rolling bassline, dark pads, four-on-the-floor kick, club-ready BPM. Assess from brief + prompt.
2. TECHNICAL QUALITY — Background noise, distortion, rhythm glitches typical of AI output. Cannot verify without listening.
3. COMPLETENESS — Output is not cut off, no problematic loops/repetition. Partially infer from duration in prompt context.
4. ORIGINALITY — Not too direct a copy of the stated reference. Assess from reference given.

Respond with valid JSON only — no markdown, no prose outside the object:
{
  "verdict": "APPROVED" | "NEEDS_FIX" | "REJECTED",
  "criteria": {
    "0_clean_stems":  { "status": "PASS" | "FAIL" | "LISTEN_REQUIRED", "note": "..." },
    "1_style_fit":    { "status": "PASS" | "FAIL" | "NEEDS_FIX",       "note": "..." },
    "2_technical":    { "status": "PASS" | "FAIL" | "LISTEN_REQUIRED", "note": "..." },
    "3_completeness": { "status": "PASS" | "FAIL" | "LISTEN_REQUIRED", "note": "..." },
    "4_originality":  { "status": "PASS" | "FAIL" | "NEEDS_FIX",       "note": "..." }
  },
  "summary": "One sentence: overall verdict and the single most important finding.",
  "fix_if_rejected": "Only present when verdict is NEEDS_FIX or REJECTED — concrete actionable next step."
}`;

  const userMsg = `BRIEF ANSWERS:\n${briefLines || '(none provided)'}\n\nFINAL PROMPT SENT TO ACE-STEP:\n${prompt}\n\nAUDIO OUTPUT (${urls.length} file${urls.length > 1 ? 's' : ''} — not listenable):\n${urls.join('\n')}\n\nRun טליה QA. For listening-required criteria, base your checklist on what the brief + prompt should have produced.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    const raw = await resp.json();
    const text = raw.content?.[0]?.text;
    if (!text) return res.status(502).json({ error: 'Empty response from Claude' });
    const stripped = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    const qa = JSON.parse(stripped);
    res.json(qa);
  } catch (err) {
    res.status(500).json({ error: err.message || 'QA call failed' });
  }
});

export default router;
