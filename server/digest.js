import pool from './db/index.js';

function hebrewDate() {
  return new Date().toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

async function buildDigestData() {
  const [tasksRes, gigsRes, opsRes] = await Promise.all([
    pool.query("SELECT * FROM tasks WHERE section IN ('active','waiting') ORDER BY added_at ASC"),
    pool.query(`SELECT * FROM gigs WHERE date::date >= CURRENT_DATE ORDER BY date ASC LIMIT 5`),
    pool.query("SELECT * FROM ops_items WHERE status IN ('active','waiting') ORDER BY created_at DESC"),
  ]);
  return { tasks: tasksRes.rows, gigs: gigsRes.rows, ops: opsRes.rows };
}

function sectionLabel(s) {
  return s === 'active' ? 'פעיל' : s === 'waiting' ? 'בהמתנה' : s;
}

function formatGigDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export async function buildDigestHtml() {
  const { tasks, gigs, ops } = await buildDigestData();

  const activeTasks = tasks.filter((t) => t.section === 'active');
  const waitingTasks = tasks.filter((t) => t.section === 'waiting');

  const taskRows = (list) =>
    list.length === 0
      ? '<li style="color:#8B8A85">אין</li>'
      : list.map((t) => `<li>${t.title}</li>`).join('');

  const gigRows =
    gigs.length === 0
      ? '<li style="color:#8B8A85">אין הופעות קרובות</li>'
      : gigs.map((g) => {
          let meta = {};
          try { meta = JSON.parse(g.notes); } catch {}
          const time = meta.startTime ? ` · ${meta.startTime}–${meta.endTime}` : '';
          return `<li><strong>${g.venue}</strong>${g.city ? `, ${g.city}` : ''} — ${formatGigDate(g.date)}${time}</li>`;
        }).join('');

  const opsRows =
    ops.length === 0
      ? '<li style="color:#8B8A85">אין פריטים פתוחים</li>'
      : ops.map((o) => `<li>${o.title}${o.owner ? ` <span style="color:#8B8A85">(${o.owner})</span>` : ''}</li>`).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<style>
  body { background:#0A0A0C; color:#F2F1ED; font-family:'Helvetica Neue',Arial,sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; }
  h1 { font-size:22px; margin:0 0 4px; }
  .sub { color:#8B8A85; font-size:13px; margin:0 0 28px; }
  .pulse { display:block; width:100%; margin:0 0 28px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.12em; color:#8B8A85; margin:0 0 10px; border-top:1px solid #232326; padding-top:16px; }
  ul { margin:0 0 8px; padding-right:20px; }
  li { font-size:14px; line-height:1.7; }
  .count { color:#46C7FF; font-weight:700; }
  .footer { color:#8B8A85; font-size:11px; margin-top:32px; border-top:1px solid #232326; padding-top:16px; }
  a { color:#46C7FF; }
</style>
</head>
<body>
<p style="color:#8B8A85;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">VOVAX · RON — תדריך יומי</p>
<h1>בוקר טוב</h1>
<p class="sub">${hebrewDate()}</p>

<svg class="pulse" height="20" viewBox="0 0 400 20">
  <path d="M0 10 L40 10 L48 2 L56 18 L64 10 L100 10 L108 6 L116 14 L124 10 L400 10"
        fill="none" stroke="#46C7FF" stroke-width="1.5" stroke-dasharray="6 4"/>
</svg>

<h2>משימות פתוחות — <span class="count">${activeTasks.length + waitingTasks.length}</span></h2>
${activeTasks.length > 0 ? `<p style="font-size:11px;color:#8B8A85;margin:0 0 4px">פעיל (${activeTasks.length})</p><ul>${taskRows(activeTasks)}</ul>` : ''}
${waitingTasks.length > 0 ? `<p style="font-size:11px;color:#8B8A85;margin:0 0 4px">בהמתנה (${waitingTasks.length})</p><ul>${taskRows(waitingTasks)}</ul>` : ''}
${activeTasks.length === 0 && waitingTasks.length === 0 ? '<ul>' + taskRows([]) + '</ul>' : ''}

<h2>הופעות קרובות — <span class="count">${gigs.length}</span></h2>
<ul>${gigRows}</ul>

<h2>תיאום פעולות פתוח — <span class="count">${ops.length}</span></h2>
<ul>${opsRows}</ul>

<div class="footer">
  <a href="https://vovax-app-production.up.railway.app">פתח את VOVAX</a> ·
  נשלח אוטומטית בימי א'–ה' ב-08:00 שעון ישראל
</div>
</body>
</html>`;
}
