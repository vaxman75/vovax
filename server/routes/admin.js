import { Router } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// ── Employee registry ─────────────────────────────────────────────────────────

const ALL_EMPLOYEES = [
  // Music Creation
  { id: 'amit',   name: 'עמית',  role: 'מנהל יצירת מוזיקה', dept: 'music',        manager: null },
  { id: 'ben',    name: 'בן',    role: 'ACE-Step Operator',   dept: 'music',        manager: 'amit', skillFile: null },
  { id: 'michal', name: 'מיכל', role: 'Moises',              dept: 'music',        manager: 'amit' },
  { id: 'mor',    name: 'מור',   role: 'Suno',                dept: 'music',        manager: 'amit' },
  { id: 'talia',  name: 'טליה',  role: 'QA מוזיקה',          dept: 'music',        manager: 'amit' },
  { id: 'elad',   name: 'אלעד', role: 'מנהל מוזיקה',         dept: 'music',        manager: 'amit' },
  { id: 'tom',    name: 'תום',   role: 'Studio One Lead',     dept: 'music',        manager: 'elad' },
  { id: 'liam',   name: 'ליאם',  role: 'Studio One',          dept: 'music',        manager: 'tom' },
  { id: 'ido',    name: 'עידו',  role: 'Studio One',          dept: 'music',        manager: 'tom' },
  { id: 'yoni',   name: 'יוני',  role: 'Cubase Lead',         dept: 'music',        manager: 'elad' },
  { id: 'or',     name: 'אור',   role: 'Cubase',              dept: 'music',        manager: 'yoni' },
  { id: 'shai',   name: 'שי',    role: 'Cubase',              dept: 'music',        manager: 'yoni' },
  // Art & Visual
  { id: 'daniel', name: 'דניאל', role: 'מנהל אמנות וויזואל', dept: 'art',          manager: null },
  { id: 'eden',   name: 'עדן',   role: 'Video Art Lead',      dept: 'art',          manager: 'daniel' },
  { id: 'lia',    name: 'ליה',   role: 'Full Clips',          dept: 'art',          manager: 'eden' },
  { id: 'maor',   name: 'מאור',  role: 'Short Clips',         dept: 'art',          manager: 'eden' },
  { id: 'noga',   name: 'נגה',   role: 'Cover Art',           dept: 'art',          manager: 'daniel' },
  { id: 'ela',    name: 'אלה',   role: 'Avatar Casting',      dept: 'art',          manager: 'daniel' },
  // Automated Publishing
  { id: 'asaf',   name: 'אסף',   role: 'מנהל פרסום אוטומטי', dept: 'publishing',   manager: null,    skillFile: 'asaf-manager.md' },
  { id: 'tal',    name: 'טל',    role: 'כתיבת תסריט',        dept: 'publishing',   manager: 'asaf',  skillFile: 'tal-script.md' },
  { id: 'adi',    name: 'עדי',   role: 'HeyGen',              dept: 'publishing',   manager: 'asaf' },
  { id: 'yaara',  name: 'יערה',  role: 'Buffer',              dept: 'publishing',   manager: 'asaf' },
  { id: 'bar',    name: 'בר',    role: 'Publisher',           dept: 'publishing',   manager: 'asaf' },
  { id: 'nadav',  name: 'נדב',   role: 'Monitor',             dept: 'publishing',   manager: 'asaf',  skillFile: 'nadav-monitor.md' },
  // Brand & Voice
  { id: 'shira',  name: 'שירה',  role: 'מנהלת מותג וקול',    dept: 'brand',        manager: null,    skillFile: 'shira-manager.md' },
  { id: 'gal',    name: 'גל',    role: 'Voice Guide',         dept: 'brand',        manager: 'shira' },
  { id: 'yuval',  name: 'יובל',  role: 'Content Check / QA',  dept: 'brand',        manager: 'shira', skillFile: 'yuval-contentcheck.md' },
  // Distribution
  { id: 'uri',    name: 'אורי',  role: 'מנהל הפצה',          dept: 'distribution', manager: null },
  { id: 'lior',   name: 'ליאור', role: 'Spotify',             dept: 'distribution', manager: 'uri' },
  { id: 'omer',   name: 'עומר',  role: 'SoundCloud',          dept: 'distribution', manager: 'uri' },
  { id: 'rotem',  name: 'רותם',  role: 'YouTube',             dept: 'distribution', manager: 'uri' },
  // Production
  { id: 'omri',   name: 'עמרי',  role: 'מנהל הפקה',          dept: 'production',   manager: null },
  { id: 'noy',    name: 'נוי',   role: 'Edit & Mix',          dept: 'production',   manager: 'omri' },
  { id: 'ziv',    name: 'זיו',   role: 'Mastering',           dept: 'production',   manager: 'omri' },
  // Sales & Labels
  { id: 'raz',    name: 'רז',    role: 'מנהל מכירות ולייבלים', dept: 'sales',       manager: null },
  { id: 'eitan',  name: 'איתן',  role: 'Labels Outreach',     dept: 'sales',        manager: 'raz' },
  { id: 'karen',  name: 'קרן',   role: 'Booking Quotes',      dept: 'sales',        manager: 'raz' },
  // AVOVAX Label
  { id: 'roni',   name: 'רוני',  role: 'מנהלת AVOVAX Label', dept: 'avovax',       manager: null },
  { id: 'shani',  name: 'שני',   role: 'GURI Project',        dept: 'avovax',       manager: 'roni' },
  // Website
  { id: 'dana',   name: 'דנה',   role: 'vovaxmusic.com',      dept: 'website',      manager: null },
  // Engineering
  { id: 'ariel',  name: 'אריאל', role: 'מנהל הנדסה',         dept: 'engineering',  manager: null, skillFile: 'ariel-engineering.md' },
  { id: 'noam',   name: 'נועם',  role: 'Permissions',         dept: 'engineering',  manager: 'ariel' },
  { id: 'ran',    name: 'רן',    role: 'Implementation',      dept: 'engineering',  manager: 'ariel' },
  { id: 'shaked', name: 'שקד',   role: 'Hebrew & RTL',        dept: 'engineering',  manager: 'ariel' },
  { id: 'roei',   name: 'רועי',  role: 'Skills',              dept: 'engineering',  manager: 'ariel' },
  // Cybersecurity
  { id: 'adam',   name: 'אדם',   role: 'Cybersecurity',       dept: 'cyber',        manager: null,    skillFile: 'adam-cyber.md' },
  // Finance
  { id: 'neta',   name: 'נטע',   role: 'Finance',             dept: 'finance',      manager: null },
  // Personal Core
  { id: 'eidan',  name: 'עידן',  role: 'מנהל ליבה אישית',    dept: 'personal',     manager: null },
  { id: 'ron',    name: 'רון',   role: 'Briefing',            dept: 'personal',     manager: 'eidan' },
  { id: 'noa',    name: 'נועה',  role: 'Tasks',               dept: 'personal',     manager: 'eidan' },
  { id: 'maya',   name: 'מאיה',  role: 'Email',               dept: 'personal',     manager: 'eidan' },
  { id: 'tomer',  name: 'תומר',  role: 'Calendar',            dept: 'personal',     manager: 'eidan' },
  { id: 'matan',  name: 'מתן',   role: 'Performances',        dept: 'personal',     manager: 'eidan' },
  { id: 'hadar',  name: 'הדר',   role: 'Fanmail',             dept: 'personal',     manager: 'eidan' },
  // Vovax Core
  { id: 'alon',   name: 'אלון',  role: 'Board Secretary',     dept: 'core',         manager: null },
  { id: 'aviv',   name: 'אביב',  role: 'Ops Coordinator',     dept: 'core',         manager: null },
];

