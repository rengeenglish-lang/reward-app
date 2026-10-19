import Link from 'next/link';
import Image from 'next/image';
import StudentBubbles from './student-bubbles';
import { getPublicStudentBubbles } from '@/lib/public-students';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const students = await getPublicStudentBubbles();
  return <main className="landing-page">
    <div className="landing-sunburst landing-sunburst-one" aria-hidden="true">✦</div>
    <div className="landing-sunburst landing-sunburst-two" aria-hidden="true">✿</div>
    <div className="landing-orbit landing-orbit-one" aria-hidden="true"/>
    <div className="landing-orbit landing-orbit-two" aria-hidden="true"/>
    <header className="landing-header"><Link className="landing-brand" href="/" aria-label="Class Champs home"><Image src="/brand/class-champs-mascot.png" alt="" width={38} height={38}/><span>Class Champs</span></Link><span className="landing-header-note">Little wins. Big smiles.</span></header>
    <StudentBubbles students={students} label="Student name bubbles on the welcome page" showToggle />
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-sticker landing-sticker-left" aria-hidden="true"><span>🌟</span><small>KINDNESS<br/>COUNTS!</small></div>
      <div className="landing-sticker landing-sticker-right" aria-hidden="true"><span>🎈</span><small>YOU’VE<br/>GOT THIS!</small></div>
      <div className="landing-sparkle landing-sparkle-a" aria-hidden="true">✦</div><div className="landing-sparkle landing-sparkle-b" aria-hidden="true">✧</div>
      <div className="landing-hero-card">
        <div className="landing-pill"><span/> YOUR HAPPY CLASSROOM STARTS HERE</div>
        <Image className="landing-logo" src="/brand/class-champs.png" alt="Class Champs — cheerful star mascot" width={300} height={300} priority />
        <h1 id="landing-title">Are you ready?</h1>
        <p>Big cheers for brave tries, kind hearts, and every little win.</p>
        <Link className="landing-signin" href="/login">Sign in <span aria-hidden="true">→</span></Link>
        <div className="landing-cheer"><span>⭐</span><span>🌈</span><span>💛</span> A brighter day is one click away!</div>
      </div>
      <div className="landing-floating landing-floating-left" aria-hidden="true">+1 <span>kindness</span></div>
      <div className="landing-floating landing-floating-right" aria-hidden="true">✨ SUPERSTAR ✨</div>
    </section>
    <footer className="landing-footer"><span>LEARN <i>✦</i> TRY <i>✦</i> SHINE</span><span>Made for classrooms full of possibility</span></footer>
  </main>;
}
