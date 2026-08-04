import { Router } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();
const PIXAZO_BASE = 'https://gateway.pixazo.ai';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function loadSkill(filename) {
  try { return readFileSync(join(__dirname, '../employees', filename), 'utf-8'); }
  catch { return ''; }
}

// ── Prompt builder (mirrors AceStep.jsx client logic) ─────────────────────────

const CONTEXT_MAP = {
  peak:       { bpm: 127, energy: 'peak-hour energy, maximum floor impact, relentless drive, tension never fully releasing' },
  opening:    { bpm: 121, energy: 'building tension, hypnotic groove, slow energy rise' },
  chill:      { bpm: 112, energy: 'deep atmospheric, meditative flow, reduced kick intensity, wide ambient space' },
  irrelevant: { bpm: 124, energy: '' },
};

const PLATFORM_SECS = { tiktok: 120, spotify: 180, soundcloud: 210, club: 240 };

function energyPrompt(v) {
  if (v <= 25) return 'low-energy atmospheric breakdown, minimal percussion, wide meditative ambient space';
  if (v <= 50) return 'hypnotic groove-focused mid-set energy, steady building tension';
  if (v <= 75) return 'high-drive intensity, relentless momentum, pre-peak floor pressure';
  return 'peak-hour maximum impact, relentless four-on-the-floor drive, tension never fully releasing';
}

function weirdnessPrompt(v) {
  if (v <= 10) return '';
  if (v <= 25) return 'conventional structured arrangement, pure genre adherence';
  if (v <= 50) return 'subtle unexpected textural variations, slight experimental touches';
  if (v <= 75) return 'experimental sound design, unconventional rhythmic breaks, IDM-influenced elements';
  return 'chaotic glitch elements, industrial noise, avant-garde deconstructed structure';
}

function buildPrompt({ contextHour, bpmOverride, weirdness = 0, energyLevel, mood = '' }) {
  const effectiveBpm = bpmOverride ?? CONTEXT_MAP[contextHour]?.bpm ?? 124;
  const contextEnergy = CONTEXT_MAP[contextHour]?.energy ?? '';
  const parts = [
    'Heavy melodic techno', `${effectiveBpm} BPM`, 'G minor',
    'rolling hypnotic bassline', 'dark atmospheric pads', 'driving four-on-the-floor kick',
  ];
  const ep = energyLevel != null ? energyPrompt(energyLevel) : contextEnergy;
  if (ep) parts.push(ep);
  const wp = weirdnessPrompt(weirdness);
  if (wp) parts.push(wp);
  if (mood.trim()) parts.push(mood.trim());
  parts.push('big reverb space like a treated studio, professional club-ready mix');
  return parts.join(', ');
}

// ── עמית's briefing — autonomous parameter selection ─────────────────────────

const CONTEXT_ROTATION = ['peak', 'opening', 'chill', 'peak', 'opening'];
const PLATFORM_ROTATION = ['spotify', 'soundcloud', 'spotify', 'club'];
const MOOD_POOL = [
  'מסתורי ועמוק', 'בונה לקליימקס', 'מתח מתמשך', 'חלומי ואפל',
  'נוסטלגי', 'מלנכולי', 'עוצמתי ובלתי פוסק', 'שקט לפני הסערה',
  'אורבני ומדוכא', 'מרחב פתוח ואינסופי',
];

async function amitBrief() {
  const { rows: recent } = await pool.query(
    `SELECT context_hour, platform, mood FROM music_queue
     WHERE created_at > $1 AND status != 'failed' ORDER BY created_at DESC LIMIT 12`,
    [Date.now() - 14 * 24 * 3600000]
  );

  const usedContexts  = new Set(recent.map(r => r.context_hour).filter(Boolean));
  const usedPlatforms = new Set(recent.map(r => r.platform).filter(Boolean));
  const usedMoods     = new Set(recent.map(r => r.mood).filter(Boolean));

  const contextHour = CONTEXT_ROTATION.find(c => !usedContexts.has(c))
    ?? CONTEXT_ROTATION[Math.floor(Math.random() * CONTEXT_ROTATION.length)];
  const platform = PLATFORM_ROTATION.find(p => !usedPlatforms.has(p))
    ?? PLATFORM_ROTATION[Math.floor(Math.random() * PLATFORM_ROTATION.length)];
  const mood = MOOD_POOL.find(m => !usedMoods.has(m))
    ?? MOOD_POOL[Math.floor(Math.random() * MOOD_POOL.length)];

  const bpm = CONTEXT_MAP[contextHour]?.bpm ?? 124;
  const weirdness = 0;
  const energyLevel = contextHour === 'peak' ? 85 : contextHour === 'opening' ? 55 : 30;
  const duration_s = PLATFORM_SECS[platform] ?? 180;
  const prompt = buildPrompt({ contextHour, bpmOverride: null, weirdness, energyLevel, mood });

  return { contextHour, platform, bpm, weirdness, energyLevel, mood, duration_s, prompt };
}

