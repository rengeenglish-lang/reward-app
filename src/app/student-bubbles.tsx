'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type StudentBubble = { id: string; name: string; avatar: string; points: number };
type BubblePlacement = { x: number; y: number; size: number };

export default function StudentBubbles({ students, label = 'Our classroom champs', showToggle = false }: { students: StudentBubble[]; label?: string; showToggle?: boolean }) {
  const [visible, setVisible] = useState(true);
  const [popping, setPopping] = useState<Set<string>>(() => new Set());
  const [popped, setPopped] = useState<Set<string>>(() => new Set());
  const [placements, setPlacements] = useState<Record<string, BubblePlacement>>({});

  // Remember the choice, so hiding the bubbles on one page keeps them hidden on the other.
  useEffect(() => { try { if (localStorage.getItem('ezgili-hide-bubbles') === 'on') setVisible(false); } catch { /* storage can be blocked */ } }, []);
  const toggleVisible = () => setVisible((current) => { const next = !current; try { localStorage.setItem('ezgili-hide-bubbles', next ? 'off' : 'on'); } catch { /* ignore */ } return next; });

  useEffect(() => {
    const arrange = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const protectedRects = Array.from(document.querySelectorAll<HTMLElement>(
        '.landing-hero-card, .login-form-panel, .landing-header, .landing-footer, .login-home-button, .student-bubbles-toggle',
      )).map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left - 8, right: rect.right + 8, top: rect.top - 8, bottom: rect.bottom + 8 };
      });
      const highScore = Math.max(0, ...students.map(student => student.points));
      const lowScore = Math.min(0, ...students.map(student => student.points));
      const preferredSize = (student: StudentBubble) => highScore === lowScore
        ? 82
        : 68 + ((student.points - lowScore) / (highScore - lowScore)) * 56;
      const bubbles = [...students].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
      const next: Record<string, BubblePlacement> = {};
      const placed: Array<{ x: number; y: number; size: number }> = [];

      for (const student of bubbles) {
        const size = preferredSize(student);
        let best: BubblePlacement | null = null;
        // Search smaller sizes only if a narrow screen cannot fit the preferred bubble size.
        for (const scale of [1, 0.88, 0.76, 0.64, 0.54]) {
          const actualSize = size * scale;
          let bestScore = -Infinity;
          for (let y = 10 + actualSize / 2; y <= height - 10 - actualSize / 2; y += 24) {
            for (let x = 10 + actualSize / 2; x <= width - 10 - actualSize / 2; x += 24) {
              if (protectedRects.some(rect => x + actualSize / 2 > rect.left && x - actualSize / 2 < rect.right && y + actualSize / 2 > rect.top && y - actualSize / 2 < rect.bottom)) continue;
              const distances = placed.map(other => Math.hypot(x - other.x, y - other.y) - (actualSize + other.size) / 2);
              const nearest = distances.length ? Math.min(...distances) : Math.hypot(x - width / 2, y - height / 2);
              if (distances.length && nearest < 4) continue;
              if (nearest > bestScore) {
                bestScore = nearest;
                best = { x, y, size: actualSize };
              }
            }
          }
          if (best) break;
        }
        if (best) {
          next[student.id] = best;
          placed.push(best);
        }
      }
      setPlacements(next);
    };

    arrange();
    window.addEventListener('resize', arrange);
    return () => window.removeEventListener('resize', arrange);
  }, [students]);

  function pop(id: string) {
    if (popping.has(id) || popped.has(id)) return;
    setPopping(current => new Set(current).add(id));
    window.setTimeout(() => {
      setPopped(current => new Set(current).add(id));
    }, 420);
  }

  if (!students.length) return null;
  const remaining = students.filter(student => !popped.has(student.id));
  return <div className="student-bubble-screen" role="region" aria-label={label}>
      {showToggle && <button
        type="button"
        className="student-bubbles-toggle"
        aria-pressed={visible}
        onClick={toggleVisible}
      >
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        <span>{visible ? 'Hide bubbles' : 'Show bubbles'}</span>
      </button>}
      {visible && remaining.map((student, index) => {
        const placement = placements[student.id];
        if (!placement) return null;
        return <button
        key={student.id}
        type="button"
        className={`student-name-bubble student-bubble-${index % 6}${popping.has(student.id) ? ' is-popping' : ''}`}
        onClick={() => pop(student.id)}
        aria-label={`Pop ${student.name}'s bubble, ${student.points} ${student.points === 1 ? 'point' : 'points'}`}
        title={`${student.name} · ${student.points} ${student.points === 1 ? 'point' : 'points'}`}
        disabled={popping.has(student.id)}
        style={{
          '--bubble-delay': `${(index % 7) * -0.28}s`,
          '--bubble-size': `${placement.size}px`,
          left: `${placement.x - placement.size / 2}px`,
          top: `${placement.y - placement.size / 2}px`,
        } as React.CSSProperties}
      >
        <span className="student-bubble-avatar" aria-hidden="true">{student.avatar}</span>
        <span className="student-bubble-name">{student.name}</span>
        <span className="student-bubble-points">{student.points} {student.points === 1 ? 'pt' : 'pts'}</span>
        <span className="student-bubble-burst" aria-hidden="true">✦　✧　✦</span>
      </button>;
      })}
      {visible && !remaining.length && <p className="student-bubble-all-popped">Hooray for everyone! 🎉</p>}
    </div>;
}
