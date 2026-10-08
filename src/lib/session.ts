import 'server-only';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { sqlClient } from './db';

const COOKIE = 'brightsteps_session';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export async function createSession(tutorId: string) {
  const token = randomBytes(32).toString('base64url');
  const sql = sqlClient();
  await sql`INSERT INTO tutor_sessions (token_hash, tutor_id, expires_at) VALUES (${hash(token)}, ${tutorId}, now() + interval '14 days')`;
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 14 });
}

export async function currentTutor() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const sql = sqlClient();
  const rows = await sql`SELECT t.id, t.email, t.display_name, t.timezone FROM tutor_sessions s JOIN tutor t ON t.id = s.tutor_id WHERE s.token_hash = ${hash(token)} AND s.expires_at > now() LIMIT 1`;
  if (!rows.length) return null;
  await sql`UPDATE tutor_sessions SET last_seen_at = now() WHERE token_hash = ${hash(token)}`;
  return rows[0] as { id: string; email: string; display_name: string; timezone: string };
}

export async function requireTutor() {
  const tutor = await currentTutor();
  if (!tutor) throw new Error('Authentication required');
  return tutor;
}

export async function revokeSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await sqlClient()`DELETE FROM tutor_sessions WHERE token_hash = ${hash(token)}`;
  jar.delete(COOKIE);
}
