import { Router } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { captureError } from '../sentry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();
const PIXAZO_BASE = 'https://gateway.pixazo.ai';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function loadSkill(filename) {
  try { return readFileSync(join(__dirname, '../employees', filename), 'utf-8'); }
  catch { return ''; }
}

// ── Variation pools ───────────────────────────────────────────────────────────

const CONTEXT_MAP = {
  peak:       { bpm: 127, energy: 'peak-hour energy, maximum floor impact, relentless drive, tension never fully releasing' },
  opening:    { bpm: 121, energy: 'building tension, hypnotic groove, slow energy rise' },
  chill:      { bpm: 112, energy: 'deep atmospheric, meditative flow, reduced kick intensity, wide ambient space' },
  irrelevant: { bpm: 124, energy: '' },
};

const PLATFORM_SECS = { tiktok: 120, spotify: 180, soundcloud: 210, club: 240 };

const CONTEXT_ROTATION   = ['peak', 'opening', 'chill', 'peak', 'opening'];
const PLATFORM_ROTATION  = ['spotify', 'soundcloud', 'spotify', 'club'];
const WEIRDNESS_ROTATION = [0, 0, 20, 0, 35];

const MOOD_POOL = [
  'מסתורי ועמוק', 'בונה לקליימקס', 'מתח מתמשך', 'חלומי ואפל',
  'נוסטלגי', 'מלנכולי', 'עוצמתי ובלתי פוסק', 'שקט לפני הסערה',
  'אורבני ומדוכא', 'מרחב פתוח ואינסופי',
];

const KEY_POOL = [
  'G minor', 'A minor', 'D minor', 'F# minor', 'C# minor', 'B minor',
];

const BASSLINE_POOL = [
  'rolling hypnotic bassline',
  'punching staccato bassline with filter envelope',
  'deep sub crawl with slow attack',
  'gliding legato bass with portamento slides',
  'rhythmic pumping bass locked to the kick',
  'dark walking bassline with harmonic movement',
];

const PAD_POOL = [
  'dark atmospheric pads',
  'evolving cinematic string pads',
  'cold metallic drone textures',
  'wide reverb-soaked chord pads with slow attack',
  'ghostly filtered pad layers breathing with LFO',
  'ominous sustained synth textures',
];

const KICK_POOL = [
  'driving four-on-the-floor kick',
  'weighty kick with long sub tail',
  'industrial stripped-back kick pattern',
  'heavy layered kick with tight transient click',
  'relentless mechanical kick with slight swing',
];

// ── Prompt builder ────────────────────────────────────────────────────────────

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

function buildPrompt({
  contextHour, bpmOverride, weirdness = 0, energyLevel, mood = '',
  key = 'G minor',
  bassline = 'rolling hypnotic bassline',
  pad = 'dark atmospheric pads',
  kick = 'driving four-on-the-floor kick',
  userBrief = '',
}) {
  const effectiveBpm    = bpmOverride ?? CONTEXT_MAP[contextHour]?.bpm ?? 124;
  const contextEnergy   = CONTEXT_MAP[contextHour]?.energy ?? '';
  const parts = [
    'Heavy melodic techno', `${effectiveBpm} BPM`, key, bassline, pad, kick,
  ];
  const ep = energyLevel != null ? energyPrompt(energyLevel) : contextEnergy;
  if (ep) parts.push(ep);
  const wp = weirdnessPrompt(weirdness);
  if (wp) parts.push(wp);
  if (mood.trim()) parts.push(mood.trim());
  if (userBrief.trim()) parts.push(userBrief.trim());
  parts.push('big reverb space like a treated studio, professional club-ready mix');
  return parts.join(', ');
}

// ── עמית's briefing — autonomous parameter selection ─────────────────────────

