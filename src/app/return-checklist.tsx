'use client';

import { useCallback, useEffect, useState } from 'react';
import { getReaders, setReaderStatus } from './actions';
import { avatarEmoji } from './avatars';
import type { Reader, ReadersData } from './book-picker';

const shortName = (name: string) => { const p = name.trim().split(/\s+/).filter(Boolean); return p.length < 2 ? p[0] || name : `${p[0]} ${p.slice(1).map((x) => `${Array.from(x)[0]?.toLocaleUpperCase() || ''}.`).join(' ')}`; };

// Always-visible "who still has a book?" list for the Today tab; the full tool lives in Our Readers.
export default function ReturnChecklist({ classroomId, classroom, onPointsAwarded, onOpenReaders }: { classroomId: string; classroom: string; onPointsAwarded?: (studentId: string, points: number) => boolean; onOpenReaders?: () => void }) {
  const [readers, setReaders] = useState<ReadersData | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classroomId) { setReaders(null); return; }
    try { setReaders(await getReaders(classroomId) as unknown as ReadersData); setError(''); }
    catch { setReaders(null); setError('The reader list is not ready yet.'); }
  }, [classroomId]);
  useEffect(() => { load(); }, [load]);

  const out = (readers?.rows || []).filter((r) => !r.returned && !r.lost);
  const setStatus = async (r: Reader, status: 'returned' | 'lost') => {
    if (busy) return;
    setBusy(r.id);
    try {
      const result = await setReaderStatus(r.id, status) as { points_awarded?: boolean };
      setReaders((cur) => cur && { ...cur, rows: cur.rows.map((x) => (x.id === r.id ? { ...x, returned: status === 'returned', lost: status === 'lost' } : x)) });
      if (status === 'returned' && result.points_awarded) { onPointsAwarded?.(r.student_id, 10); setNote(`📚 ${shortName(r.student)} returned ${r.title} · +10 points!`); }
      else setNote('');
    } catch { setNote('Could not save that. Please try again.'); }
    finally { setBusy(null); }
  };

  const returnAll = async () => {
    if (busy || !out.length || !window.confirm(`Mark all ${out.length} ${out.length === 1 ? 'book' : 'books'} as returned? Each student gets +10 points.`)) return;
    setBusy('all');
    let done = 0;
    for (const r of out) {
      try {
        const result = await setReaderStatus(r.id, 'returned') as { points_awarded?: boolean };
        setReaders((cur) => cur && { ...cur, rows: cur.rows.map((x) => (x.id === r.id ? { ...x, returned: true, lost: false } : x)) });
        if (result.points_awarded) onPointsAwarded?.(r.student_id, 10);
        done++;
      } catch { break; }
    }
    setNote(done === out.length ? `📚 All ${done} ${done === 1 ? 'book is' : 'books are'} back · +10 points each!` : `Marked ${done} of ${out.length} as returned. Please try again for the rest.`);
    setBusy(null);
  };

  if (!classroomId) return null;
  return (
    <section className="fun-card readers-card return-checklist" aria-labelledby="return-checklist-title">
      <div className="readers-head">
        <span className="readers-emoji" aria-hidden="true">📚</span>
        <div><h2 id="return-checklist-title">BOOK RETURN CHECKLIST</h2><p>{classroom || 'Your class'} · {out.length === 0 ? 'every book is back 🎉' : `${out.length} ${out.length === 1 ? 'book' : 'books'} still out`}</p></div>
        {out.length > 1 && <button type="button" className="fun-action primary" disabled={busy !== null} onClick={returnAll}>✅ Mark all returned</button>}
        {onOpenReaders && <button type="button" className="text-link" onClick={onOpenReaders}>Open Our Readers</button>}
      </div>
      {error && <p className="book-error" role="alert">{error}</p>}
      {note && <p className="readers-note" role="status">{note}</p>}
      {readers && out.length === 0 && !error && <p className="readers-empty">{readers.rows.length ? 'Nobody owes a book. 🎉' : 'No books given out yet.'}</p>}
      {out.length > 0 && (
        <ul className="readers-list">
          {out.map((r) => (
            <li key={r.id} className="reader-row">
              <span className="reader-avatar" aria-hidden="true">{avatarEmoji[r.avatar_key] || '🙂'}</span>
              <span className="reader-who"><strong>{shortName(r.student)}</strong><small>📖 {r.title}</small></span>
              <div className="reader-status-options" role="group" aria-label={`Book status for ${shortName(r.student)} · ${r.title}`}>
                <button type="button" className="reader-status-option" disabled={busy === r.id} onClick={() => setStatus(r, 'returned')}>✅ Returned</button>
                <button type="button" className="reader-status-option lost" disabled={busy === r.id} onClick={() => setStatus(r, 'lost')}>⚠️ Lost</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
