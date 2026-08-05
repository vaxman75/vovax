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
  { id: 'amit',   name: 'עמית',  role: 'מנהל יצירת מוזיקה', dept: 'music',        manager: null,    skillFile: 'amit-creation.md' },
  { id: 'ben',    name: 'בן',    role: 'ACE-Step Operator',   dept: 'music',        manager: 'amit',  skillFile: 'ben-acestep.md' },
  { id: 'michal', name: 'מיכל', role: 'Moises',              dept: 'music',        manager: 'amit',  skillFile: 'michal-moises.md' },
  { id: 'mor',    name: 'מור',   role: 'Suno',                dept: 'music',        manager: 'amit',  skillFile: 'mor-suno.md' },
  { id: 'talia',  name: 'טליה',  role: 'QA מוזיקה',          dept: 'music',        manager: 'amit',  skillFile: 'talia-creationqa.md' },
  { id: 'elad',   name: 'אלעד', role: 'מנהל מוזיקה',         dept: 'music',        manager: 'amit',  skillFile: 'elad-musicdirector.md' },
  { id: 'tom',    name: 'תום',   role: 'Studio One Lead',     dept: 'music',        manager: 'elad',  skillFile: 'tom-studioone.md' },
  { id: 'liam',   name: 'ליאם',  role: 'Studio One',          dept: 'music',        manager: 'tom',   skillFile: 'liam-musician-s1.md',    refs: ['omri-production/references/studio-plugins.md'] },
  { id: 'ido',    name: 'עידו',  role: 'Studio One',          dept: 'music',        manager: 'tom',   skillFile: 'ido-dj-s1.md' },
  { id: 'yoni',   name: 'יוני',  role: 'Cubase Lead',         dept: 'music',        manager: 'elad',  skillFile: 'yoni-cubase.md' },
  { id: 'or',     name: 'אור',   role: 'Cubase',              dept: 'music',        manager: 'yoni',  skillFile: 'or-musician-cubase.md',  refs: ['omri-production/references/studio-plugins.md'] },
  { id: 'shai',   name: 'שי',    role: 'Cubase',              dept: 'music',        manager: 'yoni',  skillFile: 'shai-dj-cubase.md' },
  // Art & Visual
  { id: 'daniel', name: 'דניאל', role: 'מנהל אמנות וויזואל', dept: 'art',          manager: null,    skillFile: 'daniel-creators.md' },
  { id: 'eden',   name: 'עדן',   role: 'Video Art Lead',      dept: 'art',          manager: 'daniel', skillFile: 'eden-videoart.md' },
  { id: 'lia',    name: 'ליה',   role: 'Full Clips',          dept: 'art',          manager: 'eden',  skillFile: 'lia-musicvideo.md' },
  { id: 'maor',   name: 'מאור',  role: 'Short Clips',         dept: 'art',          manager: 'eden',  skillFile: 'maor-shortclips.md' },
  { id: 'noga',   name: 'נגה',   role: 'Cover Art',           dept: 'art',          manager: 'daniel', skillFile: 'noga-coverart.md' },
  { id: 'ela',    name: 'אלה',   role: 'Avatar Casting',      dept: 'art',          manager: 'daniel', skillFile: 'ella-castingvoice.md' },
  // Automated Publishing
  { id: 'asaf',   name: 'אסף',   role: 'מנהל פרסום אוטומטי', dept: 'publishing',   manager: null,    skillFile: 'asaf-manager.md' },
  { id: 'tal',    name: 'טל',    role: 'כתיבת תסריט',        dept: 'publishing',   manager: 'asaf',  skillFile: 'tal-script.md' },
  { id: 'adi',    name: 'עדי',   role: 'HeyGen',              dept: 'publishing',   manager: 'asaf',  skillFile: 'adi-video.md' },
  { id: 'yaara',  name: 'יערה',  role: 'Buffer',              dept: 'publishing',   manager: 'asaf',  skillFile: 'yeara-scheduler.md' },
  { id: 'bar',    name: 'בר',    role: 'Publisher',           dept: 'publishing',   manager: 'asaf',  skillFile: 'bar-publisher.md' },
  { id: 'nadav',  name: 'נדב',   role: 'Monitor',             dept: 'publishing',   manager: 'asaf',  skillFile: 'nadav-monitor.md' },
  // Brand & Voice
  { id: 'shira',  name: 'שירה',  role: 'מנהלת מותג וקול',    dept: 'brand',        manager: null,    skillFile: 'shira-manager.md' },
  { id: 'gal',    name: 'גל',    role: 'Voice Guide',         dept: 'brand',        manager: 'shira', skillFile: 'gal-voiceguide.md',    refs: ['references/voice-guide.md'] },
  { id: 'yuval',  name: 'יובל',  role: 'Content Check / QA',  dept: 'brand',        manager: 'shira', skillFile: 'yuval-contentcheck.md', refs: ['references/voice-guide.md'] },
  // Distribution
  { id: 'uri',    name: 'אורי',  role: 'מנהל הפצה',          dept: 'distribution', manager: null,    skillFile: 'ori-distribution.md' },
  { id: 'lior',   name: 'ליאור', role: 'Spotify',             dept: 'distribution', manager: 'uri',   skillFile: 'lior-spotify.md' },
  { id: 'omer',   name: 'עומר',  role: 'SoundCloud',          dept: 'distribution', manager: 'uri',   skillFile: 'omer-soundcloud.md' },
  { id: 'rotem',  name: 'רותם',  role: 'YouTube',             dept: 'distribution', manager: 'uri',   skillFile: 'rotem-youtube.md' },
  // Production
  { id: 'omri',   name: 'עמרי',  role: 'מנהל הפקה',          dept: 'production',   manager: null,    skillFile: 'omri-production.md' },
  { id: 'noy',    name: 'נוי',   role: 'Edit & Mix',          dept: 'production',   manager: 'omri',  skillFile: 'noy-editmix.md' },
  { id: 'ziv',    name: 'זיב',   role: 'Mastering',           dept: 'production',   manager: 'omri',  skillFile: 'ziv-mastering.md' },
  // Sales & Labels
  { id: 'raz',    name: 'רז',    role: 'מנהל מכירות ולייבלים', dept: 'sales',      manager: null,    skillFile: 'raz-sales.md' },
  { id: 'eitan',  name: 'איתן',  role: 'Labels Outreach',     dept: 'sales',        manager: 'raz',   skillFile: 'eitan-labels.md' },
  { id: 'karen',  name: 'קרן',   role: 'Booking Quotes',      dept: 'sales',        manager: 'raz',   skillFile: 'keren-booking.md' },
  // AVOVAX Label
  { id: 'roni',   name: 'רוני',  role: 'מנהלת AVOVAX Label', dept: 'avovax',       manager: null,    skillFile: 'roni-label.md' },
  { id: 'shani',  name: 'שני',   role: 'GURI Project',        dept: 'avovax',       manager: 'roni',  skillFile: 'shani-guriproject.md' },
  // Website
  { id: 'dana',   name: 'דנה',   role: 'vovaxmusic.com',      dept: 'website',      manager: null,    skillFile: 'dana-website.md' },
  // Engineering
  { id: 'ariel',  name: 'אריאל', role: 'מנהל הנדסה',         dept: 'engineering',  manager: null,    skillFile: 'ariel-engineering.md' },
  { id: 'noam',   name: 'נועם',  role: 'Permissions',         dept: 'engineering',  manager: 'ariel', skillFile: 'noam-permissions.md' },
  { id: 'ran',    name: 'רן',    role: 'Implementation',      dept: 'engineering',  manager: 'ariel', skillFile: 'ran-implementation.md' },
  { id: 'shaked', name: 'שקד',   role: 'Hebrew & RTL',        dept: 'engineering',  manager: 'ariel', skillFile: 'shaked-hebrew.md' },
  { id: 'roei',   name: 'רועי',  role: 'Skills',              dept: 'engineering',  manager: 'ariel',  skillFile: 'roei-skills.md' },
  // Cybersecurity
  { id: 'adam',   name: 'אדם',   role: 'Cybersecurity',       dept: 'cyber',        manager: null,    skillFile: 'adam-cyber.md' },
  // Finance
  { id: 'neta',   name: 'נטע',   role: 'Finance',             dept: 'finance',      manager: null,    skillFile: 'neta-finance.md' },
  // Personal Core
  { id: 'eidan',  name: 'עידן',  role: 'מנהל ליבה אישית',    dept: 'personal',     manager: null,    skillFile: 'idan-manager.md' },
  { id: 'ron',    name: 'רון',   role: 'Briefing',            dept: 'personal',     manager: 'eidan', skillFile: 'ron-briefing.md' },
  { id: 'noa',    name: 'נועה',  role: 'Tasks',               dept: 'personal',     manager: 'eidan', skillFile: 'noa-tasks.md' },
  { id: 'maya',   name: 'מאיה',  role: 'Email',               dept: 'personal',     manager: 'eidan', skillFile: 'maya-email.md' },
  { id: 'tomer',  name: 'תומר',  role: 'Calendar',            dept: 'personal',     manager: 'eidan', skillFile: 'tomer-calendar.md' },
  { id: 'matan',  name: 'מתן',   role: 'Performances',        dept: 'personal',     manager: 'eidan', skillFile: 'matan-assistant.md' },
  { id: 'hadar',  name: 'הדר',   role: 'Fanmail',             dept: 'personal',     manager: 'eidan', skillFile: 'hadar-fanmail.md' },
  // Recruiting & Talent
  { id: 'einav',  name: 'עינב',  role: 'ראש גיוס וכישרונות', dept: 'recruiting',   manager: null, skillFile: 'einav-recruiting.md' },
  // Vovax Core
  { id: 'alon',   name: 'אלון',  role: 'Board Secretary',     dept: 'core',         manager: null,     skillFile: 'alon-board.md' },
  { id: 'aviv',   name: 'אביב',  role: 'Ops Coordinator',     dept: 'core',         manager: null,    skillFile: 'aviv-opscoord.md' },
];

