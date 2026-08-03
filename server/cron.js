import cron from 'node-cron';
import { Resend } from 'resend';
import { buildDigestHtml, buildWeeklyDigestHtml } from './digest.js';

export function startCron() {
  const apiKey    = process.env.RESEND_API_KEY;
  const recipient = process.env.DIGEST_RECIPIENT_EMAIL;

  if (!apiKey || !recipient) {
    console.log('Cron: RESEND_API_KEY or DIGEST_RECIPIENT_EMAIL not set — digest disabled');
    return;
  }

  const resend = new Resend(apiKey);
  const from   = process.env.DIGEST_FROM_EMAIL || 'VOVAX Digest <onboarding@resend.dev>';

  function israelDate() {
    return new Date().toLocaleDateString('he-IL', {
      timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long',
    });
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

  // Daily digest — Sun–Thu 08:00 Israel time
  cron.schedule('0 8 * * 0,1,2,3,4', () => {
    console.log('Cron: sending daily digest...');
    sendEmail(`VOVAX · תדריך בוקר — ${israelDate()}`, buildDigestHtml);
  }, { timezone: 'Asia/Jerusalem' });

  // Weekly brief — Friday 08:00 Israel time
  cron.schedule('0 8 * * 5', () => {
    console.log('Cron: sending weekly brief...');
    sendEmail(`VOVAX · בריף שבועי — ${israelDate()}`, buildWeeklyDigestHtml);
  }, { timezone: 'Asia/Jerusalem' });

  console.log('Cron: daily digest scheduled (Sun–Thu 08:00), weekly brief scheduled (Fri 08:00) — Israel time');
}
