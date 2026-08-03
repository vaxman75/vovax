import pool from './db/index.js';

// ── Time helpers ──────────────────────────────────────────────────────────────

function hebrewDate() {
  return new Date().toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function todayStartMs() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function weekStartMs() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtTimeMs(ms) {
  return new Date(Number(ms)).toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateTimeMs(ms) {
  return new Date(Number(ms)).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatGigDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function hebrewWeekRange() {
  const end = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const start = new Date(end);
  start.setDate(end.getDate() - end.getDay()); // Sunday
  const fmt = (d) => d.toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long',
  });
  return `${fmt(start)} – ${fmt(end)}`;
}

// ── Label maps ────────────────────────────────────────────────────────────────

const CH    = { vovax: 'VOVAX', signal: 'Signal Detected' };
const PF    = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };
const ST    = { published: 'פורסם ✓', approved: 'מאושר', pending: 'ממתין', rejected: 'נדחה' };
const ST_CLR = { published: '#4CAF50', approved: '#46C7FF', pending: '#FFB347', rejected: '#8B8A85' };

const DEPLOY_LABEL = {
  SUCCESS: '✓ הצלחה', FAILED: '✗ נכשל', CRASHED: '✗ קרס',
  BUILDING: '⏳ בנייה', DEPLOYING: '⏳ דפלוי', SLEEPING: '💤 ישן',
  REMOVED: 'הוסר', WAITING: '⏳ ממתין',
};
const DEPLOY_CLR = {
  SUCCESS: '#4CAF50', FAILED: '#FF4444', CRASHED: '#FF4444',
  BUILDING: '#46C7FF', DEPLOYING: '#46C7FF', SLEEPING: '#8B8A85',
  REMOVED: '#8B8A85', WAITING: '#FFB347',
};

// ── Railway API ───────────────────────────────────────────────────────────────

async function fetchRailwayDeploys() {
  const token     = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  if (!token || !projectId) return null; // section will show "configure" hint
  const serviceId = process.env.RAILWAY_SERVICE_ID ?? null; // auto-set by Railway

  // meta is a JSON scalar — no subfields allowed in query
  const queryStr = serviceId
    ? `query D($p:String!,$s:String!){deployments(input:{projectId:$p,serviceId:$s}){edges{node{status createdAt meta}}}}`
    : `query D($p:String!){deployments(input:{projectId:$p}){edges{node{status createdAt meta}}}}`;
  const vars = serviceId ? { p: projectId, s: serviceId } : { p: projectId };

  try {
    const r = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryStr, variables: vars }),
    });
    if (!r.ok) return [];
    const data = await r.json();
    if (data.errors?.length) return [];
    const since = Date.now() - 48 * 60 * 60 * 1000;
    return (data?.data?.deployments?.edges ?? [])
      .map((e) => {
        const node = e.node;
        // meta is a raw JSON object (Railway returns it as scalar); extract reason
        const reason = node.meta?.reason ?? null;
        return { status: node.status, createdAt: node.createdAt, reason };
      })
      .filter((d) => new Date(d.createdAt).getTime() > since)
      .slice(0, 6);
  } catch { return []; }
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function buildDigestData() {
  const today = todayStartMs();
  const [tasksRes, gigsRes, opsRes, activityRes, pendingRes, tracksRes] = await Promise.all([
    pool.query("SELECT * FROM tasks WHERE section IN ('active','waiting') ORDER BY added_at ASC"),
    pool.query(`SELECT * FROM gigs WHERE date::date >= CURRENT_DATE ORDER BY date ASC LIMIT 5`),
    pool.query("SELECT * FROM ops_items WHERE status IN ('active','waiting') ORDER BY created_at DESC"),
    // Activity today: group by channel/platform/status
    pool.query(
      `SELECT channel, platform, status, COUNT(*)::int AS cnt
       FROM publish_queue WHERE created_at >= $1
       GROUP BY channel, platform, status ORDER BY channel, status`,
      [today]
    ),
    // VOVAX items still waiting for manual approval (any age)
    pool.query(
      `SELECT id, topic, script, created_at
       FROM publish_queue WHERE channel='vovax' AND status='pending'
       ORDER BY created_at ASC LIMIT 10`
    ),
    // Tracks linked to posts created today
    pool.query(
      `SELECT pq.channel, pq.topic, pq.created_at, t.title, t.genre
       FROM publish_queue pq JOIN tracks t ON pq.track_id = t.id
       WHERE pq.created_at >= $1 AND pq.track_id IS NOT NULL
       ORDER BY pq.created_at DESC`,
      [today]
    ),
  ]);
  const deploys = await fetchRailwayDeploys();
  return {
    tasks:            tasksRes.rows,
    gigs:             gigsRes.rows,
    ops:              opsRes.rows,
    activity:         activityRes.rows,
    pendingApprovals: pendingRes.rows,
    tracksUsedToday:  tracksRes.rows,
    deploys,
  };
}

