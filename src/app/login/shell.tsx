import Link from 'next/link';
import Image from 'next/image';

/** Card layout shared by the password-reset pages, matching the sign-in page. */
export default function LoginShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <main className="login-page">
    <section className="login-card">
      <div className="login-welcome-panel"><Link href="/" className="login-welcome-brand"><span>✦</span> Ezgili Champs</Link><div className="login-rainbow" aria-hidden="true">🌈</div><p className="login-welcome-eyebrow">YOUR HAPPY CLASSROOM AWAITS</p><h1>Big smiles.<br/>Brave tries.<br/><em>Bright days.</em></h1><p>Every kind act and little win deserves a cheer. Come on in and make today amazing!</p></div>
      <div className="login-form-panel"><Link href="/" className="login-brand" aria-label="Ezgili Champs home"><Image src="/brand/ezgili-champs-mascot.png" alt="" width={40} height={40}/><span>Ezgili Champs</span></Link><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="login-intro">{intro}</p>{children}<Link className="login-home-link" href="/login">← Back to sign in</Link></div>
    </section>
  </main>;
}
