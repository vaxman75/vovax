import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { captureError } from '../sentry.js';

const router = Router();

// ── Weekly trend pull — real, refreshing signal from actual charts ────────────
// Uses Claude's web_search tool (server-executed) to research current Beatport
// Melodic House & Techno Top 100 + Hype 100, and adjacent Tech House / Progressive
// House charts. This is a live web lookup each time it runs — not a static
// snapshot baked into a SKILL.md file.
export async function pullTrendIntelligence() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const system = `You are גיא, trend intelligence analyst at VOVAX (electronic music project). Research CURRENT chart data — do not rely on general knowledge, actually search.

Research these right now:
1. Beatport "Melodic House & Techno" Top 100 and Hype 100
2. Beatport "Tech House" Top 100 (adjacent genre, for cross-signal)
3. Beatport "Progressive House" Top 100 (adjacent genre, for cross-signal)

Extract real signal:
- BPM range actually spanned by charting tracks (not a guess — cite what you found)
- Which musical keys are charting, split major vs minor (real track examples if you can find them)
- Whether vocal-feature/collab tracks are charting prominently right now, and how strongly
- Which labels currently dominate (e.g. Afterlife, Anjunadeep, Innervisions, Keinemusik, Diynamic, etc.) — only list ones you actually find evidence for
- Approximate remix vs. original track balance on these charts

After researching, respond with ONLY a JSON object, no other text, no markdown fences:
{"bpm_min":number,"bpm_max":number,"major_keys":["E","C","D"],"minor_keys":["G","F","B"],"vocal_feature_trend":"one paragraph, cite what you found","dominant_labels":["..."],"remix_ratio":"one sentence","guri_opportunity_flag":boolean,"raw_summary":"2-3 sentence synthesis of what you actually found, for audit purposes"}

guri_opportunity_flag should be true only if you found real evidence that vocal-feature collabs are currently performing well on these charts (not a default true).`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: 'Research the current charts now and report back per the format specified.' }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
    }),
  });

  const raw = await resp.json();
  if (!resp.ok) throw new Error(`Trend pull failed: ${raw?.error?.message ?? resp.status}`);

  const text = (raw.content ?? [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  let parsed = null;
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim());
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) { try { parsed = JSON.parse(match[0]); } catch (_2) { /* fall through */ } }
  }

  if (!parsed) {
    throw new Error(`Trend pull: JSON parse failed. Raw text: ${text.slice(0, 300)}`);
  }

  // Strip web_search citation markup (<cite index="...">...</cite>) — keep the underlying
  // text, drop the tags. The tags prove the claim was grounded in an actual search result,
  // but they're noise for anything rendered to a human (digest email, admin dashboard).
  const stripCites = (s) => typeof s === 'string' ? s.replace(/<\/?cite[^>]*>/g, '') : s;

  const row = {
    pulled_at:             Date.now(),
    bpm_min:               parsed.bpm_min ?? null,
    bpm_max:               parsed.bpm_max ?? null,
    major_keys:            Array.isArray(parsed.major_keys) ? parsed.major_keys.join(',') : null,
    minor_keys:            Array.isArray(parsed.minor_keys) ? parsed.minor_keys.join(',') : null,
    vocal_feature_trend:   stripCites(parsed.vocal_feature_trend) ?? null,
    dominant_labels:       Array.isArray(parsed.dominant_labels) ? parsed.dominant_labels.join(',') : null,
    remix_ratio:           stripCites(parsed.remix_ratio) ?? null,
    guri_opportunity_flag: !!parsed.guri_opportunity_flag,
    raw_summary:           stripCites(parsed.raw_summary) ?? null,
  };

  await pool.query(
    `INSERT INTO trend_intelligence
     (pulled_at, bpm_min, bpm_max, major_keys, minor_keys, vocal_feature_trend, dominant_labels, remix_ratio, guri_opportunity_flag, raw_summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [row.pulled_at, row.bpm_min, row.bpm_max, row.major_keys, row.minor_keys,
     row.vocal_feature_trend, row.dominant_labels, row.remix_ratio, row.guri_opportunity_flag, row.raw_summary]
  );

  console.log(`Trends[גיא]: pulled — BPM ${row.bpm_min}-${row.bpm_max}, major=[${row.major_keys}], minor=[${row.minor_keys}], guri_flag=${row.guri_opportunity_flag}`);
  return row;
}

// Returns the latest trend row, or null if none pulled yet / stale beyond maxAgeDays.
export async function getLatestTrend(maxAgeDays = 10) {
  const { rows } = await pool.query(
    `SELECT * FROM trend_intelligence ORDER BY pulled_at DESC LIMIT 1`
  );
  const row = rows[0];
  if (!row) return null;
  const ageMs = Date.now() - Number(row.pulled_at);
  if (ageMs > maxAgeDays * 24 * 3600 * 1000) return null; // stale — caller should fall back to static pools
  return row;
}

// ── Admin routes ────────────────────────────────────────────────────────────

router.post('/pull', requireAuth, async (_req, res) => {
  try {
    const row = await pullTrendIntelligence();
    res.json({ ok: true, trend: row });
  } catch (err) {
    captureError(err, { dept: 'music', fn: 'pullTrendIntelligence-manual' });
    res.status(500).json({ error: err.message });
  }
});

router.get('/latest', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM trend_intelligence ORDER BY pulled_at DESC LIMIT 1`);
    const { rows: genreRows } = await pool.query(
      `SELECT genre, COUNT(*)::int AS cnt FROM tracks GROUP BY genre ORDER BY cnt DESC`
    );
    const { rows: variationRows } = await pool.query(
      `SELECT * FROM creative_variation_log ORDER BY created_at DESC LIMIT 20`
    );
    res.json({ trend: rows[0] ?? null, genreDistribution: genreRows, variationLog: variationRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
