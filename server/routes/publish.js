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

// ─── VOVAX endpoints ──────────────────────────────────────────────────────────

// Zapier calls this on schedule → creates pending item, waits for manual approval
router.post('/vovax/generate', async (req, res) => {
  try {
    const platform = req.body.platform ?? 'instagram';
    const usedTopics    = await recentTopics('vovax', 3);
    const usedAvatarIds = await recentAvatarIds('vovax', 5);
    const topic = req.body.topic ?? pickTopic(VOVAX_TOPICS, usedTopics);

    let scriptTemplate = pickFrom(VOVAX_SCRIPTS[topic] ?? VOVAX_SCRIPTS.studio_session);

    // Fill gig placeholder if needed
    if (scriptTemplate.includes('{venue}')) {
      const gig = await nextGig();
      if (gig) {
        scriptTemplate = scriptTemplate.replace('{venue}', gig.venue).replace('{date}', gig.date);
      } else {
        // No upcoming gig — fall back to different topic
        const fallback = pickTopic(VOVAX_TOPICS.filter((t) => t !== 'gig_announcement'), usedTopics);
        scriptTemplate = pickFrom(VOVAX_SCRIPTS[fallback]);
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
    };

    await pool.query(
      `INSERT INTO publish_queue (id,channel,platform,topic,script,script_hash,avatar_id,status,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [item.id, item.channel, item.platform, item.topic, item.script, item.script_hash, item.avatar_id, item.status, item.created_at]
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

// Zapier polls this every hour — returns oldest approved item to publish
router.get('/vovax/next-approved', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM publish_queue WHERE channel='vovax' AND status='approved' ORDER BY decided_at ASC LIMIT 1`
  );
  res.json({ item: rows[0] ?? null });
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

    const id   = uid();
    const now  = Date.now();
    await pool.query(
      `INSERT INTO publish_queue (id,channel,platform,topic,script,script_hash,status,created_at)
       VALUES ($1,'signal',$2,$3,$4,$5,'pending',$6)`,
      [id, platform, topic, script, scriptHash(script), now]
    );

    res.json({ id, topic, script, avatar_ids_to_avoid: usedAvatarIds });
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
