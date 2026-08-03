import { Router } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEmployeeSkill(filename) {
  try { return readFileSync(join(__dirname, '../employees', filename), 'utf-8'); }
  catch { return null; }
}

const router = Router();

// ─── Content libraries ────────────────────────────────────────────────────────

const VOVAX_TOPICS = ['track_release', 'gig_announcement', 'behind_scenes', 'studio_session', 'fan_message'];
const SIGNAL_TOPICS = ['discovery', 'track_feature', 'underground_pick', 'artist_spotlight', 'genre_deep_dive'];

const VOVAX_SCRIPTS = {
  track_release:    ["Dropping something new. Heavy, hypnotic, built for the floor. Link in bio.", "New music out now. This one took time to get right.", "It's out. Heavy melodic techno for late nights. Listen."],
  gig_announcement: ["On stage at {venue} — {date}. See you there.", "Next show: {venue}, {date}. This one is going to hit hard.", "Playing {venue} on {date}. Come early."],
  behind_scenes:    ["Late night in the studio. This is what it sounds like when everything clicks.", "Hours in. Finding the groove. Heavy melodic techno doesn't come easy.", "Studio mode. Almost there."],
  studio_session:   ["Deep in the studio. Building something heavy and hypnotic.", "Late session. The bassline just locked in.", "This one is going somewhere dark and interesting."],
  fan_message:      ["Thank you for showing up. Every stream, every show — it means everything.", "The support keeps this going. Grateful.", "To everyone listening — this music exists because of you."],
};

const SIGNAL_SCRIPTS = {
  discovery:        ["Found this. Underground release, heavy melodic techno. Worth your time.", "This one just dropped. Underground, uncompromising. Listen.", "A new release from the underground. Heavy and hypnotic."],
  track_feature:    ["This release is what the underground sounds like right now.", "Heavy melodic techno. The kind of music that doesn't get enough attention.", "Track of the week. Underground and uncompromising."],
  underground_pick: ["This one has been on repeat. Underground, heavy, real.", "From the underground: a track that doesn't compromise.", "Not on the radar yet. It should be."],
  artist_spotlight: ["An artist building something real. No shortcuts, no compromises.", "One to watch. Heavy melodic techno with a clear artistic vision.", "This artist is doing it right. Underground and consistent."],
  genre_deep_dive:  ["Heavy melodic techno: the sound of the underground right now.", "The underground is alive. This is what it sounds like.", "Dark, hypnotic, uncompromising."],
};

// ─── HeyGen top-picks ─────────────────────────────────────────────────────────

const PERSONA_AVATAR = {
  vovax:  { include: ['dark','night','moody','minimal','underground','studio','street'], exclude: ['office','corporate','sofa','business','bright','suit','formal'] },
  signal: { include: ['urban','street','casual','outdoor','city','energetic','night','underground'], exclude: ['office','corporate','sofa','business','formal','suit'] },
};

function scoreAvatar(a, persona) {
  const name = (a.name || '').toLowerCase();
  const { include, exclude } = PERSONA_AVATAR[persona] ?? PERSONA_AVATAR.vovax;
  if (exclude.some(w => name.includes(w))) return 0;
  return include.filter(w => name.includes(w)).length;
}

function scoreVoice(v) {
  const lang = (v.language || '').toLowerCase();
  if (!lang.includes('english')) return 0;
  let score = 1;
  if (v.emotion_support) score += 1;
  if (v.preview_audio)   score += 1;
  return score;
}

let _heygenCache = null;
let _heygenCacheAt = 0;
const HEYGEN_CACHE_TTL = 10 * 60 * 1000;

