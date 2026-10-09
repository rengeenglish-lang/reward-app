'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';

export type RollStudent = { id: string; name: string; avatar: string };

const shortName = (name: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.length < 2 ? p[0] || name : `${p[0]} ${p.slice(1).map((x) => `${Array.from(x)[0]?.toLocaleUpperCase() || ''}.`).join(' ')}`;
};

/**
 * Today's roll call for one classroom. It is saved in this browser per classroom and per day, so every tool
 * on the site can ask "who is here?" and the answer survives a refresh.
 */
export function useRollCall(classroomId: string, today: string) {
  const key = `ezgili-rollcall-${today}-${classroomId}`;
  const [absent, setAbsent] = useState<string[]>([]);
  const [taken, setTaken] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as { absent?: string[] };
        setAbsent(Array.isArray(saved.absent) ? saved.absent : []);
        setTaken(true);
        return;
      }
    } catch { /* storage unavailable: start with everyone here */ }
    setAbsent([]);
    setTaken(false);
  }, [key]);

  const save = useCallback((next: string[]) => {
    setAbsent(next);
    setTaken(true);
    try { localStorage.setItem(key, JSON.stringify({ absent: next, at: Date.now() })); } catch { /* ignore */ }
  }, [key]);

  const clear = useCallback(() => {
    setAbsent([]);
    setTaken(false);
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }, [key]);

  return { absent, taken, save, clear };
}

export function RollCallModal({ classroom, students, absent, taken, onChange, onClear, onClose }: {
  classroom: string;
  students: RollStudent[];
  absent: string[];
  taken: boolean;
  onChange: (absent: string[]) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const away = new Set(absent);
  const here = students.filter((s) => !away.has(s.id)).length;
  const toggle = (id: string) => onChange(away.has(id) ? absent.filter((x) => x !== id) : [...absent, id]);

  return (
    <div className="rc-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="rc-card" role="dialog" aria-modal="true" aria-labelledby="rc-title">
        <button className="rc-close" onClick={onClose} aria-label="Close roll call"><X size={20} /></button>
        <div className="rc-head">
          <span className="rc-emoji" aria-hidden="true">📋</span>
          <div>
            <h2 id="rc-title">Roll call · {classroom}</h2>
            <p>Tap a student to mark them away. The picker, reward draw and book tools will only use students who are here.</p>
          </div>
        </div>
        <div className="rc-bar">
          <span className="rc-count"><b>{here}</b> here · <b>{students.length - here}</b> away · {students.length} in class</span>
          <div className="rc-actions">
            <button type="button" className="rc-btn good" onClick={() => onChange([])}>✅ Everyone is here</button>
            <button type="button" className="rc-btn" onClick={() => onChange(students.map((s) => s.id))}>🏠 Everyone is away</button>
            {taken && <button type="button" className="rc-btn quiet" onClick={onClear}>Reset</button>}
          </div>
        </div>
        {students.length === 0 ? <p className="rc-empty">Add students to this classroom to take roll call.</p> : (
          <ul className="rc-grid">
            {students.map((s) => {
              const isAway = away.has(s.id);
              return (
                <li key={s.id}>
                  <button type="button" className={`rc-student${isAway ? ' away' : ' here'}`} aria-pressed={!isAway} onClick={() => toggle(s.id)}>
                    <span className="rc-avatar" aria-hidden="true">{s.avatar}</span>
                    <span className="rc-name">{shortName(s.name)}</span>
                    <span className="rc-state">{isAway ? '🏠 Away' : '✅ Here'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="rc-foot">
          <span>{taken ? 'Saved on this device for today.' : 'Not taken yet. Everyone counts as here until you change something.'}</span>
          <button type="button" className="rc-btn primary" onClick={onClose}>Done</button>
        </div>
      </section>
    </div>
  );
}
