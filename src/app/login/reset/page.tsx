import { createHash } from 'node:crypto';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sqlClient } from '@/lib/db';
import { currentTutor } from '@/lib/session';
import { resetWithToken } from '../reset-actions';
import LoginShell from '../shell';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, string> = {
  short: 'Choose a new password with at least 8 characters.',
  mismatch: 'The two new passwords do not match.',
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  if (await currentTutor()) redirect('/classroom');
  const { token, error } = await searchParams;
  let valid = false;
  if (token && token.length >= 20 && token.length <= 200) {
    const rows = await sqlClient()`SELECT 1 FROM tutor_password_reset_tokens
      WHERE token_hash=${createHash('sha256').update(token).digest('hex')} AND used_at IS NULL AND expires_at > now() LIMIT 1`;
    valid = rows.length > 0;
  }
  if (!valid) {
    return <LoginShell eyebrow="LINK PROBLEM" title="This reset link has expired" intro="Reset links work once and only for 1 hour.">
      <Link className="primary-btn" href="/login/forgot" style={{display:'inline-block',textAlign:'center'}}>Ask for a new link <span>→</span></Link>
    </LoginShell>;
  }
  return <LoginShell eyebrow="NEW PASSWORD" title="Choose a new password" intro="Use at least 8 characters. You will be signed out everywhere else.">
    {error && MESSAGES[error] && <p className="login-error" role="alert">{MESSAGES[error]}</p>}
    <form action={resetWithToken}>
      <input type="hidden" name="token" value={token}/>
      <label htmlFor="new-password">New password</label>
      <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required/>
      <label htmlFor="new-confirm">Confirm new password</label>
      <input id="new-confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required/>
      <button className="primary-btn" type="submit">Save password <span>→</span></button>
    </form>
  </LoginShell>;
}
