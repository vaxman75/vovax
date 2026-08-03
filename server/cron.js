import cron from 'node-cron';
import { Resend } from 'resend';
import { buildDigestHtml, buildWeeklyDigestHtml } from './digest.js';
import { checkHeyGenRender, sendPendingNotification } from './routes/publish.js';
import pool from './db/index.js';

export function startCron() {
  const apiKey    = process.env.RESEND_API_KEY;
  const recipient = process.env.DIGEST_RECIPIENT_EMAIL;

  // ── HeyGen render poll — runs every 2 min regardless of email config ─────────
  cron.schedule('*/2 * * * *', async () => {
    try {
      const heygenKey = process.env.HEYGEN_API_KEY;
      if (!heygenKey || heygenKey === 'placeholder') return;

      const { rows } = await pool.query(
        `SELECT id, heygen_video_id, channel FROM publish_queue
         WHERE status='rendering' AND heygen_video_id IS NOT NULL`
      );
      if (rows.length === 0) return;

      console.log(`Cron: checking ${rows.length} rendering item(s)…`);

      for (const item of rows) {
        const hg = await checkHeyGenRender(item.heygen_video_id);
        if (!hg) continue;

        if (hg.status === 'completed' && hg.video_url) {
          // Check pending count before update to know whether to notify
          const { rows: pb } = await pool.query(
            `SELECT COUNT(*)::int AS cnt FROM publish_queue WHERE channel=$1 AND status='pending'`,
            [item.channel]
          );
          await pool.query(
            `UPDATE publish_queue SET status='pending', video_url=$1, created_at=$2 WHERE id=$3`,
            [hg.video_url, Date.now(), item.id]
          );
          console.log(`Cron: render complete → ${item.id} (${item.channel})`);

          // Notify on first VOVAX pending item
          if (item.channel === 'vovax' && (pb[0]?.cnt ?? 0) === 0) {
            sendPendingNotification().catch(() => {});
          }
        } else if (hg.status === 'failed' || hg.status === 'error') {
          // Fallback: surface as text-only pending so it isn't lost
          await pool.query(
            `UPDATE publish_queue SET status='pending', notes='HeyGen render failed — text only' WHERE id=$1`,
            [item.id]
          );
          console.error(`Cron: render failed for ${item.id}, promoting to text-only pending`);
        }
        // 'processing' / 'waiting' — leave as rendering, check next cycle
      }
    } catch (e) {
      console.error('Cron: render poll error:', e.message);
    }
  });

  // ── Email digests ─────────────────────────────────────────────────────────────
  if (!apiKey || !recipient) {
    console.log('Cron: RESEND_API_KEY or DIGEST_RECIPIENT_EMAIL not set — digest disabled');
    console.log('Cron: HeyGen render poll active (every 2 min)');
    return;
  }

  const resend = new Resend(apiKey);
  const from   = process.env.DIGEST_FROM_EMAIL || 'VOVAX Digest <onboarding@resend.dev>';

  function israelDate() {
    return new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long' });
  }

  async function sendEmail(subject, htmlBuilder) {
    try {
      const html = await htmlBuilder();
      const { data, error } = await resend.emails.send({ from, to: [recipient], subject, html });
      if (error) console.error('Cron: Resend error:', error);
      else console.log(`Cron: sent "${subject}", id: ${data?.id}`);
    } catch (err) {
      console.error(`Cron: failed to send "${subject}":`, err.message);
    }
  }

  cron.schedule('0 8 * * 0,1,2,3,4', () => {
    console.log('Cron: sending daily digest...');
    sendEmail(`VOVAX · תדריך בוקר — ${israelDate()}`, buildDigestHtml);
  }, { timezone: 'Asia/Jerusalem' });

  cron.schedule('0 8 * * 5', () => {
    console.log('Cron: sending weekly brief...');
    sendEmail(`VOVAX · בריף שבועי — ${israelDate()}`, buildWeeklyDigestHtml);
  }, { timezone: 'Asia/Jerusalem' });

  console.log('Cron: HeyGen render poll (every 2 min), daily digest (Sun–Thu 08:00), weekly brief (Fri 08:00) — Israel time');
}