// ── Generation trigger ────────────────────────────────────────────────────────

async function triggerGeneration(params, regenFrom = null, regenCount = 0) {
  const apiKey = process.env.PIXAZO_API_KEY;
  if (!apiKey) throw new Error('PIXAZO_API_KEY not set');

  const { contextHour, platform, bpm, weirdness = 0, energyLevel, mood = '', duration_s = 180, prompt } = params;
  const id  = uid();
  const now = Date.now();

  const upstream = await fetch(`${PIXAZO_BASE}/ace-step-xl/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': apiKey },
    body: JSON.stringify({ prompt, duration: duration_s, batch_size: 1 }),
  });
  const data = await upstream.json();
  if (!upstream.ok || !data.request_id) {
    throw new Error(data.message ?? data.error ?? 'No request_id from Pixazo');
  }

  await pool.query(
    `INSERT INTO music_queue
     (id,status,request_id,prompt,duration_s,bpm,model,batch_size,context_hour,platform,mood,
      weirdness,energy_level,rejection_count,regenerated_from,created_at,updated_at)
     VALUES($1,'generating',$2,$3,$4,$5,'ace-step-xl',1,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
    [id, data.request_id, prompt, duration_s, bpm, contextHour, platform, mood,
     weirdness, energyLevel, regenCount, regenFrom, now]
  );

  console.log(`Music[עמית]: triggered ${id} | context=${contextHour} platform=${platform} bpm=${bpm} mood="${mood}"`);
  return id;
}

// ── Pixazo poll (called from cron every 2 min) ────────────────────────────────

export async function pollMusicGeneration() {
  const { rows } = await pool.query(
    `SELECT * FROM music_queue WHERE status='generating' AND request_id IS NOT NULL`
  );
  if (rows.length === 0) return;

  const apiKey = process.env.PIXAZO_API_KEY;
  if (!apiKey) return;

  for (const item of rows) {
    try {
      const r = await fetch(`${PIXAZO_BASE}/v2/requests/status/${item.request_id}`,
        { headers: { 'Ocp-Apim-Subscription-Key': apiKey } }
      );
      const data = await r.json();

      if (data.status === 'COMPLETED') {
        const urls = data.output?.media_url ?? [];
        await pool.query(
          `UPDATE music_queue SET status='talia_qa', audio_urls=$1, updated_at=$2 WHERE id=$3`,
          [JSON.stringify(urls), Date.now(), item.id]
        );
        console.log(`Music: generation complete ${item.id} → טליה QA`);
        runTaliaQA({ ...item, audio_urls: urls }).catch(e => console.error('Music[טליה]:', e.message));

      } else if (data.status === 'FAILED' || data.status === 'ERROR') {
        await pool.query(
          `UPDATE music_queue SET status='failed', updated_at=$1 WHERE id=$2`, [Date.now(), item.id]
        );
        console.error(`Music: Pixazo FAILED for ${item.id}`);
      }
    } catch (e) {
      console.error(`Music: poll error ${item.id}:`, e.message);
    }
  }
}

// ── טליה QA ───────────────────────────────────────────────────────────────────

async function runTaliaQA(item) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const urls = item.audio_urls ?? [];
  const briefLines = [
    item.mood        && `Mood/intent: ${item.mood}`,
    item.context_hour && `Context: ${item.context_hour} set`,
    item.platform    && `Target platform: ${item.platform}`,
  ].filter(Boolean).join('\n');

  const system = `You are טליה, QA specialist at VOVAX. Evaluate AI-generated music against VOVAX quality criteria.
VOVAX style: Heavy melodic techno / minimal power grooves / cinematic tension. References: Tale Of Us, Anyma, ARTBAT, Stephan Bodzin.
You cannot listen to audio — for listening-dependent criteria, provide a precise checklist based on what the prompt should produce.
Respond with valid JSON only:
{"verdict":"APPROVED"|"NEEDS_FIX"|"REJECTED","criteria":{"0_clean_stems":{"status":"PASS"|"FAIL"|"LISTEN_REQUIRED","note":"..."},"1_style_fit":{"status":"PASS"|"FAIL"|"NEEDS_FIX","note":"..."},"2_technical":{"status":"PASS"|"FAIL"|"LISTEN_REQUIRED","note":"..."},"3_completeness":{"status":"PASS"|"FAIL"|"LISTEN_REQUIRED","note":"..."},"4_originality":{"status":"PASS"|"FAIL"|"NEEDS_FIX","note":"..."}},"summary":"one sentence","fix_if_rejected":"only when NEEDS_FIX or REJECTED"}`;

  const userMsg = `BRIEF:\n${briefLines || '(none)'}\nPROMPT:\n${item.prompt}\nAUDIO (${urls.length} files — not listenable):\n${urls.join('\n') || '(none)'}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 900, system, messages: [{ role: 'user', content: userMsg }] }),
  });
  const raw  = await resp.json();
  const text = raw.content?.[0]?.text ?? '';
  const qa   = JSON.parse(text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim());

  const now = Date.now();
  await pool.query(
    `UPDATE music_queue SET status='amit_review', talia_verdict=$1, talia_result=$2, talia_at=$3, updated_at=$3 WHERE id=$4`,
    [qa.verdict, JSON.stringify(qa), now, item.id]
  );
  console.log(`Music[טליה]: ${item.id} → ${qa.verdict} | ${qa.summary}`);

  if (qa.verdict === 'REJECTED') {
    await maybeRegenerate(item, `טליה rejected: ${qa.summary}`);
  } else {
    runAmitGate({ ...item, talia_verdict: qa.verdict, talia_result: qa }).catch(e => console.error('Music[עמית]:', e.message));
  }
}

// ── עמית manager gate ─────────────────────────────────────────────────────────

async function runAmitGate(item) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const skill = loadSkill('amit-creation.md');
  const talia = item.talia_result ?? {};

  const system = `${skill}

## הוראת תגובה — Manager Gate (Mandatory)
אתה מבצע שער מנהל חובה לפני שפריט מגיע לבעלים.
בדוק ארבעה ממדים:
1. האם הפרומפט מייצג את רמת המותג של VOVAX? (אסתטיקה, heavy melodic techno, G minor)
2. האם פסיקת טליה לגבי style fit ו-originality תואמת לסטנדרט שלך?
3. האם אתה כמנהל המחלקה מוכן לשים את שמך על הפריט הזה?
4. האם זה עומד בסטנדרט "מהטובים ביותר בעולם" — לא "מספיק טוב"?
החזר JSON בלבד — ללא markdown:
{"approved":<boolean>,"brand_standard_met":<boolean>,"reason":"<פסק דין מפורט — מה בדקת, מה עמד/לא עמד בסטנדרט>","production_notes":"<הוראה לבן/לצוות אם צריך — ריק אם לא>"}`;

  const userMsg = `פריט לשער מנהל:
פרומפט: ${item.prompt}
הקשר: ${item.context_hour ?? '?'} · פלטפורמה: ${item.platform ?? '?'} · BPM: ${item.bpm ?? '?'} · אורך: ${item.duration_s ?? '?'}s
מצב רוח: ${item.mood ?? '?'}

פסיקת טליה: ${item.talia_verdict ?? 'לא רץ'}
תקציר: ${talia.summary ?? '—'}
${talia.fix_if_rejected ? `הערת תיקון טליה: ${talia.fix_if_rejected}` : ''}

בצע שער מנהל.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system, messages: [{ role: 'user', content: userMsg }] }),
  });
  const raw  = await resp.json();
  const text = raw.content?.[0]?.text ?? '';
  const gate = JSON.parse(text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim());

  const now = Date.now();
  const fullReason = gate.reason + (gate.production_notes ? ` | הערות לצוות: ${gate.production_notes}` : '');

  if (gate.approved) {
    await pool.query(
      `UPDATE music_queue SET status='user_pending', amit_approved=true, amit_reason=$1, amit_at=$2, updated_at=$2 WHERE id=$3`,
      [fullReason, now, item.id]
    );
    console.log(`Music[עמית]: APPROVED ${item.id} → user_pending | ${gate.reason}`);
  } else {
    await pool.query(
      `UPDATE music_queue SET amit_approved=false, amit_reason=$1, amit_at=$2, updated_at=$2 WHERE id=$3`,
      [fullReason, now, item.id]
    );
    console.log(`Music[עמית]: REJECTED ${item.id} | ${gate.reason}`);
    await maybeRegenerate(item, `עמית rejected: ${gate.reason}`);
  }
}

