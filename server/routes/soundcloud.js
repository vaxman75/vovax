import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import pool from '../db/index.js';

const router = Router();
const SC_AUTH = 'https://secure.soundcloud.com';
const SC_API  = 'https://api.soundcloud.com';

function redirectUri() {
  const base = process.env.APP_URL ?? 'http://localhost:3000';
  return `${base}/api/soundcloud/auth/callback`;
}

// In-memory PKCE state (short-lived, single-server safe)
let _pkce = null;

// ── Step 1: redirect user to SoundCloud ───────────────────────────────────────
router.get('/auth/start', (_req, res) => {
  const verifier  = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state     = randomBytes(12).toString('hex');
  _pkce = { verifier, state, ts: Date.now() };

  const url = new URL(`${SC_AUTH}/authorize`);
  url.searchParams.set('client_id',             process.env.SOUNDCLOUD_CLIENT_ID);
  url.searchParams.set('redirect_uri',          redirectUri());
  url.searchParams.set('response_type',         'code');
  url.searchParams.set('code_challenge',        challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state',                 state);

  res.redirect(url.toString());
});

// ── Step 2: exchange auth code for tokens ─────────────────────────────────────
router.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`SoundCloud error: ${error} — ${req.query.error_description ?? ''}`);
  }
  if (!_pkce || state !== _pkce.state || Date.now() - _pkce.ts > 300_000) {
    _pkce = null;
    return res.status(400).send('Auth state invalid or expired. Visit /api/soundcloud/auth/start again.');
  }

  const { verifier } = _pkce;
  _pkce = null;

  try {
    const tokenRes = await fetch(`${SC_AUTH}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     process.env.SOUNDCLOUD_CLIENT_ID,
        client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET,
        redirect_uri:  redirectUri(),
        code,
        code_verifier: verifier,
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      return res.status(400).json({ error: 'token_exchange_failed', detail: tokens });
    }

    await pool.query(
      `INSERT INTO tool_settings (tool, settings) VALUES ('soundcloud', $1)
       ON CONFLICT (tool) DO UPDATE SET settings = EXCLUDED.settings`,
      [JSON.stringify({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at:    tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      })]
    );

    res.send(`
      <html><body style="font-family:monospace;background:#0A0A0C;color:#46C7FF;padding:40px;direction:rtl">
        <h2>✓ SoundCloud מחובר</h2>
        <p>Token נשמר ב-DB. אפשר לסגור את הטאב הזה.</p>
        <p><a href="/api/soundcloud/status" style="color:#46C7FF">בדוק סטטוס ←</a></p>
        <p><a href="/api/soundcloud/sync" style="color:#8B8A85;font-size:12px">POST /api/soundcloud/sync — לסנכרן טראקים</a></p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Token helper (with auto-refresh) ─────────────────────────────────────────
export async function getScToken() {
  const { rows } = await pool.query("SELECT settings FROM tool_settings WHERE tool = 'soundcloud'");
  const s = rows[0]?.settings;
  if (!s?.access_token) {
    throw new Error('SoundCloud not authenticated — visit /api/soundcloud/auth/start');
  }

  if (s.expires_at && Date.now() > s.expires_at - 60_000 && s.refresh_token) {
    const r = await fetch(`${SC_AUTH}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     process.env.SOUNDCLOUD_CLIENT_ID,
        client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET,
        refresh_token: s.refresh_token,
      }),
    });
    const tokens = await r.json();
    if (r.ok && tokens.access_token) {
      const updated = {
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token ?? s.refresh_token,
        expires_at:    tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      };
      await pool.query(
        `UPDATE tool_settings SET settings = $1 WHERE tool = 'soundcloud'`,
        [JSON.stringify(updated)]
      );
      return tokens.access_token;
    }
  }

  return s.access_token;
}

// ── Status check ──────────────────────────────────────────────────────────────
router.get('/status', async (_req, res) => {
  try {
    const token = await getScToken();
    const r     = await fetch(`${SC_API}/me`, {
      headers: { Authorization: `OAuth ${token}` },
    });
    const me = await r.json();
    if (!r.ok) return res.json({ connected: false, error: me.error ?? r.status });

    const { rows } = await pool.query('SELECT COUNT(*) FROM tracks');
    res.json({
      connected:   true,
      username:    me.username,
      track_count: me.track_count,
      synced:      parseInt(rows[0].count, 10),
    });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// ── Sync all tracks (POST to avoid accidental triggers) ───────────────────────
router.post('/sync', async (_req, res) => {
  try {
    const token  = await getScToken();
    const limit  = 200;
    let   offset = 0;
    let   synced = 0;

    while (true) {
      const r = await fetch(
        `${SC_API}/me/tracks?limit=${limit}&offset=${offset}&representation=compact`,
        { headers: { Authorization: `OAuth ${token}` } }
      );
      const data = await r.json();
      if (!r.ok) return res.status(400).json({ error: data.error ?? r.status, detail: data });

      const batch = Array.isArray(data) ? data : (data.collection ?? []);
      if (batch.length === 0) break;

      for (const t of batch) {
        await pool.query(
          `INSERT INTO tracks
             (id, title, description, genre, tags, release_date, duration_ms, play_count, permalink_url, synced_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (id) DO UPDATE SET
             title=EXCLUDED.title, description=EXCLUDED.description,
             genre=EXCLUDED.genre, tags=EXCLUDED.tags,
             release_date=EXCLUDED.release_date, duration_ms=EXCLUDED.duration_ms,
             play_count=EXCLUDED.play_count, permalink_url=EXCLUDED.permalink_url,
             synced_at=EXCLUDED.synced_at`,
          [
            t.id, t.title,
            t.description  || null,
            t.genre        || null,
            t.tag_list     || null,
            t.created_at   || null,
            t.duration     ?? null,
            t.playback_count ?? 0,
            t.permalink_url  || null,
            Date.now(),
          ]
        );
        synced++;
      }

      if (batch.length < limit) break;
      offset += limit;
    }

    res.json({ ok: true, synced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
