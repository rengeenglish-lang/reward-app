import Link from 'next/link';
import { Home } from 'lucide-react';

export default function LandingPage() {
  return <main className="landing-page">
    <div className="landing-sunburst landing-sunburst-one" aria-hidden="true">✦</div>
    <div className="landing-sunburst landing-sunburst-two" aria-hidden="true">✿</div>
    <div className="landing-orbit landing-orbit-one" aria-hidden="true"/>
    <div className="landing-orbit landing-orbit-two" aria-hidden="true"/>
    <header className="landing-header"><Link className="landing-brand" href="/"><span>✦</span> Ezgili Champs</Link><span className="landing-header-note">Little wins. Big smiles.</span><Link className="site-home-button public-home-button" href="/" aria-label="Go to home page"><Home size={16}/><span>Home</span></Link></header>
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-sticker landing-sticker-left" aria-hidden="true"><span>🌟</span><small>KINDNESS<br/>COUNTS!</small></div>
      <div className="landing-sticker landing-sticker-right" aria-hidden="true"><span>🎈</span><small>YOU’VE<br/>GOT THIS!</small></div>
      <div className="landing-sparkle landing-sparkle-a" aria-hidden="true">✦</div><div className="landing-sparkle landing-sparkle-b" aria-hidden="true">✧</div>
      <div className="landing-hero-card">
        <div className="landing-pill"><span/> YOUR HAPPY CLASSROOM STARTS HERE</div>
        <div className="landing-wordmark"><span>Ezgili</span><strong>Champs!</strong></div>
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
