import { Router } from 'express';
import pool from '../db/index.js';

const router = Router();

// ─── Content libraries ────────────────────────────────────────────────────────

const VOVAX_TOPICS = ['track_release', 'gig_announcement', 'behind_scenes', 'studio_session', 'fan_message'];

const SIGNAL_TOPICS = ['discovery', 'track_feature', 'underground_pick', 'artist_spotlight', 'genre_deep_dive'];

// VOVAX: first-person English. {venue} and {date} are filled from gigs table.
const VOVAX_SCRIPTS = {
  track_release:    ["Dropping something new. Heavy, hypnotic, built for the floor. Link in bio.", "New music out now. This one took time to get right.", "It's out. Heavy melodic techno for late nights. Listen."],
  gig_announcement: ["On stage at {venue} — {date}. See you there.", "Next show: {venue}, {date}. This one is going to hit hard.", "Playing {venue} on {date}. Come early."],
  behind_scenes:    ["Late night in the studio. This is what it sounds like when everything clicks.", "Hours in. Finding the groove. Heavy melodic techno doesn't come easy.", "Studio mode. Almost there."],
  studio_session:   ["Deep in the studio. Building something heavy and hypnotic.", "Late session. The bassline just locked in.", "This one is going somewhere dark and interesting."],
  fan_message:      ["Thank you for showing up. Every stream, every show — it means everything.", "The support keeps this going. Grateful.", "To everyone listening — this music exists because of you."],
};

// Signal Detected: anonymous curator. NEVER contains "VOVAX" or any artist handles.
const SIGNAL_SCRIPTS = {
  discovery:        ["Found this. Underground release, heavy melodic techno. Worth your time.", "This one just dropped. Underground, uncompromising. Listen.", "A new release from the underground. Heavy and hypnotic."],
  track_feature:    ["This release is what the underground sounds like right now.", "Heavy melodic techno. The kind of music that doesn't get enough attention.", "Track of the week. Underground and uncompromising."],
  underground_pick: ["This one has been on repeat. Underground, heavy, real.", "From the underground: a track that doesn't compromise.", "Not on the radar yet. It should be."],
  artist_spotlight: ["An artist building something real. No shortcuts, no compromises.", "One to watch. Heavy melodic techno with a clear artistic vision.", "This artist is doing it right. Underground and consistent."],
  genre_deep_dive:  ["Heavy melodic techno: the sound of the underground right now.", "The underground is alive. This is what it sounds like.", "Dark, hypnotic, uncompromising."],
};

// ─── HeyGen top-picks (server-side replica of HeyGenBrowser scoring) ──────────

const PERSONA_AVATAR = {
  vovax:  { include: ['dark','night','moody','minimal','underground','studio','street'], exclude: ['office','corporate','sofa','business','bright','suit','formal'] },
  signal: { include: ['urban','street','casual','outdoor','city','energetic','night','underground'], exclude: ['office','corporate','sofa','business','formal','suit'] },
};

function scoreAvatar(a, persona) {
  const name = (a.name || '').toLowerCase();
  const { include, exclude } = PERSONA_AVATAR[persona] ?? PERSONA_AVATAR.vovax;
  if (exclude.some((w) => name.includes(w))) return 0;
  return include.filter((w) => name.includes(w)).length;
}

function scoreVoice(v) {
  const lang = (v.language || '').toLowerCase();
  if (!lang.includes('english')) return 0;
  let score = 1;
  if (v.emotion_support) score += 1;
  if (v.preview_audio)   score += 1;
  return score;
}

// 10-minute in-memory cache so we don't hammer HeyGen API on every publish check
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

  const avatars = (avatarData.data?.avatars ?? []).map(({ avatar_id, avatar_name, gender }) => ({
    avatar_id, name: avatar_name ?? null, gender: gender ?? null,
  }));
  const voices = (voiceData.data?.list ?? voiceData.data?.voices ?? []).map(
    ({ voice_id, name, language, gender, preview_audio, emotion_support }) => ({
      voice_id, name: name ?? null, language: language ?? null, gender: gender ?? null,
      preview_audio: preview_audio ?? null, emotion_support: emotion_support ?? false,
    })
  );

  _heygenCache = { avatars, voices };
  _heygenCacheAt = now;
  return _heygenCache;
}

