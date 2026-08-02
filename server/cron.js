import cron from 'node-cron';
import { Resend } from 'resend';
import { buildDigestHtml } from './digest.js';

export function startCron() {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.DIGEST_RECIPIENT_EMAIL;

  if (!apiKey || !recipient) {
    console.log('Cron: RESEND_API_KEY or DIGEST_RECIPIENT_EMAIL not set — digest disabled');
    return;
  }

  const resend = new Resend(apiKey);

  // 08:00 Israel time, Sun–Thu (0=Sun, 4=Thu in Israel work week)
  cron.schedule('0 8 * * 0,1,2,3,4', async () => {
    console.log('Cron: sending morning digest...');
    try {
      const html = await buildDigestHtml();
      const date = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long' });
      // DIGEST_FROM_EMAIL defaults to Resend's shared domain (works without domain verification).
      // After verifying your domain in Resend, set it to e.g. digest@yourdomain.com
      const from = process.env.DIGEST_FROM_EMAIL || 'VOVAX Digest <onboarding@resend.dev>';
      const { data, error } = await resend.emails.send({
        from,
        to: [recipient],
        subject: `VOVAX · תדריך בוקר — ${date}`,
        html,
      });
      if (error) {
        console.error('Cron: Resend error:', error);
      } else {
        console.log('Cron: digest sent, id:', data?.id);
      }
    } catch (err) {
      console.error('Cron: failed to send digest:', err.message);
    }
  }, { timezone: 'Asia/Jerusalem' });

  console.log('Cron: morning digest scheduled (Sun–Thu 08:00 Israel time)');
}