async function fetchHeyGenData() {
  const now = Date.now();
  if (_heygenCache && (now - _heygenCacheAt) < HEYGEN_CACHE_TTL) return _heygenCache;
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey || apiKey === 'placeholder') throw new Error('HEYGEN_API_KEY not set');
  const [avatarRes, voiceRes] = await Promise.all([
    fetch('https://api.heygen.com/v2/avatars',    { headers: { 'X-Api-Key': apiKey } }),
    fetch('https://api.heygen.com/v1/voice.list', { headers: { 'X-Api-Key': apiKey } }),
  ]);
  const avatarData = await avatarRes.json();
  const voiceData  = await voiceRes.json();
  const avatars = (avatarData.data?.avatars ?? []).map(({ avatar_id, avatar_name, gender }) => ({ avatar_id, name: avatar_name ?? null, gender: gender ?? null }));
  const voices  = (voiceData.data?.list ?? voiceData.data?.voices ?? []).map(({ voice_id, name, language, gender, preview_audio, emotion_support }) => ({ voice_id, name: name ?? null, language: language ?? null, gender: gender ?? null, preview_audio: preview_audio ?? null, emotion_support: emotion_support ?? false }));
  _heygenCache = { avatars, voices };
  _heygenCacheAt = now;
  return _heygenCache;
}

async function getTopPicks(persona) {
  const { avatars, voices } = await fetchHeyGenData();
  const topAvatar = avatars
    .map(a => ({ ...a, _score: scoreAvatar(a, persona) }))
    .filter(a => a._score > 0)
    .sort((a, b) => b._score - a._score)[0] ?? null;

  // Constrain voice candidates to same gender as avatar — no fallback to mismatched pairing
  const avatarGender = topAvatar?.gender ? topAvatar.gender.toLowerCase() : null;
  const voiceCandidates = avatarGender
    ? voices.filter(v => v.gender && v.gender.toLowerCase() === avatarGender)
    : voices;

  const topVoice = voiceCandidates
    .map(v => ({ ...v, _score: scoreVoice(v) }))
    .filter(v => v._score > 0)
    .sort((a, b) => b._score - a._score)[0] ?? null;

  console.log(`getTopPicks(${persona}): avatar="${topAvatar?.name}" gender=${avatarGender} → voice="${topVoice?.name}" gender=${topVoice?.gender ?? 'n/a'} candidates=${voiceCandidates.length}`);

  return {
    avatar_id:   topAvatar?.avatar_id ?? null,
    avatar_name: topAvatar?.name      ?? null,
    avatar_gender: avatarGender,
    voice_id:    topVoice?.voice_id   ?? null,
    voice_name:  topVoice?.name       ?? null,
  };
}

// Submit a HeyGen video render job — returns {video_id, avatar_id, voice_id} or null
async function submitHeyGenRender(script, persona) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey || apiKey === 'placeholder') return null;

  let picks;
  try { picks = await getTopPicks(persona); } catch { return null; }
  if (!picks?.avatar_id || !picks?.voice_id) return null;

  const body = {
    video_inputs: [{
      character:  { type: 'avatar', avatar_id: picks.avatar_id, avatar_style: 'normal' },
      voice:      { type: 'text',   input_text: script,         voice_id: picks.voice_id, speed: 1.0 },
      background: { type: 'color',  value: '#000000' },
    }],
    aspect_ratio: '9:16',
    caption: true,
  };

  try {
    const r = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok || !data.data?.video_id) {
      console.error('HeyGen submit failed:', data?.error ?? data);
      return null;
    }
    return { video_id: data.data.video_id, avatar_id: picks.avatar_id, voice_id: picks.voice_id };
  } catch (e) {
    console.error('HeyGen submit error:', e.message);
    return null;
  }
}

