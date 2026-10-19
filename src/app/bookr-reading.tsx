'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBookrReads, setBookrRead, setBookrReadMany, type BookrRead } from './bookr-reads-actions';
import { playGoalSound } from './goal-sounds';
import { bookrWeeks, isIssued, issueDate } from '@/lib/bookr-schedule';

export type ReaderStudent = { id: string; name: string; avatar: string; classroomId: string };
export type ReaderClass = { id: string; name: string };

const shortName = (name: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.length < 2 ? p[0] || name : `${p[0]} ${p.slice(1).map((x) => `${Array.from(x)[0]?.toLocaleUpperCase() || ''}.`).join(' ')}`;
};
const cell = (student: string, week: number, book: number) => `${student}|${week}|${book}`;

/**
 * BOOKR reading list: tick who has read each of the week's three books and who has not.
 * When the list opens for a class, the student who has read the most books is congratulated.
 */
export default function BookrReading({ classrooms, students, startFriday, initialClassroomId }: { classrooms: ReaderClass[]; students: ReaderStudent[]; startFriday: string; initialClassroomId: string }) {
  const [classroomId, setClassroomId] = useState(initialClassroomId || classrooms[0]?.id || '');
  const [read, setRead] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(true);
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const [celebrate, setCelebrate] = useState<{ names: string[]; avatars: string[]; count: number } | null>(null);

  const issuedWeeks = bookrWeeks.filter((w) => isIssued(startFriday, w.week));
  const [week, setWeek] = useState(() => issuedWeeks[issuedWeeks.length - 1]?.week ?? 1);

  const people = useMemo(() => students.filter((s) => s.classroomId === classroomId), [students, classroomId]);
  const className = classrooms.find((c) => c.id === classroomId)?.name || 'this class';
  const entry = bookrWeeks.find((w) => w.week === week) ?? bookrWeeks[0];

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const key of read) { const id = key.split('|')[0]; map.set(id, (map.get(id) ?? 0) + 1); }
    return map;
  }, [read]);

  // Open (or switch) a class: load what has been read, then congratulate the top reader.
  useEffect(() => {
    if (!classroomId) return;
    let live = true;
    setLoaded(false); setError(''); setCelebrate(null);
    getBookrReads(classroomId)
      .then((rows: BookrRead[]) => {
        if (!live) return;
        const next = new Set(rows.map((r) => cell(r.student_id, r.week, r.book)));
        setRead(next); setReady(true); setLoaded(true);
        const counts = new Map<string, number>();
        for (const r of rows) counts.set(r.student_id, (counts.get(r.student_id) ?? 0) + 1);
        const inClass = studentsRef.current.filter((s) => s.classroomId === classroomId);
        const best = Math.max(0, ...inClass.map((s) => counts.get(s.id) ?? 0));
        if (best > 0) {
          const tops = inClass.filter((s) => (counts.get(s.id) ?? 0) === best);
          setCelebrate({ names: tops.map((s) => s.name), avatars: tops.map((s) => s.avatar), count: best });
          playGoalSound('full');
        }
      })
      .catch(() => { if (live) { setReady(false); setLoaded(true); } });
    return () => { live = false; };
  }, [classroomId]);

  const toggle = useCallback(async (studentId: string, bookNo: number) => {
    const key = cell(studentId, week, bookNo);
    const was = read.has(key);
    setRead((r) => { const n = new Set(r); if (was) n.delete(key); else n.add(key); return n; });
    try { await setBookrRead(studentId, week, bookNo, !was); setError(''); }
    catch {
      setRead((r) => { const n = new Set(r); if (was) n.add(key); else n.delete(key); return n; });
      setError('Could not save that tick. Please try again.');
    }
  }, [read, week]);

  const setAll = async (bookNo: number, value: boolean) => {
    if (!people.length) return;
    const before = read;
    setRead((r) => { const n = new Set(r); for (const s of people) { const k = cell(s.id, week, bookNo); if (value) n.add(k); else n.delete(k); } return n; });
    try { await setBookrReadMany(people.map((s) => s.id), week, bookNo, value); setError(''); }
    catch { setRead(before); setError('Could not save those ticks. Please try again.'); }
  };

  const ranking = useMemo(() => [...people].sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0) || a.name.localeCompare(b.name)).slice(0, 5), [people, totals]);
  const when = issueDate(startFriday, week).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <section className="panel bookr-reading" aria-labelledby="bookr-reading-title">
      <div className="panel-title"><div className="panel-icon coral">✅</div><div><h2 id="bookr-reading-title">Read / not read</h2><p>Pick a class and a week, then tick the students who have read each book. The top reader is congratulated whenever this list opens.</p></div></div>

      <div className="bookr-reading-pick">
        <label><span className="field-label">Class</span><select className="field-select" value={classroomId} onChange={(event) => setClassroomId(event.target.value)}>{classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="field-label">Week</span><select className="field-select" value={week} onChange={(event) => setWeek(Number(event.target.value))}>{bookrWeeks.map((w) => <option key={w.week} value={w.week}>Week {w.week}{isIssued(startFriday, w.week) ? '' : ' (not issued yet)'}</option>)}</select></label>
      </div>
      <p className="bookr-reading-when">{entry.unit} · issued {when}</p>

      {!ready && <p className="book-error" role="alert">The reading list is not ready yet. It needs one more database update.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {!loaded ? <p className="readers-empty">Loading…</p> : people.length === 0 ? <p className="readers-empty">There are no students in {className} yet.</p> : (
        <>
          {ranking.length > 0 && (totals.get(ranking[0].id) ?? 0) > 0 && (
            <div className="bookr-top" aria-label="Top readers">
              <strong>🏆 Top readers in {className}</strong>
              <ol>{ranking.filter((s) => (totals.get(s.id) ?? 0) > 0).map((s) => <li key={s.id}><span aria-hidden="true">{s.avatar}</span> {shortName(s.name)} <b>{totals.get(s.id)} {totals.get(s.id) === 1 ? 'book' : 'books'}</b></li>)}</ol>
            </div>
          )}
          <div className="bookr-matrix-scroll">
            <table className="bookr-matrix">
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  {entry.books.map((title, i) => (
                    <th scope="col" key={title}>
                      <span className="bookr-book-title">{title}</span>
                      <span className="bookr-all"><button type="button" onClick={() => setAll(i, true)}>All read</button><button type="button" onClick={() => setAll(i, false)}>Clear</button></span>
                    </th>
                  ))}
                  <th scope="col">Total read</th>
                </tr>
              </thead>
              <tbody>
                {people.map((s) => (
                  <tr key={s.id}>
                    <th scope="row"><span aria-hidden="true">{s.avatar}</span> {shortName(s.name)}</th>
                    {entry.books.map((title, i) => {
                      const on = read.has(cell(s.id, week, i));
                      return <td key={title}><button type="button" className={`bookr-tick${on ? ' on' : ''}`} aria-pressed={on} aria-label={`${shortName(s.name)} ${on ? 'has read' : 'has not read'} ${title}`} onClick={() => toggle(s.id, i)}>{on ? '✓ Read' : 'Not read'}</button></td>;
                    })}
                    <td className="bookr-total"><b>{totals.get(s.id) ?? 0}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {celebrate && (
        <div className="bookr-celebrate" role="dialog" aria-modal="true" aria-label="Top reader" onClick={() => setCelebrate(null)}>
          <div className="bookr-celebrate-card">
            <div className="bookr-confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${(i * 29) % 100}%`, animationDelay: `${(i % 12) * 0.12}s`, background: ['#ffce4d', '#ef7057', '#39a6d2', '#4caf7d', '#8566d6', '#ff8fb1'][i % 6] }} />)}</div>
            <span className="bookr-celebrate-emoji" aria-hidden="true">🏆</span>
            <small>TOP READER · {className.toUpperCase()}</small>
            <h2>Congratulations{celebrate.names.length > 1 ? ', readers' : ''}!</h2>
            <div className="bookr-celebrate-names">{celebrate.names.map((n, i) => <span key={n}><b aria-hidden="true">{celebrate.avatars[i]}</b>{n}</span>)}</div>
            <p>{celebrate.names.length > 1 ? 'have' : 'has'} read the most BOOKR books: <strong>{celebrate.count}</strong>. Give them a huge cheer!</p>
            <small className="bookr-celebrate-hint">Click anywhere to continue</small>
          </div>
        </div>
      )}
    </section>
  );
}
