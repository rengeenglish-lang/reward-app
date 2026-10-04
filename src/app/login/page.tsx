import Link from 'next/link';
import Image from 'next/image';
import { Home } from 'lucide-react';
import { redirect } from 'next/navigation';
import { currentTutor } from '@/lib/session';
import { signIn } from '../actions';
import StudentBubbles from '../student-bubbles';
import { getPublicStudentBubbles } from '@/lib/public-students';

export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  if (await currentTutor()) redirect('/classroom');
  const {error}=await searchParams;
  const students = await getPublicStudentBubbles();
  return <main className="login-page">
    <Link className="site-home-button login-home-button" href="/" aria-label="Go to home page"><Home size={16}/><span>Home</span></Link>
    <StudentBubbles students={students} label="Student name bubbles on the sign-in page" />
    <section className="login-card">
      <div className="login-welcome-panel"><Link href="/" className="login-welcome-brand"><span>✦</span> Ezgili Champs</Link><div className="login-rainbow" aria-hidden="true">🌈</div><p className="login-welcome-eyebrow">YOUR HAPPY CLASSROOM AWAITS</p><h1>Big smiles.<br/>Brave tries.<br/><em>Bright days.</em></h1><p>Every kind act and little win deserves a cheer. Come on in and make today amazing!</p><div className="login-welcome-bubbles" aria-hidden="true"><span>⭐</span><span>💛</span><span>🎈</span><span>🌼</span></div></div>
      <div className="login-form-panel"><div className="login-brand"><Image src="/brand/ezgili-champs-mascot.png" alt="" width={40} height={40}/><span>Ezgili Champs</span></div><p className="eyebrow">WELCOME BACK</p><h2>Let’s get started!</h2><p className="login-intro">Sign in to continue to your tutor dashboard.</p>{error&&<p className="login-error" role="alert">Email or password didn’t match. Please try again.</p>}<form action={signIn}><label htmlFor="email">Tutor email</label><input id="email" name="email" type="email" autoComplete="username" required/><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required/><button className="primary-btn" type="submit">Sign in <span>→</span></button></form><small className="login-foot">Tutor access only · Ask your administrator if you need help.</small><Link className="login-home-link" href="/">← Back to welcome page</Link></div>
    </section>
  </main>;
}
