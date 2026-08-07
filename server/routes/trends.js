import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { captureError } from '../sentry.js';

const router = Router();

// ── Genre catalog — VOVAX spans multiple styles, not one fixed aesthetic ──────
// Each brief (Team A or Team B) targets ONE of these per track/piece. Reference
// artists and fallback ranges are used only when no fresh trend pull exists yet
// for that specific genre — real chart data always wins when available.
// craftHint: real arrangement/harmony/sound-design knowledge per genre, folded
// directly into the ACE-Step prompt (see buildPrompt() in music.js) — this is
// the Team A knowledge handoff from אלעד (2026-08-07): same caliber of real
// craft detail as Team B's DAW documentation, scoped for autonomous generation
// via prompt text rather than a human operating a DAW. Full detail in
// references/genre-craft-guide.md; these are the compressed prompt-ready forms.
export const GENRES = {
  melodic_house_techno: {
    label: 'Melodic House & Techno', beatportGenre: 'Melodic House & Techno',
    refArtists: ['Tale Of Us', 'Anyma', 'ARTBAT', 'Stephan Bodzin', 'Adriatique', 'Delta Vaults'],
    fallbackBpm: [118, 128], fallbackMajor: ['E', 'C', 'D'], fallbackMinor: ['G', 'F', 'B'],
    craftHint: 'minimal 16-32 bar intro, breakdown at two-thirds mark stripped to pad and atmosphere, i-VI-III-VII minor loop harmony, minor 7th/9th melodic lead',
  },
  tech_house: {
    label: 'Tech House', beatportGenre: 'Tech House',
    refArtists: ['Fisher', 'John Summit', 'Chris Lake', 'Dennis Cruz'],
    fallbackBpm: [124, 128], fallbackMajor: ['F', 'G'], fallbackMinor: ['A', 'D'],
    craftHint: 'groove-first 2-4 bar loop layering not big harmonic movement, minimal-to-no chords, rhythmic bassline hook, vocal chops as melodic-rhythmic element, dry club-functional mix',
  },
  minimal_deep_tech: {
    label: 'Minimal / Deep Tech', beatportGenre: 'Minimal / Deep Tech',
    refArtists: ['Recondite', 'Fideles', 'Better Lost Than Stupid'],
    fallbackBpm: [122, 128], fallbackMajor: ['C'], fallbackMinor: ['G', 'A'],
    craftHint: 'sparse arrangement, micro-variation over long 8-16 bar loops, minimal harmonic content, hypnotic repetition, no dramatic drop',
  },
  house: {
    label: 'House', beatportGenre: 'House',
    refArtists: ['Disclosure', 'Purple Disco Machine', 'Dom Dolla'],
    fallbackBpm: [122, 126], fallbackMajor: ['F', 'C'], fallbackMinor: ['D', 'A'],
    craftHint: 'classic 4-8 bar phrase song structure, vocal hook, classic house piano chord stabs (7th/9th voicings), warm analog-style filtering',
  },
  afro_house: {
    label: 'Afro House', beatportGenre: 'Afro House',
    refArtists: ['Black Coffee', 'Culoe De Song', 'Enoo Napa'],
    fallbackBpm: [118, 123], fallbackMajor: ['D'], fallbackMinor: ['F', 'G'],
    craftHint: 'percussion-forward arrangement (layered polyrhythmic shakers/congas/talking-drum samples driving the structure, not chord progression), modal/pentatonic melodic elements, organic live-feel samples',
  },
  progressive_house: {
    label: 'Progressive House', beatportGenre: 'Progressive House',
    refArtists: ['Eli & Fur', 'Lane 8', 'Yotto'],
    fallbackBpm: [118, 124], fallbackMajor: ['A', 'E'], fallbackMinor: ['D', 'B'],
    craftHint: 'long gradual 32-64 bar build, incrementally evolving melodic motif, vi-IV-I-V style major/relative-minor chord movement, lush layered pads, uplifting emotional arc',
  },
  electronica: {
    label: 'Electronica', beatportGenre: 'Electronica',
    refArtists: ['Bonobo', 'ODESZA', 'RÜFÜS DU SOL'],
    fallbackBpm: [100, 120], fallbackMajor: ['C', 'G'], fallbackMinor: ['A'],
    craftHint: 'through-composed structure not loop-based, jazz-influenced 7th/9th/11th chord voicings, organic textures blended with glitch/IDM elements',
  },
  edm_mainstage: {
    label: 'EDM / Mainstage', beatportGenre: 'Big Room',
    refArtists: ['Anyma', 'Martin Garrix', 'Timmy Trumpet'],
    craftHint: 'short intro into buildup (riser, snare roll, heavy compression), anthemic drop with simple powerful 2-4 chord loop like i-VI-III-VII, huge stereo-width supersaws',
    fallbackBpm: [126, 150], fallbackMajor: ['F', 'C'], fallbackMinor: ['A', 'E'],
  },
};
export const GENRE_KEYS = Object.keys(GENRES);