const DEPT_META = {
  music:        { label: 'יצירת מוזיקה',      icon: '🎵', hasData: false },
  art:          { label: 'אמנות וויזואל',     icon: '🎨', hasData: false },
  publishing:   { label: 'פרסום אוטומטי',     icon: '📢', hasData: true  },
  brand:        { label: 'מותג וקול',         icon: '🔊', hasData: true  },
  distribution: { label: 'הפצה',              icon: '📡', hasData: true  },
  production:   { label: 'הפקה',              icon: '🎛️', hasData: false },
  sales:        { label: 'מכירות ולייבלים',   icon: '💼', hasData: false },
  avovax:       { label: 'AVOVAX Label',       icon: '🏷️', hasData: false },
  website:      { label: 'אתר',               icon: '🌐', hasData: false },
  engineering:  { label: 'הנדסה',             icon: '⚙️', hasData: false },
  cyber:        { label: 'סייבר',             icon: '🔒', hasData: false },
  finance:      { label: 'כספים',             icon: '💰', hasData: false },
  personal:     { label: 'ליבה אישית',        icon: '👤', hasData: false },
  core:         { label: 'VOVAX Core',         icon: '⭐', hasData: false },
};

function loadSkill(filename) {
  if (!filename) return null;
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

// ── Dashboard (overview) ──────────────────────────────────────────────────────

router.get('/dashboard', requireAuth, async (_req, res) => {
  try {
    const todayMs = todayStartMs();
    const [pendingRes, activityRes, qaRes, signalRes, deploysData, tracksRes] = await Promise.all([
      pool.query(
        `SELECT pq.*, t.title AS track_title, t.genre AS track_genre
         FROM publish_queue pq LEFT JOIN tracks t ON pq.track_id = t.id
         WHERE pq.channel='vovax' AND pq.status='pending'
         ORDER BY pq.created_at ASC`
      ),
      pool.query(
        `SELECT channel, status, COUNT(*)::int AS cnt
         FROM publish_queue WHERE created_at >= $1
         GROUP BY channel, status ORDER BY channel, status`,
        [todayMs]
      ),
      pool.query(
        `SELECT id, channel, topic, script, qa_status, qa_reason, qa_issues, qa_at
         FROM publish_queue WHERE qa_at >= $1 AND qa_status IS NOT NULL
         ORDER BY qa_at DESC LIMIT 20`,
        [todayMs]
      ),
      pool.query(
        `SELECT id, topic, script, status, qa_status, qa_reason, created_at
         FROM publish_queue WHERE channel='signal'
         ORDER BY created_at DESC LIMIT 5`
      ),
      fetchDeploys(),
      pool.query(`SELECT COUNT(*)::int AS cnt FROM tracks`),
    ]);

    // pending count for signal too (for badge)
    const signalPendingRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM publish_queue WHERE channel='signal' AND status='pending'`
    );

    res.json({
      pending:         pendingRes.rows,
      pendingSignal:   signalPendingRes.rows[0]?.cnt ?? 0,
      activity:        activityRes.rows,
      qaToday:         qaRes.rows,
      signal:          signalRes.rows,
      deploys:         deploysData,
      trackCount:      tracksRes.rows[0]?.cnt ?? 0,
      deptMeta:        DEPT_META,
      employees:       ALL_EMPLOYEES,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Department data ───────────────────────────────────────────────────────────

router.get('/dept/:name', requireAuth, async (req, res) => {
  const { name } = req.params;
  const employees = ALL_EMPLOYEES.filter(e => e.dept === name);

  try {
    let extra = {};

    if (name === 'publishing') {
      const [vovaxRes, signalRes] = await Promise.all([
        pool.query(
          `SELECT pq.*, t.title AS track_title, t.genre AS track_genre
           FROM publish_queue pq LEFT JOIN tracks t ON pq.track_id = t.id
           WHERE pq.channel='vovax'
           ORDER BY CASE pq.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                    pq.created_at DESC
           LIMIT 30`
        ),
        pool.query(
          `SELECT * FROM publish_queue WHERE channel='signal'
           ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                    created_at DESC
           LIMIT 20`
        ),
      ]);
      extra = { vovax: vovaxRes.rows, signal: signalRes.rows };
    }

    if (name === 'brand') {
      const qaRes = await pool.query(
        `SELECT id, channel, topic, script, qa_status, qa_reason, qa_issues, qa_at, qa_employee
         FROM publish_queue WHERE qa_status IS NOT NULL
         ORDER BY qa_at DESC LIMIT 40`
      );
      extra = { qa: qaRes.rows };
    }

    if (name === 'distribution') {
      const tracksRes = await pool.query(
        `SELECT id, title, genre, synced_at FROM tracks ORDER BY synced_at DESC LIMIT 30`
      );
      extra = { tracks: tracksRes.rows };
    }

    if (name === 'music') {
      const [tracksRes, pubRes] = await Promise.all([
        pool.query(`SELECT id, title, genre, synced_at FROM tracks ORDER BY synced_at DESC LIMIT 20`),
        pool.query(
          `SELECT pq.id, pq.topic, pq.script, pq.status, pq.qa_status, pq.created_at,
                  t.title AS track_title
           FROM publish_queue pq LEFT JOIN tracks t ON pq.track_id = t.id
           WHERE pq.channel='vovax'
           ORDER BY pq.created_at DESC LIMIT 10`
        ),
      ]);
      extra = { tracks: tracksRes.rows, recent: pubRes.rows };
    }

    res.json({ employees, ...extra });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Chat ──────────────────────────────────────────────────────────────────────

router.post('/chat', requireAuth, async (req, res) => {
  const { message, employeeId } = req.body ?? {};
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const context = await buildContext();

  let systemPrompt = `You are a helpful assistant for the VOVAX music project management system.
Answer in Hebrew unless the user writes in English.
You have read-only access to the system state provided below. Never suggest writing to the DB directly.

${context}`;

  if (employeeId) {
    const emp = ALL_EMPLOYEES.find(e => e.id === employeeId);
    if (emp?.skillFile) {
      const skill = loadSkill(emp.skillFile);
      if (skill) systemPrompt = skill + '\n\n---\nמצב המערכת הנוכחי:\n' + context;
    }
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStartMs() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

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
      .map(e => ({ status: e.node.status, createdAt: e.node.createdAt, reason: e.node.meta?.reason ?? null }))
      .filter(d => new Date(d.createdAt).getTime() > since)
      .slice(0, 6);
  } catch { return []; }
}

async function buildContext() {
  const todayMs = todayStartMs();
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

  let ctx = `=== מצב VOVAX — ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} ===\n\n`;
  ctx += `טיוטות VOVAX ממתינות לאישור: ${pendingRes.rows.length}\n`;
  for (const p of pendingRes.rows) {
    ctx += `  - [${p.id}] ${p.topic} | QA: ${p.qa_status ?? 'לא רץ'} | "${p.script?.slice(0, 80)}…"\n`;
    if (p.track) ctx += `    טראק: "${p.track}"\n`;
    if (p.qa_reason) ctx += `    סיבת QA: ${p.qa_reason}\n`;
  }
  ctx += `\nפעילות היום:\n`;
  for (const a of activityRes.rows) ctx += `  ${a.channel} · ${a.status}: ${a.cnt}\n`;
  ctx += `\nQA היום:\n`;
  for (const q of qaRes.rows) ctx += `  ${q.channel} · ${q.qa_status}: ${q.cnt}\n`;
  ctx += `\nמאגר טראקים: ${tracksRes.rows[0]?.cnt ?? 0} טראקים ב-DB\n`;
  ctx += `\nBase URL: https://vovax-app-production.up.railway.app\n`;
  return ctx;
}

export default router;
