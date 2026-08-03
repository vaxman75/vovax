import { Router } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// ── Employee registry for chat ────────────────────────────────────────────────

const EMPLOYEES = {
  yuval:  { file: 'yuval-contentcheck.md', label: 'יובל (בדיקת תוכן)' },
  asaf:   { file: 'asaf-manager.md',       label: 'אסף (מנהל פרסום)' },
  tal:    { file: 'tal-script.md',          label: 'טל (תסריט)' },
  adam:   { file: 'adam-cyber.md',          label: 'אדם (אבטחה)' },
  nadav:  { file: 'nadav-monitor.md',       label: 'נדב (ניטור)' },
  shira:  { file: 'shira-manager.md',       label: 'שירה (מותג)' },
};

function loadSkill(filename) {
  try { return readFileSync(join(__dirname, '../employees', filename), 'utf-8'); }
  catch { return null; }
}

// ── Login ─────────────────────────────────────────────────────────────────────

router.post('/login', (req, res) => {
  const { password } = req.body ?? {};
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'wrong password' });
  }
  const token = jwt.sign({ admin: true }, process.env.ADMIN_JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// ── Dashboard data ────────────────────────────────────────────────────────────

router.get('/dashboard', requireAuth, async (_req, res) => {
  try {
    const todayMs = (() => {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();

    const [pendingRes, activityRes, qaRes, signalRes, deploysData] = await Promise.all([
      // VOVAX pending — full data
      pool.query(
        `SELECT pq.*, t.title AS track_title, t.genre AS track_genre
         FROM publish_queue pq
         LEFT JOIN tracks t ON pq.track_id = t.id
         WHERE pq.channel='vovax' AND pq.status='pending'
         ORDER BY pq.created_at ASC`
      ),
      // Activity today by channel/status
      pool.query(
        `SELECT channel, status, COUNT(*)::int AS cnt
         FROM publish_queue WHERE created_at >= $1
         GROUP BY channel, status ORDER BY channel, status`,
        [todayMs]
      ),
      // QA today
      pool.query(
        `SELECT id, channel, topic, script, qa_status, qa_reason, qa_issues, qa_at
         FROM publish_queue WHERE qa_at >= $1 AND qa_status IS NOT NULL
         ORDER BY qa_at DESC LIMIT 20`,
        [todayMs]
      ),
      // Signal recent (last 5, read-only display)
      pool.query(
        `SELECT id, topic, script, status, qa_status, qa_reason, created_at
         FROM publish_queue WHERE channel='signal'
         ORDER BY created_at DESC LIMIT 5`
      ),
      // Railway deploys via Railway GraphQL
      fetchDeploys(),
    ]);

    res.json({
      pending:    pendingRes.rows,
      activity:   activityRes.rows,
      qaToday:    qaRes.rows,
      signal:     signalRes.rows,
      deploys:    deploysData,
      employees:  Object.entries(EMPLOYEES).map(([k, v]) => ({ id: k, label: v.label })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function fetchDeploys() {
  const token     = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  if (!token || !projectId) return [];
  const serviceId = process.env.RAILWAY_SERVICE_ID ?? null;
  const q = serviceId
    ? `query D($p:String!,$s:String!){deployments(input:{projectId:$p,serviceId:$s}){edges{node{status createdAt meta}}}}`
    : `query D($p:String!){deployments(input:{projectId:$p}){edges{node{status createdAt meta}}}}`;
  try {
    const r = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, variables: serviceId ? { p: projectId, s: serviceId } : { p: projectId } }),
    });
    if (!r.ok) return [];
    const data = await r.json();
    if (data.errors?.length) return [];
    const since = Date.now() - 48 * 60 * 60 * 1000;
    return (data?.data?.deployments?.edges ?? [])
      .map((e) => ({ status: e.node.status, createdAt: e.node.createdAt, reason: e.node.meta?.reason ?? null }))
      .filter((d) => new Date(d.createdAt).getTime() > since)
      .slice(0, 6);
  } catch { return []; }
}

// ── Chat ──────────────────────────────────────────────────────────────────────

router.post('/chat', requireAuth, async (req, res) => {
  const { message, employee } = req.body ?? {};
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  // Build read-only DB context
  const context = await buildContext();

  // System prompt: employee skill or generic VOVAX context
  let systemPrompt = `You are a helpful assistant for the VOVAX music project management system.
Answer in Hebrew unless the user writes in English.
You have read-only access to the system state provided below. Never suggest writing to the DB directly.

${context}`;

  if (employee && EMPLOYEES[employee]) {
    const skill = loadSkill(EMPLOYEES[employee].file);
    if (skill) systemPrompt = skill + '\n\n---\nמצב המערכת הנוכחי:\n' + context;
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: message.trim() }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data?.error?.message ?? 'API error' });
    res.json({ response: data.content?.[0]?.text?.trim() ?? '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function buildContext() {
  const todayMs = (() => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();

  const [pendingRes, activityRes, qaRes, tracksRes] = await Promise.all([
    pool.query(
      `SELECT pq.id, pq.topic, pq.script, pq.qa_status, pq.qa_reason, t.title AS track
       FROM publish_queue pq LEFT JOIN tracks t ON pq.track_id = t.id
       WHERE pq.channel='vovax' AND pq.status='pending' ORDER BY pq.created_at ASC LIMIT 10`
    ),
    pool.query(
      `SELECT channel, status, COUNT(*)::int AS cnt FROM publish_queue
       WHERE created_at >= $1 GROUP BY channel, status ORDER BY channel`,
      [todayMs]
    ),
    pool.query(
      `SELECT channel, qa_status, COUNT(*)::int AS cnt FROM publish_queue
       WHERE qa_at >= $1 AND qa_status IS NOT NULL GROUP BY channel, qa_status`,
      [todayMs]
    ),
    pool.query(`SELECT COUNT(*)::int AS cnt FROM tracks`),
  ]);

  const pending = pendingRes.rows;
  const activity = activityRes.rows;
  const qa = qaRes.rows;
  const trackCount = tracksRes.rows[0]?.cnt ?? 0;

  let ctx = `=== מצב VOVAX — ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} ===\n\n`;

  ctx += `טיוטות VOVAX ממתינות לאישור: ${pending.length}\n`;
  for (const p of pending) {
    ctx += `  - [${p.id}] ${p.topic} | QA: ${p.qa_status ?? 'לא רץ'} | "${p.script?.slice(0, 80)}…"\n`;
    if (p.track) ctx += `    טראק: "${p.track}"\n`;
    if (p.qa_reason) ctx += `    סיבת QA: ${p.qa_reason}\n`;
  }

  ctx += `\nפעילות היום:\n`;
  for (const a of activity) {
    ctx += `  ${a.channel} · ${a.status}: ${a.cnt}\n`;
  }

  ctx += `\nQA היום:\n`;
  for (const q of qa) {
    ctx += `  ${q.channel} · ${q.qa_status}: ${q.cnt}\n`;
  }

  ctx += `\nמאגר טראקים: ${trackCount} טראקים ב-DB\n`;
  ctx += `\nBase URL: https://vovax-app-production.up.railway.app\n`;

  return ctx;
}

export default router;