// Poll a single HeyGen video ID — used by cron
export async function checkHeyGenRender(videoId) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return null;
  try {
    const r = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': apiKey },
    });
    const data = await r.json();
    return data.data ?? null;  // { status, video_url, thumbnail_url, duration, ... }
  } catch { return null; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function scriptHash(script) { return Buffer.from(script.slice(0, 50)).toString('base64').slice(0, 16); }
function pickFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickTopic(allTopics, usedRecently) {
  const available = allTopics.filter(t => !usedRecently.includes(t));
  return pickFrom(available.length > 0 ? available : allTopics);
}

async function recentTopics(channel, n = 3) {
  const { rows } = await pool.query(
    `SELECT topic FROM publish_queue WHERE channel=$1 AND status='published' ORDER BY published_at DESC LIMIT $2`,
    [channel, n]
  );
  return rows.map(r => r.topic);
}

async function recentAvatarIds(channel, n = 5) {
  const { rows } = await pool.query(
    `SELECT avatar_id FROM publish_queue WHERE channel=$1 AND status='published' AND avatar_id IS NOT NULL ORDER BY published_at DESC LIMIT $2`,
    [channel, n]
  );
  return rows.map(r => r.avatar_id);
}

async function nextGig() {
  const { rows } = await pool.query(
    `SELECT venue, date, city, notes FROM gigs WHERE date::date >= CURRENT_DATE ORDER BY date ASC LIMIT 1`
  );
  if (!rows[0]) return null;
  const g = rows[0];
  let meta = {};
  try { meta = JSON.parse(g.notes); } catch {}
  const dateStr = new Date(g.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return { venue: g.city ? `${g.venue}, ${g.city}` : g.venue, date: dateStr };
}

async function pickUnusedTrack(lookback = 10) {
  const { rows } = await pool.query(
    `WITH recent AS (SELECT track_id FROM publish_queue WHERE track_id IS NOT NULL ORDER BY created_at DESC LIMIT $1)
     SELECT * FROM tracks WHERE id NOT IN (SELECT track_id FROM recent) ORDER BY RANDOM() LIMIT 1`,
    [lookback]
  );
  if (rows[0]) return rows[0];
  const { rows: any } = await pool.query('SELECT * FROM tracks ORDER BY RANDOM() LIMIT 1');
  return any[0] ?? null;
}

const TOPIC_ANGLE = {
  track_release:    'You just released this track. The post is about the release.',
  behind_scenes:    'You are in the studio, working on or inspired by this track.',
  studio_session:   'Late night studio session. Deep in the sound of this track.',
  fan_message:      'This track exists because of your fans. Express gratitude through the lens of this music.',
  discovery:        'You just discovered this underground track. Express the excitement of the find.',
  track_feature:    'Highlight what makes this track stand out from the underground.',
  underground_pick: 'This is your underground pick of the week.',
  artist_spotlight: 'Spotlight the artistic vision behind this track (without naming the artist).',
  genre_deep_dive:  'Use this track as a lens into the heavy melodic techno underground.',
};

async function generateScript(persona, track, topic) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const angle   = TOPIC_ANGLE[topic] ?? '';
  const rawDesc = (track.description ?? '').slice(0, 300);
  const desc  = persona === 'signal' ? rawDesc.replace(/vovax/gi, '[artist]') : rawDesc;
  const title = persona === 'signal' ? (track.title ?? '').replace(/vovax/gi, '[track]') : (track.title ?? '');

  let prompt;
  if (persona === 'signal') {
    prompt = `You are Signal Detected, an anonymous underground music curator posting on Instagram/TikTok.\n${angle}\n\nTrack: "${title}"\nGenre: ${track.genre ?? 'underground techno'}\n${desc ? `Description: ${desc}` : ''}\n\nWrite one short curator post (max 120 characters). Rules:\n- NEVER mention the artist name or "VOVAX"\n- NEVER say "underground" or "heavy melodic techno" verbatim — imply it\n- Tone: energetic scout who found something first\n- No hashtags, no emojis\nWrite only the post text, nothing else.`;
  } else {
    prompt = `You are VOVAX, an underground heavy melodic techno artist posting on Instagram/TikTok.\n${angle}\n\nTrack: "${title}"\nGenre: ${track.genre ?? 'heavy melodic techno'}\n${desc ? `Description: ${desc}` : ''}\n\nWrite one short first-person post (max 120 characters). Rules:\n- Dark, minimal, intimate tone\n- No hashtags, no emojis\nWrite only the post text, nothing else.`;
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 150, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await r.json();
  if (!r.ok) return null;
  return data.content?.[0]?.text?.trim() ?? null;
}

// ─── QA review ───────────────────────────────────────────────────────────────

async function runQaReview(item) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { qa_status: 'skip', qa_reason: 'ANTHROPIC_API_KEY not set', qa_issues: [] };

  const skillContent = loadEmployeeSkill('yuval-contentcheck.md')
    ?? 'You are a content quality reviewer for VOVAX and Signal Detected. Return JSON with {approved: bool, reason: string, issues: string[]}.';

  const isSignal = item.channel === 'signal';
  const persona  = isSignal ? 'Signal Detected (anonymous underground music curator, Instagram)' : 'VOVAX (personal underground techno artist, Instagram)';
  const rules    = isSignal
    ? `- MUST NOT contain "VOVAX" or any artist name\n- Curator discovery voice, not artist voice\n- Energetic, first-person scout tone\n- No hashtags, no emojis`
    : `- First-person artist voice (dark, minimal, intimate)\n- No hashtags, no emojis\n- No corporate or marketing language`;

  const prompt = `Review this ${persona} post for publication quality.\n\nPost: "${item.script}"\nTopic: ${item.topic}\n\nApproval criteria:\n${rules}\n- Max 120 characters\n- Grammatically correct and standalone-clear\n\nRespond ONLY with this JSON (no markdown, no explanation):\n{"approved": <boolean>, "reason": "<one sentence>", "issues": [<issue strings> or empty array]}`;

  let qa = { approved: false, reason: 'QA API error', issues: [] };
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, system: skillContent, messages: [{ role: 'user', content: prompt }] }),
    });
    if (r.ok) {
      const data = await r.json();
      let text = data.content?.[0]?.text?.trim() ?? '{}';
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      qa = JSON.parse(text);
    } else {
      const errData = await r.json().catch(() => ({}));
      qa.reason = `API ${r.status}: ${errData?.error?.message ?? r.statusText}`;
    }
  } catch (e) { qa.reason = e.message ?? 'QA parse error'; }

  const qaStatus = qa.approved ? 'pass' : 'fail';
  await pool.query(
    `UPDATE publish_queue SET qa_status=$1, qa_reason=$2, qa_issues=$3, qa_at=$4, qa_employee=$5 WHERE id=$6`,
    [qaStatus, qa.reason ?? null, qa.issues ?? [], Date.now(), 'yuval-contentcheck', item.id]
  );

  // Auto-reject + regenerate on QA fail (VOVAX only, max 3 attempts to prevent loops)
  if (qaStatus === 'fail' && item.channel === 'vovax') {
    const attempts = item.rejection_count ?? 0;
    if (attempts < 3) {
      const reason = `QA auto-reject (attempt ${attempts + 1}/3): ${qa.reason ?? 'failed quality check'}`;
      const updated = await pool.query(
        `UPDATE publish_queue SET status='rejected', decided_at=$1, notes=$2
         WHERE id=$3 AND status IN ('pending','rendering') RETURNING id`,
        [Date.now(), reason, item.id]
      );
      if (updated.rows.length > 0) {
        createVovaxItem({
          platform:        item.platform ?? 'instagram',
          topic:           item.topic,
          forceTrackId:    item.track_id ?? null,
          rejCount:        attempts + 1,
          regeneratedFrom: item.id,
        }).catch(e => console.error('QA auto-regen failed:', e.message));
      }
    }
    // If attempts >= 3: leave as pending so user can review manually
  }

  return { ok: true, qa_status: qaStatus, qa_reason: qa.reason ?? null, qa_issues: qa.issues ?? [], employee: 'yuval-contentcheck' };
}

