import { readFile } from 'node:fs/promises';
import { Pool } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Set DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL.');
const pool = new Pool({ connectionString });
try {
  const migration = await readFile(new URL('../db/migrations/0001_initial.sql', import.meta.url), 'utf8');
  await pool.query(migration);
  console.log('Applied 0001_initial.sql');
} finally { await pool.end(); }
