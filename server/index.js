import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runMigrations } from './db/migrate.js';
import { startCron } from './cron.js';
import { buildDigestHtml, buildWeeklyDigestHtml } from './digest.js';
import { sentryErrorHandler } from './sentry.js';

import tasksRouter from './routes/tasks.js';
import meetingsRouter from './routes/meetings.js';
import opsRouter from './routes/ops.js';
import gigsRouter from './routes/gigs.js';
import acestepRouter from './routes/acestep.js';
import higgsfieldRouter from './routes/higgsfield.js';
import heygenRouter from './routes/heygen.js';
import elevenlabsRouter from './routes/elevenlabs.js';
import publishRouter from './routes/publish.js';
import soundcloudRouter from './routes/soundcloud.js';
import tracksRouter from './routes/tracks.js';
import adminRouter from './routes/admin.js';
import musicRouter from './routes/music.js';
import studioRouter from './routes/studio.js';
import { requireAuth } from './middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check for Railway
app.get('/health', (_req, res) => res.json({ ok: true }));

// Preview digest HTML in browser (no email sent)
app.get('/api/digest/preview', async (_req, res) => {
  try {
    const html = await buildDigestHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preview weekly brief HTML in browser (no email sent)
app.get('/api/digest/preview-weekly', async (_req, res) => {
  try {
    const html = await buildWeeklyDigestHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger a real digest send immediately (for testing)
app.post('/api/digest/send-test', async (_req, res) => {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.DIGEST_RECIPIENT_EMAIL;
  if (!apiKey || !recipient) return res.status(500).json({ error: 'RESEND_API_KEY or DIGEST_RECIPIENT_EMAIL not set' });
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const html = await buildDigestHtml();
    const from = process.env.DIGEST_FROM_EMAIL || 'VOVAX Digest <onboarding@resend.dev>';
    const date = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long' });
    const { data, error } = await resend.emails.send({
      from,
      to: [recipient],
      subject: `VOVAX · תדריך בוקר (בדיקה) — ${date}`,
      html,
    });
    if (error) return res.status(500).json({ error });
    res.json({ ok: true, id: data?.id, to: recipient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin routes (login open, all others auth-guarded inside router)
app.use('/api/admin', adminRouter);

// Protect human-only publish actions — Zapier endpoints remain open
app.post('/api/publish/vovax/:id/approve',       requireAuth, (req, res, next) => next());
app.post('/api/publish/vovax/:id/reject',        requireAuth, (req, res, next) => next());
app.post('/api/publish/:id/qa-review',           requireAuth, (req, res, next) => next());

// API routes
app.use('/api/tasks', tasksRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/ops', opsRouter);
app.use('/api/gigs', gigsRouter);
app.use('/api/acestep', acestepRouter);
app.use('/api/higgsfield', higgsfieldRouter);
app.use('/api/heygen', heygenRouter);
app.use('/api/elevenlabs', elevenlabsRouter);
app.use('/api/publish', publishRouter);
app.use('/api/soundcloud', soundcloudRouter);
app.use('/api/tracks', tracksRouter);
app.use('/api/music', musicRouter);
app.use('/api/studio', studioRouter);

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

// Sentry error handler — must be after all routes, only captures 5xx
sentryErrorHandler(app);

// Express error handler — client errors (4xx) pass through silently; 5xx are logged
app.use((err, _req, res, _next) => {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) console.error('Unhandled 5xx:', err.message);
  res.status(status).json({ error: err.message ?? 'internal server error' });
});

async function start() {
  await runMigrations();
  startCron();
  app.listen(PORT, () => console.log(`VOVAX server on port ${PORT}`));
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
