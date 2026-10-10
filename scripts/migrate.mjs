import { readFile } from 'node:fs/promises';
import { Pool } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Set DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL.');
const pool = new Pool({ connectionString });
try {
  const client=await pool.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const tutorTable=await client.query("SELECT to_regclass('public.tutor') AS name");
    if(tutorTable.rows[0].name) await client.query("INSERT INTO schema_migrations(name) VALUES('0001_initial.sql') ON CONFLICT DO NOTHING");
    for(const name of ['0001_initial.sql','0002_tutor_password_resets.sql','0003_student_avatar_choices.sql','0004_shared_classroom_material.sql','0005_multiple_tutors.sql','0006_books.sql','0007_student_books.sql','0008_student_ballots.sql','0009_teacher_notes.sql','0010_student_analysis.sql','0011_department_activities.sql','0012_unit_plans.sql']) {
      const applied=await client.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name]);
      if(applied.rowCount) continue;
      const migration=await readFile(new URL(`../db/migrations/${name}`,import.meta.url),'utf8');
      await client.query('BEGIN');
      try { await client.query(migration); await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]); await client.query('COMMIT'); }
      catch(error) { await client.query('ROLLBACK'); throw error; }
      console.log(`Applied ${name}`);
    }
  } finally { client.release(); }
} finally { await pool.end(); }
