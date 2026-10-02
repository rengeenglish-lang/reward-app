import argon2 from 'argon2';
import { neon } from '@neondatabase/serverless';

const email = process.env.TUTOR_EMAIL?.trim().toLowerCase();
const password = process.env.TUTOR_INITIAL_PASSWORD;
const displayName = process.env.TUTOR_DISPLAY_NAME?.trim() || 'Class tutor';
if (!process.env.DATABASE_URL || !email || !password) throw new Error('Set DATABASE_URL, TUTOR_EMAIL, and TUTOR_INITIAL_PASSWORD for this one-time command.');
if (password.length < 12) throw new Error('Initial password must be at least 12 characters.');
const sql = neon(process.env.DATABASE_URL);
const count = await sql`SELECT count(*)::int AS count FROM tutor`;
if (Number(count[0].count) > 0) throw new Error('A tutor is already provisioned. Use the settings flow to change credentials.');
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
await sql`INSERT INTO tutor(email,password_hash,display_name) VALUES(${email},${passwordHash},${displayName})`;
console.log(`Tutor provisioned for ${email}. Remove TUTOR_INITIAL_PASSWORD from the environment now.`);
