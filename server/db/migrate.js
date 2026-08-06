import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = ['001_init.sql', '002_publish_queue.sql', '003_tracks.sql', '004_qa.sql', '005_heygen_render.sql', '006_gender_pairing.sql', '007_duration_hint.sql', '008_music_queue.sql', '009_avatar_name.sql', '010_music_queue_variation.sql', '011_dept_tables.sql', '012_seed_board_decision.sql', '013_morning_brief.sql'];

export async function runMigrations() {
  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(__dirname, '../migrations', file), 'utf8');
    await pool.query(sql);
  }
  console.log('Migrations OK');
}