async function buildWeeklyData() {
  const weekStart = weekStartMs();
  const [tasksRes, gigsRes, opsRes, publishRes, tracksRes, doneRes] = await Promise.all([
    pool.query("SELECT * FROM tasks WHERE section IN ('active','waiting') ORDER BY added_at ASC"),
    pool.query(`SELECT * FROM gigs WHERE date::date >= CURRENT_DATE ORDER BY date ASC LIMIT 10`),
    pool.query("SELECT * FROM ops_items WHERE status IN ('active','waiting') ORDER BY created_at DESC"),
    pool.query(
      `SELECT channel, platform, COUNT(*)::int AS cnt
       FROM publish_queue WHERE status='published' AND published_at >= $1
       GROUP BY channel, platform ORDER BY channel`,
      [weekStart]
    ),
    pool.query(
      `SELECT t.title, t.genre, COUNT(*)::int AS uses
       FROM publish_queue pq JOIN tracks t ON pq.track_id = t.id
       WHERE pq.created_at >= $1
       GROUP BY t.id, t.title, t.genre ORDER BY uses DESC LIMIT 8`,
      [weekStart]
    ),
    pool.query(
      `SELECT * FROM tasks WHERE section='done' AND completed_at >= $1 ORDER BY completed_at DESC`,
      [weekStart]
    ),
  ]);
  return {
    tasks:          tasksRes.rows,
    gigs:           gigsRes.rows,
    ops:            opsRes.rows,
    weeklyPublish:  publishRes.rows,
    weeklyTracks:   tracksRes.rows,
    completedTasks: doneRes.rows,
  };
}

// ── Shared CSS ────────────────────────────────────────────────────────────────

const STYLES = `
  body{background:#0A0A0C;color:#F2F1ED;font-family:'Helvetica Neue',Arial,sans-serif;max-width:580px;margin:0 auto;padding:32px 24px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#8B8A85;font-size:13px;margin:0 0 28px}
  .pulse{display:block;width:100%;margin:0 0 28px}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#8B8A85;margin:0 0 10px;border-top:1px solid #232326;padding-top:16px}
  ul{margin:0 0 8px;padding-right:20px}
  li{font-size:14px;line-height:1.7}
  p{margin:0 0 6px}
  .ch{font-size:13px;font-weight:600;margin:8px 0 3px}
  .pf-row{font-size:13px;margin:2px 0 2px 12px}
  .track-item{font-size:13px;margin:4px 0}
  .pending-item{background:#18181C;border-radius:6px;padding:8px 10px;margin:6px 0;font-size:13px}
  .pending-meta{font-size:11px;color:#8B8A85;margin-top:3px}
  .deploy-row{display:flex;gap:10px;align-items:baseline;font-size:13px;margin:4px 0;flex-wrap:wrap}
  .footer{color:#8B8A85;font-size:11px;margin-top:32px;border-top:1px solid #232326;padding-top:16px}
  a{color:#46C7FF}
  .count{color:#46C7FF;font-weight:700}
  .muted{color:#8B8A85}
  .ok{color:#4CAF50}
  .warn{color:#FFB347}
  .err{color:#FF4444}
  .empty{color:#8B8A85;font-size:13px;margin:0 0 12px}
`;

const PULSE_SVG = `
<svg class="pulse" height="20" viewBox="0 0 400 20">
  <path d="M0 10 L40 10 L48 2 L56 18 L64 10 L100 10 L108 6 L116 14 L124 10 L400 10"
        fill="none" stroke="#46C7FF" stroke-width="1.5" stroke-dasharray="6 4"/>
</svg>`;

// ── Section renderers ─────────────────────────────────────────────────────────

function renderPublishActivity(activity) {
  if (activity.length === 0) {
    return `<p class="empty">אין פעילות פרסום היום</p>`;
  }
  const grouped = {};
  for (const row of activity) {
    if (!grouped[row.channel]) grouped[row.channel] = {};
    if (!grouped[row.channel][row.platform]) grouped[row.channel][row.platform] = {};
    grouped[row.channel][row.platform][row.status] = row.cnt;
  }
  let html = '';
  for (const [ch, platforms] of Object.entries(grouped)) {
    html += `<p class="ch">${CH[ch] ?? ch}</p>`;
    for (const [pf, statuses] of Object.entries(platforms)) {
      const parts = Object.entries(statuses).map(([st, cnt]) => {
        const color = ST_CLR[st] ?? '#F2F1ED';
        return `<span style="color:${color}">${cnt} ${ST[st] ?? st}</span>`;
      });
      html += `<p class="pf-row">${PF[pf] ?? pf}: ${parts.join(' · ')}</p>`;
    }
  }
  return html;
}