const DEPT_META = {
  music:        { label: 'יצירת מוזיקה',      icon: '🎵', hasData: false },
  art:          { label: 'ART',               icon: '🎨', hasData: true  },
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
  recruiting:   { label: 'גיוס וכישרונות',    icon: '🤝', hasData: false },
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
           WHERE pq.channel='vovax' AND pq.status IN ('pending','rendering','approved')
           ORDER BY CASE pq.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                    pq.created_at DESC
           LIMIT 30`
        ),
        pool.query(
          `SELECT * FROM publish_queue WHERE channel='signal' AND status='pending'
           ORDER BY created_at DESC
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
      const [tracksRes, pubRes, mqRes] = await Promise.all([
        pool.query(`SELECT id, title, genre, synced_at FROM tracks ORDER BY synced_at DESC LIMIT 20`),
        pool.query(
          `SELECT pq.id, pq.topic, pq.script, pq.status, pq.qa_status, pq.created_at,
                  t.title AS track_title
           FROM publish_queue pq LEFT JOIN tracks t ON pq.track_id = t.id
           WHERE pq.channel='vovax'
           ORDER BY pq.created_at DESC LIMIT 10`
        ),
        pool.query(`SELECT * FROM music_queue ORDER BY created_at DESC LIMIT 30`).catch(() => ({ rows: [] })),
      ]);
      extra = { tracks: tracksRes.rows, recent: pubRes.rows, musicQueue: mqRes.rows };
    }

    if (name === 'sales') {
      const [gigsRes, topTracksRes, pubStatsRes] = await Promise.all([
        pool.query(`SELECT * FROM gigs ORDER BY date ASC`),
        pool.query(`SELECT id, title, genre, play_count, permalink_url, duration_ms
                    FROM tracks ORDER BY play_count DESC LIMIT 15`),
        pool.query(`SELECT
                      COUNT(*) FILTER (WHERE status='published')::int AS published,
                      COUNT(*) FILTER (WHERE status='published' AND created_at > $1)::int AS published_30d
                    FROM publish_queue`,
          [Date.now() - 30 * 24 * 3600000]),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const gigs  = gigsRes.rows.map(r => {
        let meta = {};
        try { if (r.notes?.startsWith('{')) meta = JSON.parse(r.notes); } catch {}
        return { id: r.id, date: r.date, venue: r.venue, city: r.city ?? '', ...meta };
      });
      const fmtDur = ms => ms ? `${Math.floor(ms/60000)}:${String(Math.floor((ms%60000)/1000)).padStart(2,'0')}` : null;
      const topTracks = topTracksRes.rows.map(r => ({ ...r, durationFmt: fmtDur(r.duration_ms) }));

      extra = {
        gigsUpcoming: gigs.filter(g => g.date >= today),
        gigsPast:     gigs.filter(g => g.date < today),
        topTracks,
        pubStats: pubStatsRes.rows[0] ?? { published: 0, published_30d: 0 },
      };
    }

    if (name === 'art') {
      const [videosRes, statsRes] = await Promise.all([
        pool.query(
          `SELECT id, topic, script, video_url, avatar_gender, qa_status, created_at, status
           FROM publish_queue
           WHERE video_url IS NOT NULL
           ORDER BY created_at DESC LIMIT 20`
        ),
        pool.query(
          `SELECT
             COUNT(*)::int AS total_renders,
             COUNT(*) FILTER (WHERE status='published')::int AS published,
             COUNT(*) FILTER (WHERE created_at > $1)::int AS this_month
           FROM publish_queue WHERE heygen_video_id IS NOT NULL`,
          [Date.now() - 30 * 24 * 3600000]
        ),
      ]);
      extra = { videos: videosRes.rows, stats: statsRes.rows[0] ?? { total_renders: 0, published: 0, this_month: 0 } };
    }

    if (name === 'finance') {
      const [gigsRes, musicStatsRes, renderStatsRes] = await Promise.all([
        pool.query(`SELECT id, date, venue, city, notes FROM gigs ORDER BY date DESC LIMIT 30`),
        pool.query(`SELECT COUNT(*)::int AS total,
                          COUNT(*) FILTER (WHERE status NOT IN ('failed')) AS succeeded,
                          COUNT(*) FILTER (WHERE created_at > $1) AS this_month
                   FROM music_queue`,
          [Date.now() - 30 * 24 * 3600000]).catch(() => ({ rows: [{ total: 0, succeeded: 0, this_month: 0 }] })),
        pool.query(`SELECT COUNT(*)::int AS total,
                          COUNT(*) FILTER (WHERE created_at > $1) AS this_month
                   FROM publish_queue WHERE heygen_video_id IS NOT NULL`,
          [Date.now() - 30 * 24 * 3600000]),
      ]);

      const ledgerPath = join(__dirname, '../employees/references/cost-ledger.md');
      let costLedger = '';
      try { costLedger = readFileSync(ledgerPath, 'utf-8'); } catch {}

      const gigs = gigsRes.rows.map(r => {
        let meta = {};
        try { if (r.notes?.startsWith('{')) meta = JSON.parse(r.notes); } catch {}
        return { id: r.id, date: r.date, venue: r.venue, city: r.city ?? '', fee: meta.fee ?? null };
      });
      const totalFees = gigs.reduce((s, g) => s + (Number(g.fee) || 0), 0);

      extra = {
        costLedger,
        gigs,
        totalFees,
        musicStats: musicStatsRes.rows[0] ?? { total: 0, succeeded: 0, this_month: 0 },
        renderStats: renderStatsRes.rows[0] ?? { total: 0, this_month: 0 },
      };
    }

    if (name === 'personal') {
      const [tasksRes, gigsRes] = await Promise.all([
        pool.query(`SELECT * FROM tasks ORDER BY added_at ASC`),
        pool.query(`SELECT * FROM gigs ORDER BY date ASC`),
      ]);
      const tasks = { active: [], waiting: [], someday: [], done: [] };
      for (const row of tasksRes.rows) {
        const bucket = tasks[row.section] ? row.section : 'active';
        tasks[bucket].push({ id: row.id, title: row.title, added: row.added_at, completed: row.completed_at ?? null });
      }
      const gigs = gigsRes.rows.map(r => {
        let meta = {};
        try { if (r.notes?.startsWith('{')) meta = JSON.parse(r.notes); } catch {}
        return { id: r.id, date: r.date, venue: r.venue, city: r.city ?? '', ...meta };
      });
      extra = { tasks, gigs };
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
      const refParts = await Promise.all((emp.refs ?? []).map(async r => {
        if (r === 'references/voice-guide.md') return buildVoiceGuideFromDb();
        return loadSkill(r);
      }));
      const refContent = refParts.filter(Boolean).join('\n\n---\n');
      const refs = refContent
        ? `\n\n---\n## ספריית רפרנסים — טעונה כעת בזיכרון שלך\nהמידע הבא כבר זמין לך. אל תאמר שאתה "הולך לבדוק" — הוא כאן. המלץ רק על פלאגינים שמופיעים ברשימה המאומתת הזו:\n\n${refContent}`
        : '';
      if (skill) systemPrompt = skill + refs + '\n\n---\nמצב המערכת הנוכחי:\n' + context;
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

async function buildVoiceGuideFromDb() {
  try {
    const { rows } = await pool.query(
      `SELECT title, genre, tags, description, play_count, duration_ms
       FROM tracks ORDER BY play_count DESC`
    );
    const fmtDur = ms => ms ? `${Math.floor(ms/60000)}:${String(Math.floor((ms%60000)/1000)).padStart(2,'0')}` : null;
    const withDesc  = rows.filter(r => r.description?.trim()).length;
    const withTags  = rows.filter(r => r.tags?.trim()).length;

    const genres = {};
    for (const r of rows) { const g = (r.genre ?? 'ללא ז\'אנר').trim(); genres[g] = (genres[g] ?? 0) + 1; }
    const genreLines = Object.entries(genres).sort((a,b) => b[1]-a[1]).map(([g,c]) => `- ${g}: ${c}`).join('\n');

    const top20 = rows.slice(0, 20).map(r => {
      const dur = fmtDur(r.duration_ms);
      const lines = [`### ${r.title}`];
      if (r.genre)         lines.push(`- **ז\'אנר:** ${r.genre}`);
      if (dur)             lines.push(`- **אורך:** ${dur}`);
      if (r.play_count)    lines.push(`- **השמעות:** ${r.play_count.toLocaleString()}`);
      if (r.tags?.trim())  lines.push(`- **תגיות:** ${r.tags}`);
      if (r.description?.trim()) lines.push(`- **תיאור:** ${r.description.trim().slice(0, 250)}`);
      return lines.join('\n');
    }).join('\n\n');

    const allTable = rows.map(r =>
      `| ${r.title} | ${r.genre ?? '—'} | ${fmtDur(r.duration_ms) ?? '—'} | ${(r.play_count ?? 0).toLocaleString()} |`
    ).join('\n');

    return `# מדריך קול VOVAX — קטלוג טראקים (${rows.length} סה"כ)
> נוצר בזמן אמת מ-DB. מיון: play_count גבוה → נמוך.

## סטטיסטיקה
- **סה"כ:** ${rows.length} טראקים | **עם תיאור:** ${withDesc} | **עם תגיות:** ${withTags}

## ז'אנרים
${genreLines}

## Top 20 — הכי מושמעים
${top20}

## כל הטראקים
| כותרת | ז'אנר | אורך | השמעות |
|---|---|---|---|
${allTable}`;
  } catch (e) {
    return `# מדריך קול — DB לא זמין (${e.message})`;
  }
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
