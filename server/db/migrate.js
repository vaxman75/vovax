import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = ['001_init.sql', '002_publish_queue.sql'];

export async function runMigrations() {
  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(__dirname, '../migrations', file), 'utf8');
    await pool.query(sql);
  }
  console.log('Migrations OK');
}