async function getTopPicks(persona) {
  const { avatars, voices } = await fetchHeyGenData();

  const topAvatar = avatars
    .map((a) => ({ ...a, _score: scoreAvatar(a, persona) }))
    .filter((a) => a._score > 0)
    .sort((a, b) => b._score - a._score)[0] ?? null;

  const topVoice = voices
    .map((v) => ({ ...v, _score: scoreVoice(v) }))
    .filter((v) => v._score > 0)
    .sort((a, b) => b._score - a._score)[0] ?? null;

  return {
    avatar_id:   topAvatar?.avatar_id ?? null,
    avatar_name: topAvatar?.name      ?? null,
    voice_id:    topVoice?.voice_id   ?? null,
    voice_name:  topVoice?.name       ?? null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function scriptHash(script) {
  return Buffer.from(script.slice(0, 50)).toString('base64').slice(0, 16);
}

function pickFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickTopic(allTopics, usedRecently) {
  const available = allTopics.filter((t) => !usedRecently.includes(t));
  return pickFrom(available.length > 0 ? available : allTopics);
}

async function recentTopics(channel, n = 3) {
  const { rows } = await pool.query(
    `SELECT topic FROM publish_queue WHERE channel=$1 AND status='published' ORDER BY published_at DESC LIMIT $2`,
    [channel, n]
  );
  return rows.map((r) => r.topic);
}

async function recentAvatarIds(channel, n = 5) {
  const { rows } = await pool.query(
    `SELECT avatar_id FROM publish_queue WHERE channel=$1 AND status='published' AND avatar_id IS NOT NULL ORDER BY published_at DESC LIMIT $2`,
    [channel, n]
  );
  return rows.map((r) => r.avatar_id);
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

// ─── Track helpers ────────────────────────────────────────────────────────────

async function pickUnusedTrack(lookback = 10) {
  const { rows } = await pool.query(
    `WITH recent AS (
       SELECT track_id FROM publish_queue
       WHERE  track_id IS NOT NULL
       ORDER  BY created_at DESC LIMIT $1
     )
     SELECT * FROM tracks
     WHERE  id NOT IN (SELECT track_id FROM recent)
     ORDER  BY RANDOM() LIMIT 1`,
    [lookback]
  );
  if (rows[0]) return rows[0];
  const { rows: any } = await pool.query('SELECT * FROM tracks ORDER BY RANDOM() LIMIT 1');
  return any[0] ?? null;
}

// Topic → posting angle for Claude prompt
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
  if (!apiKey) return null; // graceful fallback — caller uses hardcoded script

  const angle = TOPIC_ANGLE[topic] ?? '';
  const desc  = (track.description ?? '').slice(0, 300);

  let prompt;
  if (persona === 'signal') {
    prompt = `You are Signal Detected, an anonymous underground music curator posting on Instagram/TikTok.
${angle}

Track: "${track.title}"
Genre: ${track.genre ?? 'underground techno'}
${desc ? `Description: ${desc}` : ''}

Write one short curator post (max 120 characters). Rules:
- NEVER mention the artist name or "VOVAX"
- NEVER say "underground" or "heavy melodic techno" verbatim — imply it
- Tone: energetic scout who found something first
- No hashtags, no emojis
Write only the post text, nothing else.`;
  } else {
    prompt = `You are VOVAX, an underground heavy melodic techno artist posting on Instagram/TikTok.
${angle}

Track: "${track.title}"
Genre: ${track.genre ?? 'heavy melodic techno'}
${desc ? `Description: ${desc}` : ''}

Write one short first-person post (max 120 characters). Rules:
- Dark, minimal, intimate tone
- No hashtags, no emojis
Write only the post text, nothing else.`;
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  const data = await r.json();
  if (!r.ok) return null;
  return data.content?.[0]?.text?.trim() ?? null;
}

// ─── VOVAX endpoints ──────────────────────────────────────────────────────────

// Zapier calls this on schedule → creates pending item, waits for manual approval
router.post('/vovax/generate', async (req, res) => {
  try {
    const platform = req.body.platform ?? 'instagram';
    const usedTopics    = await recentTopics('vovax', 3);
    const usedAvatarIds = await recentAvatarIds('vovax', 5);
    const topic = req.body.topic ?? pickTopic(VOVAX_TOPICS, usedTopics);

    let scriptTemplate = null;
    let trackId        = null;

    if (topic === 'gig_announcement') {
      // Gig announcements need venue/date — keep hardcoded flow
      const tpl = pickFrom(VOVAX_SCRIPTS.gig_announcement);
      const gig = await nextGig();
      if (gig) {
        scriptTemplate = tpl.replace('{venue}', gig.venue).replace('{date}', gig.date);
      } else {
        const fallback = pickTopic(VOVAX_TOPICS.filter((t) => t !== 'gig_announcement'), usedTopics);
        scriptTemplate = pickFrom(VOVAX_SCRIPTS[fallback]);
      }
    } else {
      // Try track-aware Claude generation
      const track = await pickUnusedTrack();
      if (track) {
        trackId        = track.id;
        scriptTemplate = await generateScript('vovax', track, topic);
      }
      // Fall back to hardcoded library if Claude unavailable or no tracks synced
      if (!scriptTemplate) {
        scriptTemplate = pickFrom(VOVAX_SCRIPTS[topic] ?? VOVAX_SCRIPTS.studio_session);
        trackId        = null;
      }
    }

    const item = {
      id: uid(),
      channel: 'vovax',
      platform,
      topic,
      script: scriptTemplate,
      script_hash: scriptHash(scriptTemplate),
      avatar_id: req.body.avatar_id ?? null,
      status: 'pending',
      created_at: Date.now(),
      track_id: trackId,
    };

    await pool.query(
      `INSERT INTO publish_queue (id,channel,platform,topic,script,script_hash,avatar_id,status,created_at,track_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [item.id, item.channel, item.platform, item.topic, item.script, item.script_hash,
       item.avatar_id, item.status, item.created_at, item.track_id]
    );

    res.json({ ok: true, item, avatar_ids_to_avoid: usedAvatarIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// App polls this to show pending items
router.get('/vovax/pending', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM publish_queue WHERE channel='vovax' AND status='pending' ORDER BY created_at DESC`
  );
  res.json({ items: rows });
});

// App: approve a pending item
router.post('/vovax/:id/approve', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE publish_queue SET status='approved', decided_at=$1, avatar_id=COALESCE($2, avatar_id)
     WHERE id=$3 AND channel='vovax' AND status='pending' RETURNING *`,
    [Date.now(), req.body.avatar_id ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found or not pending' });
  res.json({ ok: true, item: rows[0] });
});

// App: reject a pending item
router.post('/vovax/:id/reject', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE publish_queue SET status='rejected', decided_at=$1, notes=$2
     WHERE id=$3 AND channel='vovax' AND status='pending' RETURNING *`,
    [Date.now(), req.body.notes ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found or not pending' });
  res.json({ ok: true, item: rows[0] });
});

// Zapier polls this every hour — returns oldest approved item + resolved IDs for HeyGen
// Optional ?platform=instagram|tiktok to filter by platform
router.get('/vovax/next-approved', async (req, res) => {
  const platform = req.query.platform;
  const { rows } = platform
    ? await pool.query(
        `SELECT * FROM publish_queue WHERE channel='vovax' AND status='approved' AND platform=$1 ORDER BY decided_at ASC LIMIT 1`,
        [platform]
      )
    : await pool.query(
        `SELECT * FROM publish_queue WHERE channel='vovax' AND status='approved' ORDER BY decided_at ASC LIMIT 1`
      );

  const item = rows[0] ?? null;
  if (!item) return res.json({ item: null });

  try {
    const picks = await getTopPicks('vovax');
    // Alex may have set a specific avatar_id when approving; fall back to top pick otherwise
    item.resolved_avatar_id = item.avatar_id || picks.avatar_id;
    item.voice_id           = picks.voice_id;
    item.avatar_name        = picks.avatar_name;
    item.voice_name         = picks.voice_name;
  } catch {
    // HeyGen API unavailable — return item without resolved IDs
  }

  res.json({ item });
});

// Zapier calls after successful publish
router.post('/vovax/:id/mark-published', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE publish_queue SET status='published', published_at=$1
     WHERE id=$2 AND channel='vovax' RETURNING *`,
    [Date.now(), req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true, item: rows[0] });
});

// ─── Signal Detected endpoints ────────────────────────────────────────────────

// Zapier calls this on schedule — returns brief + anti-repetition constraints
// Immediately saves to queue for history tracking
router.get('/signal/brief', async (_req, res) => {
  try {
    const platform     = 'instagram'; // default; Zapier can pass ?platform=tiktok
    const usedTopics    = await recentTopics('signal', 3);
    const usedAvatarIds = await recentAvatarIds('signal', 5);
    const topic  = pickTopic(SIGNAL_TOPICS, usedTopics);
    const script = pickFrom(SIGNAL_SCRIPTS[topic] ?? SIGNAL_SCRIPTS.discovery);

    // Sanity guard: script must never contain "VOVAX" or known handles
    if (/vovax/i.test(script)) {
      return res.status(500).json({ error: 'script_contains_vovax — content library error' });
    }

    // Try track-aware Claude generation
    let trackId = null;
    let finalScript = script; // default: hardcoded
    const track = await pickUnusedTrack();
    if (track) {
      const claudeScript = await generateScript('signal', track, topic);
      if (claudeScript && !/vovax/i.test(claudeScript)) {
        finalScript = claudeScript;
        trackId     = track.id;
      }
    }

    // VOVAX guard on final script (hardcoded or Claude-generated)
    if (/vovax/i.test(finalScript)) {
      return res.status(500).json({ error: 'script_contains_vovax — content library error' });
    }

    const id  = uid();
    const now = Date.now();
    await pool.query(
      `INSERT INTO publish_queue (id,channel,platform,topic,script,script_hash,status,created_at,track_id)
       VALUES ($1,'signal',$2,$3,$4,$5,'pending',$6,$7)`,
      [id, platform, topic, finalScript, scriptHash(finalScript), now, trackId]
    );

    let picks = { avatar_id: null, avatar_name: null, voice_id: null, voice_name: null };
    try { picks = await getTopPicks('signal'); } catch { /* HeyGen API unavailable */ }

    res.json({ id, topic, script: finalScript, avatar_ids_to_avoid: usedAvatarIds, track_id: trackId, ...picks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Zapier calls after successful publish
router.post('/signal/mark-published', async (req, res) => {
  const { id, avatar_id } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  const { rows } = await pool.query(
    `UPDATE publish_queue SET status='published', published_at=$1, avatar_id=$2
     WHERE id=$3 AND channel='signal' RETURNING *`,
    [Date.now(), avatar_id ?? null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true, item: rows[0] });
});

// ─── Top-picks endpoint (debug / manual inspection) ──────────────────────────

router.get('/top-picks', async (req, res) => {
  const persona = req.query.persona === 'signal' ? 'signal' : 'vovax';
  try {
    const picks = await getTopPicks(persona);
    res.json({ persona, ...picks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Shared history endpoint ──────────────────────────────────────────────────

router.get('/history', async (req, res) => {
  const channel = req.query.channel;
  const base = `SELECT * FROM publish_queue`;
  const where = channel ? ` WHERE channel=$1` : '';
  const order = ` ORDER BY created_at DESC LIMIT 50`;
  const { rows } = channel
    ? await pool.query(base + where + order, [channel])
    : await pool.query(base + order);
  res.json({ items: rows });
});

export default router;
