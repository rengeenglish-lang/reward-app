'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { kindnessBadges, readStudentFun } from './classroom-fun';

export type ProfileStudent = { id: string; name: string; avatar: string; streak: number; points: number; possible: number };

const shortName = (name: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.length < 2 ? p[0] || name : `${p[0]} ${p.slice(1).map((x) => `${Array.from(x)[0]?.toLocaleUpperCase() || ''}.`).join(' ')}`;
};

/** One student's own page: today's points, badges and every certificate they have earned. Opens when a student is clicked. */
export default function StudentProfile({ student, classroomId, classroom, onClose }: { student: ProfileStudent; classroomId: string; classroom: string; onClose: () => void }) {
  const [fun, setFun] = useState<{ badges: string[]; certificates: { date: string; classroom: string }[] }>({ badges: [], certificates: [] });
  const [printing, setPrinting] = useState<number | null>(null);

  useEffect(() => {
    const read = () => setFun(readStudentFun(classroomId, student.id));
    read();
    window.addEventListener('ezgili-classroom-fun-updated', read);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('ezgili-classroom-fun-updated', read); window.removeEventListener('keydown', onKey); };
  }, [classroomId, student.id, onClose]);

  const print = (index: number) => {
    setPrinting(index);
    document.body.classList.add('printing-cert');
    window.setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-cert');
      setPrinting(null);
    }, 60);
  };

  return (
    <div className="sp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="sp-card" role="dialog" aria-modal="true" aria-labelledby="sp-title">
        <button className="sp-close" onClick={onClose} aria-label="Close student page"><X size={20} /></button>
        <div className="sp-head">
          <span className="sp-avatar" aria-hidden="true">{student.avatar}</span>
          <div>
            <h2 id="sp-title">{shortName(student.name)}</h2>
            <p>{classroom}</p>
          </div>
        </div>
        <div className="sp-stats">
          <span className="chip-stat">⭐ Today <b>{student.points}</b>/{student.possible}</span>
          <span className="chip-stat">🔥 Streak <b>{student.streak}</b> {student.streak === 1 ? 'day' : 'days'}</span>
          <span className="chip-stat">🏅 Certificates <b>{fun.certificates.length}</b></span>
        </div>

        <h3 className="sp-title">Certificates</h3>
        {fun.certificates.length === 0 ? (
          <p className="sp-empty">No certificates yet. Make one in Fun &amp; focus, then Certificate, and it will appear here.</p>
        ) : (
          <ul className="sp-certs">
            {fun.certificates.map((c, i) => (
              <li key={`${c.date}-${i}`} className={`sp-cert${printing === i ? ' print-cert' : ''}`}>
                <span className="sp-cert-stars" aria-hidden="true">✦ ✿ ✦</span>
                <small>EZGILI CHAMPS PRESENTS</small>
                <strong>Superstar Certificate</strong>
                <p>This certificate celebrates <b>{shortName(student.name)}</b> for bringing kindness, courage and wonderful effort to <b>{c.classroom}</b>.</p>
                <footer><span>{new Date(c.date + 'T12:00:00').toLocaleDateString()}</span><button type="button" className="sp-print" onClick={() => print(i)}>🖨️ Print</button></footer>
              </li>
            ))}
          </ul>
        )}

        <h3 className="sp-title">Kindness badges</h3>
        {fun.badges.length === 0 ? (
          <p className="sp-empty">No badges yet.</p>
        ) : (
          <ul className="sp-badges">
            {fun.badges.map((name) => <li key={name}><span aria-hidden="true">{kindnessBadges.find(([, n]) => n === name)?.[0] ?? '⭐'}</span> {name}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