async function amitBrief() {
  const { rows: recent } = await pool.query(
    `SELECT context_hour, platform, mood, key_signature, bassline_desc, pad_desc, kick_desc, weirdness
     FROM music_queue
     WHERE created_at > $1 AND status != 'failed' ORDER BY created_at DESC LIMIT 12`,
    [Date.now() - 14 * 24 * 3600000]
  );

  const usedContexts  = new Set(recent.map(r => r.context_hour).filter(Boolean));
  const usedPlatforms = new Set(recent.map(r => r.platform).filter(Boolean));
  const usedMoods     = new Set(recent.map(r => r.mood).filter(Boolean));
  const usedKeys      = new Set(recent.map(r => r.key_signature).filter(Boolean));
  const usedBasslines = new Set(recent.map(r => r.bassline_desc).filter(Boolean));
  const usedPads      = new Set(recent.map(r => r.pad_desc).filter(Boolean));
  const usedKicks     = new Set(recent.map(r => r.kick_desc).filter(Boolean));
  const usedWeirdness = recent.map(r => r.weirdness ?? 0);

  const contextHour = CONTEXT_ROTATION.find(c => !usedContexts.has(c))
    ?? CONTEXT_ROTATION[Math.floor(Math.random() * CONTEXT_ROTATION.length)];
  const platform = PLATFORM_ROTATION.find(p => !usedPlatforms.has(p))
    ?? PLATFORM_ROTATION[Math.floor(Math.random() * PLATFORM_ROTATION.length)];
  const mood = MOOD_POOL.find(m => !usedMoods.has(m))
    ?? MOOD_POOL[Math.floor(Math.random() * MOOD_POOL.length)];
  const key = KEY_POOL.find(k => !usedKeys.has(k))
    ?? KEY_POOL[Math.floor(Math.random() * KEY_POOL.length)];
  const bassline = BASSLINE_POOL.find(b => !usedBasslines.has(b))
    ?? BASSLINE_POOL[Math.floor(Math.random() * BASSLINE_POOL.length)];
  const pad = PAD_POOL.find(p => !usedPads.has(p))
    ?? PAD_POOL[Math.floor(Math.random() * PAD_POOL.length)];
  const kick = KICK_POOL.find(k => !usedKicks.has(k))
    ?? KICK_POOL[Math.floor(Math.random() * KICK_POOL.length)];
  const weirdness = WEIRDNESS_ROTATION.find(w => !usedWeirdness.includes(w)) ?? 0;

  const bpm         = CONTEXT_MAP[contextHour]?.bpm ?? 124;
  const energyLevel = contextHour === 'peak' ? 85 : contextHour === 'opening' ? 55 : 30;
  const duration_s  = PLATFORM_SECS[platform] ?? 180;
  const prompt      = buildPrompt({ contextHour, bpmOverride: null, weirdness, energyLevel, mood, key, bassline, pad, kick });

  return { contextHour, platform, bpm, weirdness, energyLevel, mood, duration_s, prompt, key, bassline, pad, kick };
}

// ── Generation trigger ────────────────────────────────────────────────────────