// ── Regeneration ──────────────────────────────────────────────────────────────

async function maybeRegenerate(item, reason) {
  const rejCount = (item.rejection_count ?? 0) + 1;
  await pool.query(
    `UPDATE music_queue SET status='failed', rejection_count=$1, updated_at=$2 WHERE id=$3`,
    [rejCount, Date.now(), item.id]
  );
  if (rejCount >= 3) {
    console.log(`Music: ${item.id} gave up after ${rejCount} attempts`);
    return;
  }
  console.log(`Music: regen #${rejCount} for ${item.id} — ${reason}`);
  try {
    const params = {
      contextHour: item.context_hour, platform: item.platform, bpm: item.bpm,
      weirdness: item.weirdness ?? 0, energyLevel: item.energy_level,
      mood: item.mood ?? '', duration_s: item.duration_s ?? 180, prompt: item.prompt,
    };
    await triggerGeneration(params, item.id, rejCount);
  } catch (e) {
    console.error('Music: regen trigger failed:', e.message);
  }
}

// ── Autonomous weekly cycle (called from cron) ────────────────────────────────

export async function runMusicCycle() {
  if (!process.env.PIXAZO_API_KEY) {
    console.log('Music: PIXAZO_API_KEY not set — skipping autonomous cycle');
    return;
  }
  const weeklyTarget = parseInt(process.env.MUSIC_WEEKLY_TARGET ?? '3', 10);
  const weekStart = Date.now() - 7 * 24 * 3600000;
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM music_queue WHERE created_at > $1 AND status != 'failed'`,
    [weekStart]
  );
  const thisWeek = rows[0]?.cnt ?? 0;
  if (thisWeek >= weeklyTarget) {
    console.log(`Music[עמית]: weekly target met (${thisWeek}/${weeklyTarget})`);
    return;
  }
  console.log(`Music[עמית]: below quota (${thisWeek}/${weeklyTarget}) — initiating generation`);
  const params = await amitBrief();
  console.log(`Music[עמית]: brief → context=${params.contextHour} platform=${params.platform} bpm=${params.bpm} mood="${params.mood}"`);
  await triggerGeneration(params);
}

// ── HTTP routes ───────────────────────────────────────────────────────────────

router.get('/queue', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM music_queue ORDER BY created_at DESC LIMIT 50`);
    res.json({ items: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/cycle', requireAuth, async (_req, res) => {
  try { await runMusicCycle(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/user-approve', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE music_queue SET status='user_approved', updated_at=$1 WHERE id=$2 AND status='user_pending' RETURNING *`,
      [Date.now(), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found or not pending' });
    res.json({ ok: true, item: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/user-reject', requireAuth, async (req, res) => {
  const { reason } = req.body ?? {};
  try {
    const { rows } = await pool.query(
      `UPDATE music_queue SET status='user_rejected', amit_reason=COALESCE($1, amit_reason), updated_at=$2 WHERE id=$3 AND status='user_pending' RETURNING *`,
      [reason ?? null, Date.now(), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found or not pending' });
    res.json({ ok: true, item: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
