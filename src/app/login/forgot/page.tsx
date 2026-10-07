import { redirect } from 'next/navigation';
import { currentTutor } from '@/lib/session';
import { maskEmail, resetConfig } from '@/lib/password-reset';
import { requestReset, resetWithKey } from '../reset-actions';
import LoginShell from '../shell';

const MESSAGES: Record<string, string> = {
  invalid: 'Enter a valid email address.',
  denied: 'The email or recovery key did not match. Please try again.',
  short: 'Choose a new password with at least 8 characters.',
  mismatch: 'The two new passwords do not match.',
  locked: 'Too many attempts. Wait 15 minutes and try again.',
  unavailable: 'Password reset is not switched on yet.',
};

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  if (await currentTutor()) redirect('/classroom');
  const { error, sent } = await searchParams;
  const cfg = resetConfig();
  return <LoginShell eyebrow="FORGOT YOUR PASSWORD?" title="Let’s get you back in" intro="Choose a way to set a new tutor password.">
    {error && MESSAGES[error] && <p className="login-error" role="alert">{MESSAGES[error]}</p>}
    {sent && <p className="login-intro" role="status"><strong>Check your email.</strong> If reset email is set up, a reset link is on its way. It works for 1 hour. Look in spam if you do not see it.</p>}
    {cfg.email && <form action={requestReset}>
      {cfg.to
        ? <p className="login-intro">We will email a reset link to <strong>{maskEmail(cfg.to)}</strong>.</p>
        : <><label htmlFor="reset-email">Tutor email</label>
          <input id="reset-email" name="email" type="email" autoComplete="username" required/></>}
      <button className="primary-btn" type="submit">Email me a reset link <span>→</span></button>
    </form>}
    {cfg.key && <details open={!cfg.email} style={{marginTop: cfg.email ? 18 : 0}}>
      <summary style={{cursor:'pointer',fontWeight:700,marginBottom:8}}>Use the recovery key instead</summary>
      <form action={resetWithKey}>
        <label htmlFor="key-email">Tutor email</label>
        <input id="key-email" name="email" type="email" autoComplete="username" required/>
        <label htmlFor="key-value">Recovery key</label>
        <input id="key-value" name="key" type="password" autoComplete="off" required/>
        <label htmlFor="key-password">New password</label>
        <input id="key-password" name="password" type="password" autoComplete="new-password" minLength={8} required/>
        <label htmlFor="key-confirm">Confirm new password</label>
        <input id="key-confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required/>
        <button className="primary-btn" type="submit">Set new password <span>→</span></button>
      </form>
    </details>}
    {!cfg.email && !cfg.key && <div className="login-intro">
      <p><strong>Password reset is not set up yet.</strong> The site owner can switch it on in the Vercel project settings, under Environment Variables:</p>
      <ul>
        <li><code>PASSWORD_RESET_KEY</code>: a long random secret (at least 16 characters) used as a recovery key, or</li>
        <li><code>RESEND_API_KEY</code> and <code>RESET_EMAIL_FROM</code>: to email a reset link.</li>
      </ul>
      <p>Redeploy after saving, then come back to this page.</p>
    </div>}
  </LoginShell>;
}
