'use client';

import { useState } from 'react';

type StudentBubble = { id: string; name: string; avatar: string };

export default function StudentBubbles({ students, label = 'Our classroom champs' }: { students: StudentBubble[]; label?: string }) {
  const [popping, setPopping] = useState<Set<string>>(() => new Set());
  const [popped, setPopped] = useState<Set<string>>(() => new Set());

  function pop(id: string) {
    if (popping.has(id) || popped.has(id)) return;
    setPopping(current => new Set(current).add(id));
    window.setTimeout(() => {
      setPopped(current => new Set(current).add(id));
    }, 420);
  }

  if (!students.length) return null;
  const remaining = students.filter(student => !popped.has(student.id));

  return <section className="student-bubble-section" aria-label={label}>
    <div className="student-bubble-heading"><span aria-hidden="true">✨</span><strong>Our Champs are here!</strong><small>Tap a name bubble to pop it</small></div>
    <div className="student-bubble-field" aria-live="polite">
      {remaining.map((student, index) => <button
        key={student.id}
        type="button"
        className={`student-name-bubble student-bubble-${index % 6}${popping.has(student.id) ? ' is-popping' : ''}`}
        onClick={() => pop(student.id)}
        aria-label={`Pop ${student.name}'s bubble`}
        disabled={popping.has(student.id)}
        style={{ '--bubble-delay': `${(index % 7) * -0.28}s` } as React.CSSProperties}
      >
        <span className="student-bubble-avatar" aria-hidden="true">{student.avatar}</span>
        <span className="student-bubble-name">{student.name}</span>
        <span className="student-bubble-burst" aria-hidden="true">✦　✧　✦</span>
      </button>)}
      {!remaining.length && <p className="student-bubble-all-popped">Hooray for everyone! 🎉</p>}
    </div>
  </section>;
}
