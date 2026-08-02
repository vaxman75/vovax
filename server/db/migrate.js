import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const sql = readFileSync(join(__dirname, '../migrations/001_init.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migrations OK');
}
