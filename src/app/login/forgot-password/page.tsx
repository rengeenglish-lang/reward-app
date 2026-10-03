import { redirect } from 'next/navigation';
import { currentTutor } from '@/lib/session';
import { requestPasswordReset } from '../../actions';

export default async function ForgotPasswordPage({searchParams}:{searchParams:Promise<{sent?:string;setup?:string;error?:string}>}) {
  if(await currentTutor()) redirect('/');
  const {sent,setup,error}=await searchParams;
  return <main className="login-page"><section className="login-card"><div className="brand login-brand"><div className="brand-mark">✦</div><span>Ezgili Champs</span></div><p className="eyebrow">PASSWORD HELP</p><h1>Let’s get you<br/><em>back in.</em></h1><p className="login-intro">Enter your tutor email and we’ll send a secure password reset link.</p>{sent&&<p className="login-success" role="status">If that email belongs to a tutor account, a reset link is on its way. Check your inbox.</p>}{setup&&<p className="login-error" role="alert">Password reset email isn’t available yet. Please contact your administrator.</p>}{error&&<p className="login-error" role="alert">Enter a valid email address and try again.</p>}<form action={requestPasswordReset}><label htmlFor="email">Tutor email</label><input id="email" name="email" type="email" autoComplete="email" required/><button className="primary-btn" type="submit">Send reset link <span>→</span></button></form><a className="forgot-password-link" href="/login">Back to sign in</a></section><div className="login-art" aria-hidden="true"><div>🌻</div><span>Small wins<br/>add up!</span><i>✦</i></div></main>;
}
