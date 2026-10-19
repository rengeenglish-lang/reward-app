'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBookrExtras, getBookrReads, setBookrExtra, setBookrRead, setBookrReadMany, setBookrWeekForStudent, type BookrRead } from './bookr-reads-actions';
import { playGoalSound } from './goal-sounds';
import { bookrWeeks, isIssued, issueDate } from '@/lib/bookr-schedule';
import TopReaderOverlay, { loadTopReader, type TopReader } from './top-reader';

export type ReaderStudent = { id: string; name: string; avatar: string; classroomId: string };
export type ReaderClass = { id: string; name: string };

const MAX_EXTRA = 500;
const shortName = (name: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.length < 2 ? p[0] || name : `${p[0]} ${p.slice(1).map((x) => `${Array.from(x)[0]?.toLocaleUpperCase() || ''}.`).join(' ')}`;
};
const cell = (student: string, week: number, book: number) => `${student}|${week}|${book}`;
const clampExtra = (n: number) => (Number.isFinite(n) ? Math.min(MAX_EXTRA, Math.max(0, Math.round(n))) : 0);

/** The teacher's own number of extra books for one student, with – and + buttons. Saved when you leave the box or press Enter. */
function ExtraBooks({ name, value, onChange }: { name: string; value: number; onChange: (next: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => { const next = clampExtra(Number(draft)); setDraft(String(next)); if (next !== value) onChange(next); };
  return (
    <span className="bookr-extra">
      <button type="button" aria-label={`One fewer extra book for ${name}`} disabled={value <= 0} onClick={() => onChange(clampExtra(value - 1))}>−</button>
      <input type="number" inputMode="numeric" min={0} max={MAX_EXTRA} value={draft} aria-label={`Extra books read by ${name}`} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); }} />
      <button type="button" aria-label={`One more extra book for ${name}`} disabled={value >= MAX_EXTRA} onClick={() => onChange(clampExtra(value + 1))}>+</button>
    </span>
  );
}

/**
 * BOOKR reading list: tick who has read each of the week's three books and who has not, and add your own
 * number of extra books for students who read more than the homework. Ticks and extras together decide the best reader,
 * who is congratulated whenever this list opens for a class.
 */