async function triggerGeneration(params, regenFrom = null, regenCount = 0) {
  const apiKey = process.env.PIXAZO_API_KEY;
  if (!apiKey) throw new Error('PIXAZO_API_KEY not set');

  const {
    contextHour, platform, bpm, weirdness = 0, energyLevel, mood = '',
    duration_s = 180, prompt,
    key = 'G minor', bassline = 'rolling hypnotic bassline',
    pad = 'dark atmospheric pads', kick = 'driving four-on-the-floor kick',
  } = params;
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
      weirdness,energy_level,key_signature,bassline_desc,pad_desc,kick_desc,
      rejection_count,regenerated_from,created_at,updated_at)
     VALUES($1,'generating',$2,$3,$4,$5,'ace-step-xl',1,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)`,
    [id, data.request_id, prompt, duration_s, bpm, contextHour, platform, mood,
     weirdness, energyLevel, key, bassline, pad, kick, regenCount, regenFrom, now]
  );

  console.log(`Music[עמית]: triggered ${id} | context=${contextHour} platform=${platform} bpm=${bpm} key="${key}" mood="${mood}"`);
  return id;
}

// ── Pixazo poll (called from cron every 2 min) ────────────────────────────────

export async function pollMusicGeneration() {
  const ORPHAN_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  // ── 1. Poll Pixazo for in-flight 'generating' items ──────────────────────────
  const { rows } = await pool.query(
    `SELECT * FROM music_queue WHERE status='generating' AND request_id IS NOT NULL`
  );

  const apiKey = process.env.PIXAZO_API_KEY;
  if (apiKey) {
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

  // ── 2. Recover talia_qa orphans (QA call failed silently) ────────────────────
  const { rows: taliaOrphans } = await pool.query(
    `SELECT * FROM music_queue WHERE status='talia_qa' AND talia_verdict IS NULL AND updated_at < $1`,
    [Date.now() - ORPHAN_THRESHOLD_MS]
  );
  for (const item of taliaOrphans) {
    console.log(`Music[טליה recovery]: orphan ${item.id} stuck ${Math.round((Date.now() - Number(item.updated_at)) / 60000)}min — re-running QA`);
    runTaliaQA(item).catch(e => console.error('Music[טליה orphan]:', e.message));
  }

  // ── 3. Recover amit_review orphans (gate call failed silently) ───────────────
  const { rows: amitOrphans } = await pool.query(
    `SELECT * FROM music_queue WHERE status='amit_review' AND amit_approved IS NULL AND updated_at < $1`,
    [Date.now() - ORPHAN_THRESHOLD_MS]
  );
  for (const item of amitOrphans) {
    console.log(`Music[עמית recovery]: orphan ${item.id} stuck — re-running gate`);
    runAmitGate(item).catch(e => console.error('Music[עמית orphan]:', e.message));
  }
}

// ── טליה QA ───────────────────────────────────────────────────────────────────

async function runTaliaQA(item) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const urls = item.audio_urls ?? [];
  const briefLines = [
    item.mood         && `Mood/intent: ${item.mood}`,
    item.context_hour && `Context: ${item.context_hour} set`,
    item.platform     && `Target platform: ${item.platform}`,
    item.key_signature && `Key: ${item.key_signature}`,
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

  let qa = null;
  try {
    qa = JSON.parse(text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim());
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) { try { qa = JSON.parse(match[0]); } catch (_2) { /* fall through */ } }
  }

  if (!qa) {
    const parseErr = new Error(`Music[טליה]: JSON parse failed for ${item.id}. Raw: ${text.slice(0, 120)}`);
    console.error(parseErr.message);
    captureError(parseErr, { dept: 'music', fn: 'runTaliaQA', item_id: item.id });
    await pool.query(
      `UPDATE music_queue SET status='failed', talia_verdict='REJECTED', talia_at=$1, updated_at=$1 WHERE id=$2`,
      [Date.now(), item.id]
    );
    await maybeRegenerate(item, 'טליה QA parse error');
    return;
  }

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
1. האם הפרומפט מייצג את רמת המותג של VOVAX? (אסתטיקה, heavy melodic techno)
2. האם פסיקת טליה לגבי style fit ו-originality תואמת לסטנדרט שלך?
3. האם אתה כמנהל המחלקה מוכן לשים את שמך על הפריט הזה?
4. האם זה עומד בסטנדרט "מהטובים ביותר בעולם" — לא "מספיק טוב"?
החזר JSON בלבד — ללא markdown:
{"approved":<boolean>,"brand_standard_met":<boolean>,"reason":"<פסק דין מפורט — מה בדקת, מה עמד/לא עמד בסטנדרט>","production_notes":"<הוראה לבן/לצוות אם צריך — ריק אם לא>"}`;

  const userMsg = `פריט לשער מנהל:
פרומפט: ${item.prompt}
הקשר: ${item.context_hour ?? '?'} · פלטפורמה: ${item.platform ?? '?'} · BPM: ${item.bpm ?? '?'} · אורך: ${item.duration_s ?? '?'}s
מצב רוח: ${item.mood ?? '?'} · טונאליות: ${item.key_signature ?? '?'}

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

  let gate = null;
  try {
    gate = JSON.parse(text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim());
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) { try { gate = JSON.parse(match[0]); } catch (_2) { /* fall through */ } }
  }

  if (!gate) {
    const parseErr = new Error(`Music[עמית]: JSON parse failed for ${item.id}. Raw: ${text.slice(0, 120)}`);
    console.error(parseErr.message);
    captureError(parseErr, { dept: 'music', fn: 'runAmitGate', item_id: item.id });
    const now = Date.now();
    await pool.query(
      `UPDATE music_queue SET amit_approved=false, amit_reason=$1, amit_at=$2, updated_at=$2 WHERE id=$3`,
      [`עמית gate parse error — raw: ${text.slice(0, 200)}`, now, item.id]
    );
    await maybeRegenerate(item, 'עמית gate parse error');
    return;
  }

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
      contextHour:  item.context_hour,
      platform:     item.platform,
      bpm:          item.bpm,
      weirdness:    item.weirdness ?? 0,
      energyLevel:  item.energy_level,
      mood:         item.mood ?? '',
      duration_s:   item.duration_s ?? 180,
      prompt:       item.prompt,
      key:          item.key_signature ?? 'G minor',
      bassline:     item.bassline_desc ?? 'rolling hypnotic bassline',
      pad:          item.pad_desc      ?? 'dark atmospheric pads',
      kick:         item.kick_desc     ?? 'driving four-on-the-floor kick',
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

  // Morning brief is mandatory — no default fallback, no autonomous generation without it
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' });
  const { rows: briefRows } = await pool.query(
    'SELECT brief FROM morning_brief WHERE date = $1',
    [todayStr]
  );
  if (!briefRows.length) {
    console.log(`Music[עמית]: no morning brief for ${todayStr} — skipping cycle. User must reply at /brief first.`);
    return;
  }
  const userBrief = briefRows[0].brief;
  console.log(`Music[עמית]: morning brief: "${userBrief.slice(0, 80)}"`);

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
  console.log(`Music[עמית]: below quota (${thisWeek}/${weeklyTarget}) — initiating generation with user brief`);
  const params = await amitBrief();
  // Rebuild prompt to fold user's morning brief into the generation instruction
  params.userBrief = userBrief;
  params.prompt = buildPrompt({
    contextHour: params.contextHour,
    bpmOverride: null,
    weirdness:   params.weirdness,
    energyLevel: params.energyLevel,
    mood:        params.mood,
    key:         params.key,
    bassline:    params.bassline,
    pad:         params.pad,
    kick:        params.kick,
    userBrief,
  });
  console.log(`Music[עמית]: brief → context=${params.contextHour} platform=${params.platform} bpm=${params.bpm} key="${params.key}" mood="${params.mood}" user="${userBrief.slice(0, 50)}"`);
  await triggerGeneration(params);
}

// ── HTTP routes ───────────────────────────────────────────────────────────────

router.get('/queue', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM music_queue ORDER BY created_at DESC LIMIT 50`);
    res.json({ items: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Preview what the next brief would be — no generation triggered, no DB write
router.get('/brief-preview', requireAuth, async (_req, res) => {
  try {
    const params = await amitBrief();
    res.json({ brief: params });
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
