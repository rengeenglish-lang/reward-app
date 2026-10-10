'use client';

import { useEffect } from 'react';
import { dismissBallot, prepareBallotSound, useBallotAlert } from './ballot-alert';

/** The full-screen "ballot time" alert. Mounted once in the root layout so it shows over every page. Click anywhere to turn it off. */
export default function BallotAlert() {
  const alert = useBallotAlert();

  useEffect(() => {
    const unlock = () => { prepareBallotSound(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  useEffect(() => {
    if (!alert.active) return;
    const onKey = () => dismissBallot();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alert.active]);

  if (!alert.active) return null;
  return (
    <div className="ballot-alert" role="alertdialog" aria-modal="true" aria-label="It's ballot time, Champs! Click anywhere to turn this off." onClick={dismissBallot}>
      <div className="ballot-lights ballot-lights-top" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} className={i % 2 ? 'amber' : 'red'} />)}</div>
      <div className="ballot-lights ballot-lights-bottom" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} className={i % 2 ? 'red' : 'amber'} />)}</div>
      <div className="ballot-lights ballot-lights-left" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} className={i % 2 ? 'amber' : 'red'} />)}</div>
      <div className="ballot-lights ballot-lights-right" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} className={i % 2 ? 'red' : 'amber'} />)}</div>
      <div className="ballot-alert-card">
        <span className="ballot-alert-emoji" aria-hidden="true">🗳️</span>
        <h1>IT’S BALLOT TIME, CHAMPS!</h1>
        {alert.classroom && <p>{alert.classroom} · every student votes quietly and secretly</p>}
        <small>Click anywhere to turn this off</small>
      </div>
    </div>
  );
}