export default function BookrReading({ classrooms, students, startFriday, initialClassroomId }: { classrooms: ReaderClass[]; students: ReaderStudent[]; startFriday: string; initialClassroomId: string }) {
  const [classroomId, setClassroomId] = useState(initialClassroomId || classrooms[0]?.id || '');
  const [read, setRead] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<Map<string, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(true);
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const [celebrate, setCelebrate] = useState<TopReader | null>(null);

  const issuedWeeks = bookrWeeks.filter((w) => isIssued(startFriday, w.week));
  const [week, setWeek] = useState(() => issuedWeeks[issuedWeeks.length - 1]?.week ?? 1);

  const people = useMemo(() => students.filter((s) => s.classroomId === classroomId), [students, classroomId]);
  const className = classrooms.find((c) => c.id === classroomId)?.name || 'this class';
  const entry = bookrWeeks.find((w) => w.week === week) ?? bookrWeeks[0];

  /** Ticked BOOKR books per student. */
  const ticks = useMemo(() => {
    const map = new Map<string, number>();
    for (const key of read) { const id = key.split('|')[0]; map.set(id, (map.get(id) ?? 0) + 1); }
    return map;
  }, [read]);
  /** Ticked books plus the extra books you added: this is what makes the best reader. */
  const totalOf = useCallback((id: string) => (ticks.get(id) ?? 0) + (extras.get(id) ?? 0), [ticks, extras]);

  // Open (or switch) a class: load what has been read, then congratulate the top reader.
  useEffect(() => {
    if (!classroomId) return;
    let live = true;
    setLoaded(false); setError(''); setCelebrate(null);
    Promise.all([getBookrReads(classroomId), getBookrExtras(classroomId).catch(() => [])])
      .then(([rows, extraRows]: [BookrRead[], Array<{ student_id: string; extra: number }>]) => {
        if (!live) return;
        setRead(new Set(rows.map((r) => cell(r.student_id, r.week, r.book))));
        const extraMap = new Map(extraRows.map((e) => [e.student_id, e.extra]));
        setExtras(extraMap); setReady(true); setLoaded(true);
        loadTopReader(classroomId, studentsRef.current.filter((s) => s.classroomId === classroomId)).then((top) => { if (live && top) { setCelebrate(top); playGoalSound('full'); } }).catch(() => undefined);
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

  /** One click: every book of this week for one student (or undo it if they already have all three). */
  const toggleStudentWeek = async (studentId: string) => {
    const all = entry.books.every((_, i) => read.has(cell(studentId, week, i)));
    const before = read;
    setRead((r) => { const n = new Set(r); entry.books.forEach((_, i) => { const k = cell(studentId, week, i); if (all) n.delete(k); else n.add(k); }); return n; });
    try { await setBookrWeekForStudent(studentId, week, !all); setError(''); }
    catch { setRead(before); setError('Could not save those ticks. Please try again.'); }
  };

  const setAll = async (bookNo: number, value: boolean) => {
    if (!people.length) return;
    const before = read;
    setRead((r) => { const n = new Set(r); for (const s of people) { const k = cell(s.id, week, bookNo); if (value) n.add(k); else n.delete(k); } return n; });
    try { await setBookrReadMany(people.map((s) => s.id), week, bookNo, value); setError(''); }
    catch { setRead(before); setError('Could not save those ticks. Please try again.'); }
  };

  const changeExtra = async (studentId: string, next: number) => {
    const before = extras.get(studentId) ?? 0;
    setExtras((m) => { const n = new Map(m); if (next > 0) n.set(studentId, next); else n.delete(studentId); return n; });
    try { await setBookrExtra(studentId, next); setError(''); }
    catch {
      setExtras((m) => { const n = new Map(m); if (before > 0) n.set(studentId, before); else n.delete(studentId); return n; });
      setError('Could not save the extra books. Please try again.');
    }
  };

  const ranking = useMemo(() => [...people].sort((a, b) => totalOf(b.id) - totalOf(a.id) || a.name.localeCompare(b.name)).slice(0, 3), [people, totalOf]);
  const when = issueDate(startFriday, week).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <section className="panel bookr-reading" aria-labelledby="bookr-reading-title">
      <div className="panel-title"><div className="panel-icon coral">✅</div><div><h2 id="bookr-reading-title">Read / not read</h2><p>Pick a class and a week, then tick the students who have read each book. Add your own number of extra books for students who read more than the homework. The student with the most books is the best reader and is congratulated whenever this list opens.</p></div></div>
      <p className="bookr-points-note" role="note">⭐ Every book read earns <strong>double points</strong> (2 points) automatically, including extra books. Unticking a book takes its points back.</p>

      <div className="bookr-reading-pick">
        <label><span className="field-label">Class</span><select className="field-select" value={classroomId} onChange={(event) => setClassroomId(event.target.value)}>{classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="field-label">Week</span><select className="field-select" value={week} onChange={(event) => setWeek(Number(event.target.value))}>{bookrWeeks.map((w) => <option key={w.week} value={w.week}>Week {w.week}{isIssued(startFriday, w.week) ? '' : ' (not issued yet)'}</option>)}</select></label>
      </div>
      <p className="bookr-reading-when">{entry.unit} · issued {when}</p>

      {!ready && <p className="book-error" role="alert">The reading list is not ready yet. It needs one more database update.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {!loaded ? <p className="readers-empty">Loading…</p> : people.length === 0 ? <p className="readers-empty">There are no students in {className} yet.</p> : (
        <>
          {ranking.length > 0 && totalOf(ranking[0].id) > 0 && (
            <div className="bookr-top" aria-label="Top readers">
              <strong>🏆 Top readers in {className}</strong>
              <ol>{ranking.filter((s) => totalOf(s.id) > 0).map((s) => <li key={s.id}><span aria-hidden="true">{s.avatar}</span> {shortName(s.name)} <b>{totalOf(s.id)} {totalOf(s.id) === 1 ? 'book' : 'books'}</b></li>)}</ol>
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
                  <th scope="col">This week</th>
                  <th scope="col">Extra books<span className="bookr-hint">your own count</span></th>
                  <th scope="col">Total read</th>
                </tr>
              </thead>
              <tbody>
                {people.map((s) => {
                  const allThree = entry.books.every((_, i) => read.has(cell(s.id, week, i)));
                  return (
                    <tr key={s.id}>
                      <th scope="row"><span aria-hidden="true">{s.avatar}</span> {shortName(s.name)}</th>
                      {entry.books.map((title, i) => {
                        const on = read.has(cell(s.id, week, i));
                        return <td key={title}><button type="button" className={`bookr-tick${on ? ' on' : ''}`} aria-pressed={on} aria-label={`${shortName(s.name)} ${on ? 'has read' : 'has not read'} ${title}`} onClick={() => toggle(s.id, i)}>{on ? '✓ Read' : 'Not read'}</button></td>;
                      })}
                      <td><button type="button" className={`bookr-readall${allThree ? ' on' : ''}`} aria-pressed={allThree} aria-label={`${allThree ? 'Undo all books this week for' : 'Mark all books this week as read for'} ${shortName(s.name)}`} onClick={() => toggleStudentWeek(s.id)}>{allThree ? '✓ All read' : 'Read all'}</button></td>
                      <td><ExtraBooks name={shortName(s.name)} value={extras.get(s.id) ?? 0} onChange={(next) => changeExtra(s.id, next)} /></td>
                      <td className="bookr-total"><b>{totalOf(s.id)}</b>{(extras.get(s.id) ?? 0) > 0 && <small>{ticks.get(s.id) ?? 0} + {extras.get(s.id)}</small>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {celebrate && <TopReaderOverlay reader={celebrate} className={className} onClose={() => setCelebrate(null)} />}
    </section>
  );
}
