import argon2 from 'argon2';
import { neon } from '@neondatabase/serverless';

// Adds a tutor account. Run it once per account; existing accounts are never changed.
const email = process.env.TUTOR_EMAIL?.trim().toLowerCase();
const password = process.env.TUTOR_INITIAL_PASSWORD;
const displayName = process.env.TUTOR_DISPLAY_NAME?.trim() || 'Class tutor';
if (!process.env.DATABASE_URL || !email || !password) throw new Error('Set DATABASE_URL, TUTOR_EMAIL, and TUTOR_INITIAL_PASSWORD for this one-time command.');
if (password.length < 8) throw new Error('Initial password must be at least 8 characters.');
const sql = neon(process.env.DATABASE_URL);
const existing = await sql`SELECT 1 FROM tutor WHERE email=${email}`;
if (existing.length) throw new Error(`A tutor with ${email} already exists. Use "Forgot password?" on the sign-in page to change its password.`);
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
await sql`INSERT INTO tutor(email,password_hash,display_name) VALUES(${email},${passwordHash},${displayName})`;
console.log(`Tutor added for ${email}. Remove TUTOR_INITIAL_PASSWORD from the environment now, then change the password after signing in.`);