// ─── Pending notification ─────────────────────────────────────────────────────

export async function sendPendingNotification() {
  const apiKey    = process.env.RESEND_API_KEY;
  const recipient = process.env.DIGEST_RECIPIENT_EMAIL;
  if (!apiKey || !recipient) return;
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM publish_queue WHERE channel='vovax' AND status='pending'`
  );
  const cnt = rows[0]?.cnt ?? 1;
  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const from   = process.env.DIGEST_FROM_EMAIL || 'VOVAX Digest <onboarding@resend.dev>';
  const appUrl = process.env.APP_URL || 'https://vovax-app-production.up.railway.app';
  await resend.emails.send({
    from,
    to: [recipient],
    subject: `VOVAX — ${cnt === 1 ? 'טיוטה חדשה מחכה' : `${cnt} טיוטות מחכות`} לאישורך`,
    html: `<div dir="rtl" style="font-family:sans-serif;background:#0A0A0C;color:#F2F1ED;padding:32px;max-width:480px">
      <p style="color:#8B8A85;font-size:11px;letter-spacing:.15em;margin:0 0 12px">VOVAX · COMMAND CENTER</p>
      <h2 style="margin:0 0 16px;font-size:20px">${cnt === 1 ? 'טיוטה חדשה' : `${cnt} טיוטות`} ממתינ${cnt === 1 ? 'ת' : 'ות'} לאישורך</h2>
      <p style="color:#8B8A85;margin:0 0 24px">וידאו HeyGen מוכן. לחץ לצפייה ואישור:</p>
      <a href="${appUrl}/admin" style="background:#46C7FF;color:#0A0A0C;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block">
        פתח Command Center →
      </a>
    </div>`,
  });
}

// ─── Core VOVAX item creation (used by generate + auto-regen after reject) ────

async function createVovaxItem({ platform = 'instagram', topic: forceTopic, forceTrackId, rejCount = 0, regeneratedFrom = null }) {
  const usedTopics    = await recentTopics('vovax', 3);
  const usedAvatarIds = await recentAvatarIds('vovax', 5);
  const topic = forceTopic ?? pickTopic(VOVAX_TOPICS, usedTopics);

  let scriptTemplate = null;
  let trackId = forceTrackId ?? null;

  if (topic === 'gig_announcement') {
    const tpl = pickFrom(VOVAX_SCRIPTS.gig_announcement);
    const gig = await nextGig();
    if (gig) {
      scriptTemplate = tpl.replace('{venue}', gig.venue).replace('{date}', gig.date);
    } else {
      const fallback = pickTopic(VOVAX_TOPICS.filter(t => t !== 'gig_announcement'), usedTopics);
      scriptTemplate = pickFrom(VOVAX_SCRIPTS[fallback]);
    }
  } else {
    let track;
    if (forceTrackId) {
      const { rows } = await pool.query('SELECT * FROM tracks WHERE id=$1', [forceTrackId]);
      track = rows[0] ?? null;
    } else {
      track = await pickUnusedTrack();
    }
    if (track) {
      trackId        = track.id;
      scriptTemplate = await generateScript('vovax', track, topic);
    }
    if (!scriptTemplate) {
      scriptTemplate = pickFrom(VOVAX_SCRIPTS[topic] ?? VOVAX_SCRIPTS.studio_session);
      if (!forceTrackId) trackId = null;
    }
  }

  // Submit HeyGen render — non-blocking failure gracefully falls back to text-only pending
  const render = await submitHeyGenRender(scriptTemplate, 'vovax').catch(() => null);
  const status = render ? 'rendering' : 'pending';

  const id  = uid();
  const now = Date.now();
  const item = { id, channel: 'vovax', platform, topic, script: scriptTemplate, script_hash: scriptHash(scriptTemplate), avatar_id: render?.avatar_id ?? null, heygen_video_id: render?.video_id ?? null, status, created_at: now, track_id: trackId, rejection_count: rejCount, regenerated_from: regeneratedFrom };

  await pool.query(
    `INSERT INTO publish_queue (id,channel,platform,topic,script,script_hash,avatar_id,heygen_video_id,status,created_at,track_id,rejection_count,regenerated_from)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [item.id, item.channel, item.platform, item.topic, item.script, item.script_hash,
     item.avatar_id, item.heygen_video_id, item.status, item.created_at, item.track_id,
     item.rejection_count, item.regenerated_from]
  );

  // QA runs on the script immediately (non-blocking — video render runs in parallel)
  runQaReview(item).catch(e => console.error('QA error (vovax):', e.message));

  return { item, usedAvatarIds, rendering: !!render };
}

