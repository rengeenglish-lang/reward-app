'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export type RandomStudent = { id: string; name: string; avatar: string };

/**
 * Student randomizer: one big button that picks a student at random, shown large so the whole class can see it.
 * "Fair" mode (on by default) does not pick the same student again until everyone has had a turn.
 */
export default function StudentRandomizer({ classroom, students, onClose, onAward }: { classroom: string; students: RandomStudent[]; onClose: () => void; onAward: (id: string) => void }) {
  const [shown, setShown] = useState<RandomStudent | null>(null);
  const [chosen, setChosen] = useState<RandomStudent | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [fair, setFair] = useState(true);
  const [done, setDone] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const remaining = fair ? students.filter((s) => !done.includes(s.id)) : students;
  const pool = remaining.length ? remaining : students;

  const pick = () => {
    if (spinning || !students.length) return;
    // A new round starts when everyone has had a turn.
    const roundOver = fair && remaining.length === 0;
    const from = roundOver ? students : pool;
    const winner = from[Math.floor(Math.random() * from.length)];
    if (roundOver) setDone([]);
    setChosen(null);
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from.length === 1) { setShown(winner); setChosen(winner); setDone((d) => (fair ? [...(roundOver ? [] : d), winner.id] : d)); return; }
    setSpinning(true);
    let step = 0;
    const total = 18;
    const tick = () => {
      step += 1;
      if (step >= total) {
        setShown(winner); setChosen(winner); setSpinning(false);
        setDone((d) => (fair ? [...(roundOver ? [] : d), winner.id] : d));
        return;
      }
      setShown(from[Math.floor(Math.random() * from.length)]);
      timer.current = setTimeout(tick, 50 + step * 8);
    };
    tick();
  };

  const left = fair ? Math.max(0, students.length - done.length) : students.length;

  return (
    <div className="rz-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="rz-card" role="dialog" aria-modal="true" aria-label="Student randomizer">
        <button type="button" className="rz-close" aria-label="Close the student randomizer" onClick={onClose}><X size={22} /></button>
        <p className="rz-kicker">🎲 STUDENT RANDOMIZER · {classroom.toUpperCase()}</p>
        <div className={`rz-stage${spinning ? ' spinning' : ''}${chosen ? ' picked' : ''}`} role="status" aria-live="polite">
          {students.length === 0 ? <p className="rz-empty">There are no students to pick from yet.</p> : shown ? (
            <>
              <span className="rz-avatar" aria-hidden="true">{shown.avatar}</span>
              <strong className="rz-name">{shown.name}</strong>
              <small>{spinning ? 'Picking…' : 'You’re up next!'}</small>
            </>
          ) : (
            <>
              <span className="rz-avatar" aria-hidden="true">🎲</span>
              <strong className="rz-name">Who’s up next?</strong>
              <small>{students.length} {students.length === 1 ? 'student is' : 'students are'} in the draw</small>
            </>
          )}
        </div>
        <div className="rz-actions">
          <button type="button" className="primary-btn rz-pick" onClick={pick} disabled={spinning || students.length === 0}>{spinning ? 'Picking…' : chosen ? '🎲 Pick another student' : '🎲 Pick a student'}</button>
          {chosen && !spinning && <button type="button" className="outline-btn" onClick={() => onAward(chosen.id)}>🏅 Give {chosen.name.split(' ')[0]} points</button>}
        </div>
        <label className="rz-fair"><input type="checkbox" checked={fair} onChange={(event) => { setFair(event.target.checked); setDone([]); }} /> <span>Fair: don’t repeat anyone until everyone has had a turn</span></label>
        {fair && students.length > 0 && <p className="rz-left">{left === 0 ? 'Everyone has had a turn. The next pick starts a new round.' : `${left} ${left === 1 ? 'student' : 'students'} still to go this round`}</p>}
      </section>
    </div>
  );
}
