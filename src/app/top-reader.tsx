'use client';

import { getBookrExtras, getBookrReads } from './bookr-reads-actions';

export type TopReader = { name: string; avatar: string; count: number };
type Person = { id: string; name: string; avatar: string };

/**
 * The one best reader of a class: the most books read, counting ticked BOOKR books plus the extra books the teacher added.
 * If two students are level, the one with more ticked books comes first, then the name.
 * Returns null when nobody has read anything yet.
 */
export async function loadTopReader(classroomId: string, people: Person[]): Promise<TopReader | null> {
  const [reads, extras] = await Promise.all([getBookrReads(classroomId), getBookrExtras(classroomId).catch(() => [])]);
  const ticks = new Map<string, number>(), extra = new Map(extras.map((e) => [e.student_id, e.extra]));
  for (const r of reads) ticks.set(r.student_id, (ticks.get(r.student_id) ?? 0) + 1);
  const total = (id: string) => (ticks.get(id) ?? 0) + (extra.get(id) ?? 0);
  const best = [...people].sort((a, b) => total(b.id) - total(a.id) || (ticks.get(b.id) ?? 0) - (ticks.get(a.id) ?? 0) || a.name.localeCompare(b.name))[0];
  return best && total(best.id) > 0 ? { name: best.name, avatar: best.avatar, count: total(best.id) } : null;
}

/** Full-screen congratulation for the best reader of a class. Click anywhere to close it. */
export default function TopReaderOverlay({ reader, className, onClose }: { reader: TopReader; className: string; onClose: () => void }) {
  return (
    <div className="bookr-celebrate" role="dialog" aria-modal="true" aria-label="Top reader" onClick={onClose}>
      <div className="bookr-celebrate-card">
        <div className="bookr-confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${(i * 29) % 100}%`, animationDelay: `${(i % 12) * 0.12}s`, background: ['#ffce4d', '#ef7057', '#39a6d2', '#4caf7d', '#8566d6', '#ff8fb1'][i % 6] }} />)}</div>
        <span className="bookr-celebrate-emoji" aria-hidden="true">🏆</span>
        <small>TOP READER · {className.toUpperCase()}</small>
        <h2>Congratulations!</h2>
        <div className="bookr-celebrate-names"><span><b aria-hidden="true">{reader.avatar}</b>{reader.name}</span></div>
        <p>has read the most books: <strong>{reader.count}</strong>. Give them a huge cheer!</p>
        <small className="bookr-celebrate-hint">Click anywhere to continue</small>
      </div>
    </div>
  );
}