function renderTracksUsed(tracks) {
  if (tracks.length === 0) {
    return `<p class="empty">לא נעשה שימוש בטראקים היום</p>`;
  }
  return tracks.map((t) =>
    `<p class="track-item">
      <strong>"${t.title}"</strong>${t.genre ? ` <span class="muted">(${t.genre})</span>` : ''}
      <span class="muted"> ← ${CH[t.channel] ?? t.channel} · ${t.topic} · ${fmtTimeMs(t.created_at)}</span>
     </p>`
  ).join('');
}

function renderPendingApprovals(items) {
  if (items.length === 0) {
    return `<p class="empty">אין טיוטות ממתינות ✓</p>`;
  }
  return items.map((item) => {
    const preview = (item.script ?? '').slice(0, 100) + (item.script?.length > 100 ? '…' : '');
    return `<div class="pending-item">
      <div><span class="warn">●</span> <strong>${item.topic}</strong></div>
      <div style="margin-top:5px;color:#F2F1ED">"${preview}"</div>
      <div class="pending-meta">נוצר: ${fmtDateTimeMs(item.created_at)}</div>
    </div>`;
  }).join('');
}

function renderDeploys(deploys) {
  if (deploys === null) {
    return `<p class="empty">לא מוגדר RAILWAY_API_TOKEN + RAILWAY_PROJECT_ID — <a href="https://vovax-app-production.up.railway.app">הגדר כדי לקבל ניטור</a></p>`;
  }
  if (deploys.length === 0) {
    return `<p class="empty">אין דפלויים ב-48 שעות האחרונות</p>`;
  }
  const hasFailed = deploys.some((d) => d.status === 'FAILED' || d.status === 'CRASHED');
  const header = hasFailed ? `<p class="err" style="margin-bottom:8px">⚠ יש דפלויים שנכשלו</p>` : '';
  const rows = deploys.map((d) => {
    const label = DEPLOY_LABEL[d.status] ?? d.status;
    const color = DEPLOY_CLR[d.status] ?? '#8B8A85';
    const when  = new Date(d.createdAt).toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    const reason = d.reason ? `(${d.reason})` : '';
    return `<div class="deploy-row">
      <span style="color:${color};min-width:88px">${label}</span>
      <span class="muted" style="min-width:85px">${when}</span>
      ${reason ? `<span class="muted" style="font-size:12px">${reason}</span>` : ''}
    </div>`;
  }).join('');
  return header + rows;
}

// ── Existing section helpers ───────────────────────────────────────────────────

function renderTasks(activeTasks, waitingTasks) {
  const taskRow = (t) => `<li>${t.title}</li>`;
  const none    = `<li style="color:#8B8A85">אין</li>`;
  return `
    ${activeTasks.length  > 0 ? `<p style="font-size:11px;color:#8B8A85;margin:0 0 4px">פעיל (${activeTasks.length})</p><ul>${activeTasks.map(taskRow).join('')}</ul>` : ''}
    ${waitingTasks.length > 0 ? `<p style="font-size:11px;color:#8B8A85;margin:0 0 4px">בהמתנה (${waitingTasks.length})</p><ul>${waitingTasks.map(taskRow).join('')}</ul>` : ''}
    ${activeTasks.length === 0 && waitingTasks.length === 0 ? `<ul>${none}</ul>` : ''}`;
}

function renderGigs(gigs) {
  if (gigs.length === 0) return `<ul><li style="color:#8B8A85">אין הופעות קרובות</li></ul>`;
  return `<ul>${gigs.map((g) => {
    let meta = {};
    try { meta = JSON.parse(g.notes); } catch {}
    const time = meta.startTime ? ` · ${meta.startTime}–${meta.endTime ?? ''}` : '';
    return `<li><strong>${g.venue}</strong>${g.city ? `, ${g.city}` : ''} — ${formatGigDate(g.date)}${time}</li>`;
  }).join('')}</ul>`;
}

function renderOps(ops) {
  if (ops.length === 0) return `<ul><li style="color:#8B8A85">אין פריטים פתוחים</li></ul>`;
  return `<ul>${ops.map((o) =>
    `<li>${o.title}${o.owner ? ` <span class="muted">(${o.owner})</span>` : ''}</li>`
  ).join('')}</ul>`;
}

// ── Exported HTML builders ────────────────────────────────────────────────────

