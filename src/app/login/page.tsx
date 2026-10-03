import { redirect } from 'next/navigation';
import { currentTutor } from '@/lib/session';
import { signIn } from '../actions';

export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  if (await currentTutor()) redirect('/');
  const {error}=await searchParams;
  return <main className="login-page"><section className="login-card"><div className="brand login-brand"><div className="brand-mark">✦</div><span>Ezgili Champs</span></div><p className="eyebrow">WELCOME BACK</p><h1>Your classroom,<br/><em>one kind act at a time.</em></h1><p className="login-intro">Sign in to continue to your tutor dashboard.</p>{error&&<p className="login-error" role="alert">Email or password didn’t match. Please try again.</p>}<form action={signIn}><label htmlFor="email">Tutor email</label><input id="email" name="email" type="email" autoComplete="username" required/><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required/><button className="primary-btn" type="submit">Sign in <span>→</span></button></form><small className="login-foot">Tutor access only · Ask your administrator if you need help.</small></section><div className="login-art" aria-hidden="true"><div>🌻</div><span>Small wins<br/>add up!</span><i>✦</i></div></main>;
}
