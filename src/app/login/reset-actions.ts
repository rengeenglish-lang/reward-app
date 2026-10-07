'use server';

import { redirect } from 'next/navigation';
import argon2 from 'argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { RESET_TOKEN_MINUTES, resetConfig, sendResetEmail, siteOrigin } from '@/lib/password-reset';

const digest = (value: string) => createHash('sha256').update(value).digest();
const newPassword = z.string().min(8).max(200);
const KEY_THROTTLE = 'reset:key';

type Sql = ReturnType<typeof sqlClient>;

async function isLocked(sql: Sql, key: string) {
  const rows = await sql`SELECT locked_until > now() AS locked FROM tutor_login_attempts WHERE email=${key}`;
  return Boolean(rows[0]?.locked);
}

/** Same lockout rule as sign-in: 4 misses inside 15 minutes lock the route for 15 minutes. */
async function recordMiss(sql: Sql, key: string) {
  await sql`INSERT INTO tutor_login_attempts(email,attempts,window_started_at) VALUES(${key},1,now())
    ON CONFLICT(email) DO UPDATE SET
    attempts=CASE WHEN tutor_login_attempts.window_started_at < now()-interval '15 minutes' THEN 1 ELSE tutor_login_attempts.attempts+1 END,
    window_started_at=CASE WHEN tutor_login_attempts.window_started_at < now()-interval '15 minutes' THEN now() ELSE tutor_login_attempts.window_started_at END,
    locked_until=CASE WHEN tutor_login_attempts.window_started_at < now()-interval '15 minutes' THEN NULL WHEN tutor_login_attempts.attempts >= 4 THEN now()+interval '15 minutes' ELSE tutor_login_attempts.locked_until END`;
}

async function setPassword(sql: Sql, tutorId: string, password: string) {
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  await sql`UPDATE tutor SET password_hash=${hash},updated_at=now() WHERE id=${tutorId}`;
  await sql`DELETE FROM tutor_sessions`;
  await sql`DELETE FROM tutor_password_reset_tokens WHERE tutor_id=${tutorId}`;
}

/** Step 1 of the emailed link. Always answers the same way so the page never reveals whether the email exists. */
export async function requestReset(formData: FormData) {
  const cfg = resetConfig();
  if (!cfg.email) redirect('/login/forgot?error=unavailable');
  // With a fixed inbox the form needs no email: the single tutor account is reset and the link goes to RESET_EMAIL_TO.
  const email = z.string().email().safeParse(formData.get('email'));
  if (!cfg.to && !email.success) redirect('/login/forgot?error=invalid');
  const address = cfg.to || (email.success ? email.data.toLowerCase() : '');
  const throttleKey = cfg.to ? 'reset:request' : `reset:${address}`;
  const sql = sqlClient();
  if (!(await isLocked(sql, throttleKey))) {
    await recordMiss(sql, throttleKey); // counts every request, so mail cannot be flooded
    const rows = cfg.to
      ? await sql`SELECT t.id, r.requested_at > now()-interval '60 seconds' AS recent
          FROM tutor t LEFT JOIN tutor_password_reset_tokens r ON r.tutor_id=t.id LIMIT 1`
      : await sql`SELECT t.id, r.requested_at > now()-interval '60 seconds' AS recent
          FROM tutor t LEFT JOIN tutor_password_reset_tokens r ON r.tutor_id=t.id WHERE t.email=${address} LIMIT 1`;
    if (rows.length && !rows[0].recent) {
      const token = randomBytes(32).toString('base64url');
      await sql`INSERT INTO tutor_password_reset_tokens(tutor_id,token_hash,expires_at,requested_at,used_at)
        VALUES(${rows[0].id},${digest(token).toString('hex')},now()+${`${RESET_TOKEN_MINUTES} minutes`}::interval,now(),NULL)
        ON CONFLICT(tutor_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,expires_at=EXCLUDED.expires_at,requested_at=now(),used_at=NULL`;
      await sendResetEmail(address, `${await siteOrigin()}/login/reset?token=${encodeURIComponent(token)}`);
    }
  }
  redirect('/login/forgot?sent=1');
}

/** Step 2 of the emailed link. */
export async function resetWithToken(formData: FormData) {
  const token = z.string().min(20).max(200).safeParse(formData.get('token'));
  const password = newPassword.safeParse(formData.get('password'));
  if (!token.success) redirect('/login/reset?error=expired');
  const back = `/login/reset?token=${encodeURIComponent(token.data)}`;
  if (!password.success) redirect(`${back}&error=short`);
  if (password.data !== formData.get('confirm')) redirect(`${back}&error=mismatch`);
  const sql = sqlClient();
  const rows = await sql`SELECT tutor_id FROM tutor_password_reset_tokens
    WHERE token_hash=${digest(token.data).toString('hex')} AND used_at IS NULL AND expires_at > now() LIMIT 1`;
  if (!rows.length) redirect('/login/reset?error=expired');
  await setPassword(sql, String(rows[0].tutor_id), password.data);
  redirect('/login?reset=1');
}

/** Reset with the recovery key kept in the project settings. */
export async function resetWithKey(formData: FormData) {
  const { key } = resetConfig();
  if (!key) redirect('/login/forgot?error=unavailable');
  const email = z.string().email().safeParse(formData.get('email'));
  const typedKey = z.string().min(1).max(300).safeParse(formData.get('key'));
  const password = newPassword.safeParse(formData.get('password'));
  if (!email.success || !typedKey.success) redirect('/login/forgot?error=denied');
  if (!password.success) redirect('/login/forgot?error=short');
  if (password.data !== formData.get('confirm')) redirect('/login/forgot?error=mismatch');
  const sql = sqlClient();
  if (await isLocked(sql, KEY_THROTTLE)) redirect('/login/forgot?error=locked');
  const rows = await sql`SELECT id FROM tutor WHERE email=${email.data.toLowerCase()} LIMIT 1`;
  const keyMatches = timingSafeEqual(digest(typedKey.data), digest(key));
  if (!rows.length || !keyMatches) {
    await recordMiss(sql, KEY_THROTTLE);
    redirect('/login/forgot?error=denied');
  }
  await setPassword(sql, String(rows[0].id), password.data);
  await sql`DELETE FROM tutor_login_attempts WHERE email IN (${KEY_THROTTLE},${email.data.toLowerCase()})`;
  redirect('/login?reset=1');
}