export async function buildDigestHtml() {
  const { tasks, gigs, ops, activity, pendingApprovals, tracksUsedToday, deploys } = await buildDigestData();

  const activeTasks  = tasks.filter((t) => t.section === 'active');
  const waitingTasks = tasks.filter((t) => t.section === 'waiting');
  const pendingCount = pendingApprovals.length;

  const pendingLabel = pendingCount > 0
    ? ` — <span class="warn">${pendingCount} ממתינות לאישורך</span>`
    : ' — <span class="ok">הכל נקי ✓</span>';

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><style>${STYLES}</style></head>
<body>
<p style="color:#8B8A85;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">VOVAX · RON — תדריך יומי</p>
<h1>בוקר טוב</h1>
<p class="sub">${hebrewDate()}</p>
${PULSE_SVG}

<h2>פרסום היום</h2>
${renderPublishActivity(activity)}

<h2>טראקים בשימוש היום</h2>
${renderTracksUsed(tracksUsedToday)}

<h2>ממתין לאישורך${pendingLabel}</h2>
${renderPendingApprovals(pendingApprovals)}

<h2>Railway — 48 שעות אחרונות</h2>
${renderDeploys(deploys)}

<h2>משימות פתוחות — <span class="count">${activeTasks.length + waitingTasks.length}</span></h2>
${renderTasks(activeTasks, waitingTasks)}

<h2>הופעות קרובות — <span class="count">${gigs.length}</span></h2>
${renderGigs(gigs)}

<h2>תיאום פעולות פתוח — <span class="count">${ops.length}</span></h2>
${renderOps(ops)}

<div class="footer">
  <a href="https://vovax-app-production.up.railway.app">פתח את VOVAX</a> ·
  נשלח אוטומטית בימי א'–ה' ב-08:00 שעון ישראל
</div>
</body>
</html>`;
}

export async function buildWeeklyDigestHtml() {
  const { tasks, gigs, ops, weeklyPublish, weeklyTracks, completedTasks } = await buildWeeklyData();

  const activeTasks  = tasks.filter((t) => t.section === 'active');
  const waitingTasks = tasks.filter((t) => t.section === 'waiting');

  // Group publish by channel
  const byChannel = {};
  let totalPublished = 0;
  for (const row of weeklyPublish) {
    if (!byChannel[row.channel]) byChannel[row.channel] = {};
    byChannel[row.channel][row.platform] = row.cnt;
    totalPublished += row.cnt;
  }

  const publishHtml = Object.keys(byChannel).length === 0
    ? `<p class="empty">לא פורסם תוכן השבוע</p>`
    : Object.entries(byChannel).map(([ch, platforms]) => {
        const chTotal = Object.values(platforms).reduce((a, b) => a + b, 0);
        const detail  = Object.entries(platforms)
          .map(([p, c]) => `${PF[p] ?? p}: ${c}`)
          .join(', ');
        return `<p class="ch">${CH[ch] ?? ch} — <span class="count">${chTotal}</span> פוסטים <span class="muted">(${detail})</span></p>`;
      }).join('');

  const tracksHtml = weeklyTracks.length === 0
    ? `<p class="empty">לא נעשה שימוש בטראקים השבוע</p>`
    : weeklyTracks.map((t, i) =>
        `<p class="track-item">${i + 1}. <strong>"${t.title}"</strong>${t.genre ? ` <span class="muted">(${t.genre})</span>` : ''} — <span class="count">${t.uses}</span> שימוש${t.uses > 1 ? 'ים' : ''}</p>`
      ).join('');

  const doneHtml = completedTasks.length > 0
    ? `<p style="font-size:11px;color:#4CAF50;margin:8px 0 4px">הושלמו השבוע (${completedTasks.length})</p>
       <ul>${completedTasks.map((t) => `<li style="color:#8B8A85">${t.title}</li>`).join('')}</ul>`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><style>${STYLES}</style></head>
<body>
<p style="color:#8B8A85;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">VOVAX · RON — בריף שבועי</p>
<h1>שבוע טוב</h1>
<p class="sub">${hebrewWeekRange()}</p>
${PULSE_SVG}

<h2>פרסום שבועי — <span class="count">${totalPublished}</span> פוסטים</h2>
${publishHtml}

<h2>טראקים בשימוש השבוע</h2>
${tracksHtml}

<h2>משימות — <span class="count">${activeTasks.length + waitingTasks.length}</span> פתוחות${completedTasks.length > 0 ? `, <span class="ok">${completedTasks.length} הושלמו השבוע</span>` : ''}</h2>
${renderTasks(activeTasks, waitingTasks)}
${doneHtml}

<h2>הופעות קרובות — <span class="count">${gigs.length}</span></h2>
${renderGigs(gigs)}

<h2>תיאום פעולות פתוח — <span class="count">${ops.length}</span></h2>
${renderOps(ops)}

<div class="footer">
  <a href="https://vovax-app-production.up.railway.app">פתח את VOVAX</a> ·
  נשלח אוטומטית בימי שישי ב-08:00 שעון ישראל
</div>
</body>
</html>`;
}