// ─── VOVAX endpoints ──────────────────────────────────────────────────────────

// Zapier calls on schedule → generates script, submits HeyGen, queues for approval
router.post('/vovax/generate', async (req, res) => {
  try {
    const { rows: pbRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM publish_queue WHERE channel='vovax' AND status='pending'`
    );
    const pendingBefore = pbRows[0]?.cnt ?? 0;

    const result = await createVovaxItem({ platform: req.body.platform ?? 'instagram', topic: req.body.topic });

    // Only notify if no HeyGen render is running (cron will notify when render completes)
    if (!result.rendering && pendingBefore === 0) {
      sendPendingNotification().catch(() => {});
    }

    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// App polls this to show pending items
router.get('/vovax/pending', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM publish_queue WHERE channel='vovax' AND status IN ('pending','rendering') ORDER BY created_at DESC`
  );
  res.json({ items: rows });
});

// App: approve a pending item (only after video_url exists — enforced by status check)
router.post('/vovax/:id/approve', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE publish_queue SET status='approved', decided_at=$1, avatar_id=COALESCE($2, avatar_id)
     WHERE id=$3 AND channel='vovax' AND status='pending' RETURNING *`,
    [Date.now(), req.body.avatar_id ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found or not pending' });
  res.json({ ok: true, item: rows[0] });
});

// App: reject — auto-regenerates new version with same track + topic
router.post('/vovax/:id/reject', async (req, res) => {
  const reason = req.body.reason ?? req.body.notes ?? null;
  const { rows } = await pool.query(
    `UPDATE publish_queue SET status='rejected', decided_at=$1, notes=$2
     WHERE id=$3 AND channel='vovax' AND status IN ('pending','approved') RETURNING *`,
    [Date.now(), reason, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found or already published' });
  const old = rows[0];

  // Auto-regenerate: new script + new HeyGen render, same track + topic
  let regenerated = null;
  try {
    const result = await createVovaxItem({
      platform:         old.platform ?? 'instagram',
      topic:            old.topic,
      forceTrackId:     old.track_id ?? null,
      rejCount:         (old.rejection_count ?? 0) + 1,
      regeneratedFrom:  old.id,
    });
    regenerated = result.item;
    // Notify if regenerated item goes straight to pending (no HeyGen)
    if (!result.rendering) sendPendingNotification().catch(() => {});
  } catch (e) {
    console.error('Auto-regenerate failed after reject:', e.message);
  }

  res.json({ ok: true, rejected: { id: old.id, reason }, regenerated });
});

// Zapier polls this every hour — returns oldest approved item with video_url
router.get('/vovax/next-approved', async (req, res) => {
  const platform = req.query.platform;
  const { rows } = platform
    ? await pool.query(`SELECT * FROM publish_queue WHERE channel='vovax' AND status='approved' AND platform=$1 ORDER BY decided_at ASC LIMIT 1`, [platform])
    : await pool.query(`SELECT * FROM publish_queue WHERE channel='vovax' AND status='approved' ORDER BY decided_at ASC LIMIT 1`);

  const item = rows[0] ?? null;
  if (!item) return res.json({ item: null });

  // Include top picks for backwards compat (Zapier may still use them for fallback)
  try {
    const picks = await getTopPicks('vovax');
    item.resolved_avatar_id = item.avatar_id || picks.avatar_id;
    item.voice_id           = picks.voice_id;
    item.avatar_name        = picks.avatar_name;
    item.voice_name         = picks.voice_name;
  } catch {}

  res.json({ item });
});

// Zapier calls after successful publish
router.post('/vovax/:id/mark-published', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE publish_queue SET status='published', published_at=$1
     WHERE id=$2 AND channel='vovax' AND status='approved' RETURNING *`,
    [Date.now(), req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found or not approved' });
  res.json({ ok: true, item: rows[0] });
});

// ─── Signal Detected endpoints ────────────────────────────────────────────────

router.get('/signal/brief', async (_req, res) => {
  try {
    const platform     = 'instagram';
    const usedTopics    = await recentTopics('signal', 3);
    const usedAvatarIds = await recentAvatarIds('signal', 5);
    const topic  = pickTopic(SIGNAL_TOPICS, usedTopics);
    const script = pickFrom(SIGNAL_SCRIPTS[topic] ?? SIGNAL_SCRIPTS.discovery);

    if (/vovax/i.test(script)) return res.status(500).json({ error: 'script_contains_vovax — content library error' });

    let trackId = null;
    let finalScript = script;
    const track = await pickUnusedTrack();
    if (track) {
      const claudeScript = await generateScript('signal', track, topic);
      if (claudeScript && !/vovax/i.test(claudeScript)) { finalScript = claudeScript; trackId = track.id; }
    }

    if (/vovax/i.test(finalScript)) return res.status(500).json({ error: 'script_contains_vovax — content library error' });

    const id  = uid();
    const now = Date.now();
    await pool.query(
      `INSERT INTO publish_queue (id,channel,platform,topic,script,script_hash,status,created_at,track_id)
       VALUES ($1,'signal',$2,$3,$4,$5,'pending',$6,$7)`,
      [id, platform, topic, finalScript, scriptHash(finalScript), now, trackId]
    );

    runQaReview({ id, channel: 'signal', topic, script: finalScript }).catch(e => console.error('QA error (signal):', e.message));

    let picks = { avatar_id: null, avatar_name: null, voice_id: null, voice_name: null };
    try { picks = await getTopPicks('signal'); } catch {}

    res.json({ id, topic, script: finalScript, avatar_ids_to_avoid: usedAvatarIds, track_id: trackId, ...picks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/signal/mark-published', async (req, res) => {
  const { id, avatar_id } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  const { rows } = await pool.query(
    `UPDATE publish_queue SET status='published', published_at=$1, avatar_id=$2
     WHERE id=$3 AND channel='signal' AND status='approved' RETURNING *`,
    [Date.now(), avatar_id ?? null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found or not approved' });
  res.json({ ok: true, item: rows[0] });
});

// ─── Manual QA trigger ───────────────────────────────────────────────────────

router.post('/:id/qa-review', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM publish_queue WHERE id=$1`, [req.params.id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'not found' });
    const result = await runQaReview(item);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Top-picks endpoint ───────────────────────────────────────────────────────

router.get('/top-picks', async (req, res) => {
  const persona = req.query.persona === 'signal' ? 'signal' : 'vovax';
  try {
    const picks = await getTopPicks(persona);
    res.json({ persona, ...picks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── History ─────────────────────────────────────────────────────────────────

router.get('/history', async (req, res) => {
  const channel = req.query.channel;
  const base    = `SELECT * FROM publish_queue`;
  const where   = channel ? ` WHERE channel=$1` : '';
  const order   = ` ORDER BY created_at DESC LIMIT 50`;
  const { rows } = channel ? await pool.query(base + where + order, [channel]) : await pool.query(base + order);
  res.json({ items: rows });
});

export default router;