// ── Trend pull — real, refreshing, per-genre signal ────────────────────────────
// One Claude call (not one per genre — that would be 8x the cost) researches
// ALL genres' current Beatport charts via web_search, returns a per-genre array.
export async function pullTrendIntelligence() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const genreList = GENRE_KEYS.map(k => `"${k}" → Beatport "${GENRES[k].beatportGenre}"`).join('\n');

  const system = `You are גיא, trend intelligence analyst at VOVAX (electronic music project spanning multiple styles). Research CURRENT chart data — do not rely on general knowledge, actually search.

VOVAX produces across ALL of these genres, not one fixed style. Research EACH genre's current Beatport Top 100 separately:
${genreList}

For EACH genre, extract real signal:
- BPM range actually spanned by charting tracks (cite what you found, don't guess)
- Which musical keys are charting, split major vs minor
- Whether vocal-feature/collab tracks are charting prominently in THIS genre specifically
- Dominant labels for THIS genre specifically (only ones you find real evidence for)
- Remix vs original balance

Respond with ONLY a JSON object, no other text, no markdown fences:
{
  "genres": {
    "melodic_house_techno": {"bpm_min":number,"bpm_max":number,"major_keys":["E","C"],"minor_keys":["G","F"],"vocal_feature_trend":"short","dominant_labels":["..."],"remix_ratio":"short"},
    "tech_house": {...same shape...},
    ... one entry per genre key listed above ...
  },
  "guri_opportunity_flag": boolean,
  "guri_note": "1-2 sentences — is there real evidence ANY genre's vocal-collabs are charting strongly right now? Company-wide, not per-genre.",
  "raw_summary": "3-4 sentence overall synthesis for audit purposes"
}

If you can't find clear signal for a genre's specific field, use null for that field rather than guessing. guri_opportunity_flag should be true only with real evidence, not a default.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: 'Research the current Beatport charts for each genre now and report back per the format specified.' }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 20 }],
    }),
  });

  const raw = await resp.json();
  if (!resp.ok) throw new Error(`Trend pull failed: ${raw?.error?.message ?? resp.status}`);

  const text = (raw.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n');

  let parsed = null;
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim());
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) { try { parsed = JSON.parse(match[0]); } catch (_2) { /* fall through */ } }
  }
  if (!parsed || !parsed.genres) {
    throw new Error(`Trend pull: JSON parse failed. Raw text: ${text.slice(0, 400)}`);
  }

  const stripCites = (s) => typeof s === 'string' ? s.replace(/<\/?cite[^>]*>/g, '') : s;
  const pulledAt = Date.now();
  const guriFlag = !!parsed.guri_opportunity_flag;
  const guriNote = stripCites(parsed.guri_note) ?? null;
  const rawSummary = stripCites(parsed.raw_summary) ?? null;

  const rows = [];
  for (const genreKey of GENRE_KEYS) {
    const g = parsed.genres[genreKey] ?? {};
    const row = {
      pulled_at: pulledAt,
      genre: genreKey,
      bpm_min: g.bpm_min ?? null,
      bpm_max: g.bpm_max ?? null,
      major_keys: Array.isArray(g.major_keys) ? g.major_keys.join(',') : null,
      minor_keys: Array.isArray(g.minor_keys) ? g.minor_keys.join(',') : null,
      vocal_feature_trend: stripCites(g.vocal_feature_trend) ?? null,
      dominant_labels: Array.isArray(g.dominant_labels) ? g.dominant_labels.join(',') : null,
      remix_ratio: stripCites(g.remix_ratio) ?? null,
      guri_opportunity_flag: guriFlag,
      raw_summary: guriNote ? `${rawSummary ?? ''} | GURI: ${guriNote}` : rawSummary,
    };
    rows.push(row);
    await pool.query(
      `INSERT INTO trend_intelligence
       (pulled_at, genre, bpm_min, bpm_max, major_keys, minor_keys, vocal_feature_trend, dominant_labels, remix_ratio, guri_opportunity_flag, raw_summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [row.pulled_at, row.genre, row.bpm_min, row.bpm_max, row.major_keys, row.minor_keys,
       row.vocal_feature_trend, row.dominant_labels, row.remix_ratio, row.guri_opportunity_flag, row.raw_summary]
    );
  }

  console.log(`Trends[גיא]: pulled ${rows.length} genres — guri_flag=${guriFlag}`);
  return { rows, guriFlag, guriNote };
}

// Returns the latest trend row for a SPECIFIC genre, or — when genreKey is
// omitted — the single most-recently-pulled row across any genre. Team A
// always passes a genreKey (it picks one per brief); Team B currently has no
// genre selector, so it calls this with no argument for a general signal.
// Returns null if none exists / stale.
export async function getLatestTrend(genreKey = null, maxAgeDays = 10) {
  const { rows } = genreKey
    ? await pool.query(
        `SELECT * FROM trend_intelligence WHERE genre = $1 ORDER BY pulled_at DESC LIMIT 1`,
        [genreKey]
      )
    : await pool.query(
        `SELECT * FROM trend_intelligence ORDER BY pulled_at DESC LIMIT 1`
      );
  const row = rows[0];
  if (!row) return null;
  const ageMs = Date.now() - Number(row.pulled_at);
  if (ageMs > maxAgeDays * 24 * 3600 * 1000) return null; // stale — caller falls back to GENRES[genreKey] static data
  return row;
}

// ── Admin routes ────────────────────────────────────────────────────────────

router.post('/pull', requireAuth, async (_req, res) => {
  try {
    const result = await pullTrendIntelligence();
    res.json({ ok: true, ...result });
  } catch (err) {
    captureError(err, { dept: 'music', fn: 'pullTrendIntelligence-manual' });
    res.status(500).json({ error: err.message });
  }
});

router.get('/latest', requireAuth, async (_req, res) => {
  try {
    // Latest row per genre (not just the single newest row across all genres)
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (genre) * FROM trend_intelligence ORDER BY genre, pulled_at DESC`
    );
    const { rows: genreRows } = await pool.query(
      `SELECT genre, COUNT(*)::int AS cnt FROM tracks GROUP BY genre ORDER BY cnt DESC`
    );
    const { rows: variationRows } = await pool.query(
      `SELECT * FROM creative_variation_log ORDER BY created_at DESC LIMIT 20`
    );
    res.json({ trends: rows, genreDistribution: genreRows, variationLog: variationRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
