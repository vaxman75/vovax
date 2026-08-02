import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runMigrations } from './db/migrate.js';
import { startCron } from './cron.js';
import { buildDigestHtml } from './digest.js';

import tasksRouter from './routes/tasks.js';
import meetingsRouter from './routes/meetings.js';
import opsRouter from './routes/ops.js';
import gigsRouter from './routes/gigs.js';
import acestepRouter from './routes/acestep.js';
import higgsfieldRouter from './routes/higgsfield.js';
import heygenRouter from './routes/heygen.js';
import elevenlabsRouter from './routes/elevenlabs.js';

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

// API routes
app.use('/api/tasks', tasksRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/ops', opsRouter);
app.use('/api/gigs', gigsRouter);
app.use('/api/acestep', acestepRouter);
app.use('/api/higgsfield', higgsfieldRouter);
app.use('/api/heygen', heygenRouter);
app.use('/api/elevenlabs', elevenlabsRouter);

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

async function start() {
  await runMigrations();
  startCron();
  app.listen(PORT, () => console.log(`VOVAX server on port ${PORT}`));
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
