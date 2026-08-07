import { Router } from 'express';
import { randomBytes } from 'crypto';

const router = Router();
const GOOGLE_AUTH  = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const DRIVE_API    = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ');

function redirectUri() {
  const base = process.env.APP_URL ?? 'https://vovax-app-production.up.railway.app';
  return `${base}/api/google/auth/callback`;
}

// In-memory CSRF state (short-lived, single-server safe — same pattern as soundcloud.js)
let _state = null;

// ── Step 1: redirect user to Google consent screen ────────────────────────────
router.get('/auth/start', (_req, res) => {
  const state = randomBytes(12).toString('hex');
  _state = { state, ts: Date.now() };

  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set('client_id',     process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri',  redirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope',         SCOPES);
  url.searchParams.set('access_type',   'offline');
  url.searchParams.set('prompt',        'consent'); // force refresh_token issuance even on repeat consent
  url.searchParams.set('state',         state);

  res.redirect(url.toString());
});

// ── Step 2: exchange auth code for tokens ─────────────────────────────────────
router.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`Google error: ${error} — ${req.query.error_description ?? ''}`);
  }
  if (!_state || state !== _state.state || Date.now() - _state.ts > 300_000) {
    _state = null;
    return res.status(400).send('Auth state invalid or expired. Visit /api/google/auth/start again.');
  }
  _state = null;

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri(),
        code,
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      return res.status(400).json({ error: 'token_exchange_failed', detail: tokens });
    }

    if (!tokens.refresh_token) {
      return res.status(400).send(`
        <html><body style="font-family:monospace;background:#0A0A0C;color:#FFB347;padding:40px;direction:rtl">
          <h2>⚠ לא התקבל refresh_token</h2>
          <p>Google לא מחזיר refresh_token אם כבר אישרת גישה לאפליקציה הזו בעבר בלי לבטל אותה.</p>
          <p>לתקן: היכנס ל-<a href="https://myaccount.google.com/permissions" style="color:#46C7FF">myaccount.google.com/permissions</a>,
          הסר את הגישה של האפליקציה, ואז נסה שוב מ-<a href="/api/google/auth/start" style="color:#46C7FF">/api/google/auth/start</a>.</p>
        </body></html>
      `);
    }

    // Deliberately NOT logged anywhere (console/Sentry) — sensitive, one-time display only.
    res.send(`
      <html><body style="font-family:monospace;background:#0A0A0C;color:#46C7FF;padding:40px;direction:rtl;max-width:700px">
        <h2>✓ Google מחובר</h2>
        <p style="color:#F2F1ED">העתק את הערך הזה ושלח אותו בצ'אט כדי שאשמור אותו כ-GOOGLE_REFRESH_TOKEN ב-Railway:</p>
        <div style="background:#131316;border:1px solid #232326;border-radius:8px;padding:16px;word-break:break-all;color:#22C55E;font-size:13px;user-select:all">
          ${tokens.refresh_token}
        </div>
        <p style="color:#8B8A85;font-size:12px;margin-top:16px">⚠ זה סוד — אל תשתף אותו חוץ מהעברה הזו. אחרי ששמרתי אותו כמשתנה סביבה, אפשר למחוק את ההודעה.</p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Access token helper (in-memory cache, refreshed from env var refresh_token) ──
let _accessTokenCache = null; // { token, expiresAt }

export async function getGoogleAccessToken() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('GOOGLE_REFRESH_TOKEN not set — visit /api/google/auth/start to connect');
  }

  if (_accessTokenCache && Date.now() < _accessTokenCache.expiresAt - 60_000) {
    return _accessTokenCache.token;
  }

  const r = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  const tokens = await r.json();
  if (!r.ok || !tokens.access_token) {
    throw new Error(`Google token refresh failed: ${tokens.error ?? r.status} — ${tokens.error_description ?? ''}`);
  }

  _accessTokenCache = {
    token:     tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
  };
  return tokens.access_token;
}

// ── Status check ──────────────────────────────────────────────────────────────
router.get('/status', async (_req, res) => {
  try {
    const token = await getGoogleAccessToken();
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await r.json();
    if (!r.ok) return res.json({ connected: false, error: me.error ?? r.status });
    res.json({ connected: true, email: me.email });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// ── Drive: find-or-create the mastering uploads folder ────────────────────────
const MASTERING_FOLDER_NAME = 'VOVAX-Mastering-Uploads';
let _folderIdCache = null;

export async function getOrCreateMasteringFolder() {
  if (_folderIdCache) return _folderIdCache;

  const token = await getGoogleAccessToken();
  const q = encodeURIComponent(
    `name='${MASTERING_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const listRes = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listData = await listRes.json();
  if (!listRes.ok) throw new Error(`Drive folder lookup failed: ${JSON.stringify(listData)}`);

  if (listData.files?.length) {
    _folderIdCache = listData.files[0].id;
    return _folderIdCache;
  }

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: MASTERING_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(`Drive folder create failed: ${JSON.stringify(createData)}`);

  _folderIdCache = createData.id;
  return _folderIdCache;
}

// ── Drive: upload a file buffer into the mastering folder ─────────────────────
export async function uploadToMasteringFolder(buffer, filename, mimeType) {
  const token    = await getGoogleAccessToken();
  const folderId = await getOrCreateMasteringFolder();

  const boundary = `vovax-${randomBytes(8).toString('hex')}`;
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });

  const bodyParts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  ];
  const closing = `\r\n--${boundary}--`;

  const body = Buffer.concat([
    Buffer.from(bodyParts[0], 'utf-8'),
    Buffer.from(bodyParts[1], 'utf-8'),
    buffer,
    Buffer.from(closing, 'utf-8'),
  ]);

  const uploadRes = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const data = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(`Drive upload failed: ${JSON.stringify(data)}`);

  return { id: data.id, link: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view` };
}

export default router;
