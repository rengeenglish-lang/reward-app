'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Shuffle, X } from 'lucide-react';
import { assignBook, assignBookToClass, getBooks, getReaders, pickBook, removeReader, setReaderFlag } from './actions';
import { avatarEmoji } from './avatars';

export type Book = { id: string; title: string; series: string; level: string | null; cover_path: string; aspect: number; position: number };
export type Reader = { id: string; student_id: string; student: string; avatar_key: string; book_id: string; title: string; returned: boolean; project_done: boolean };
export type ReadersData = { rows: Reader[]; without: { student_id: string; student: string; avatar_key: string }[] };
export type BookApi = {
  getBooks: () => Promise<Book[]>;
  pickBook: (classroomId: string) => Promise<Book>;
  getReaders: (classroomId: string) => Promise<ReadersData>;
  assignBookToClass: (classroomId: string, bookId: string) => Promise<number>;
  assignBook: (studentId: string, bookId: string) => Promise<unknown>;
  setReaderFlag: (id: string, field: 'returned' | 'project_done', value: boolean) => Promise<unknown>;
  removeReader: (id: string) => Promise<unknown>;
};

const shortName = (name: string) => { const p = name.trim().split(/\s+/).filter(Boolean); return p.length < 2 ? p[0] || name : `${p[0]} ${p.slice(1).map((x) => `${Array.from(x)[0]?.toLocaleUpperCase() || ''}.`).join(' ')}`; };
type Phase = 'idle' | 'loading' | 'shuffling' | 'revealed';

const BASE_H = 230; // book height in the 3D scene, px
const THICK = 26; // book thickness, px
const SHUFFLE_MS = 2200;
const SPIN_MS = 2600;

const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
function permutation(n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const serverApi: BookApi = {
  getBooks: () => getBooks() as Promise<Book[]>,
  pickBook: (id) => pickBook(id) as Promise<Book>,
  getReaders: (id) => getReaders(id) as unknown as Promise<ReadersData>,
  assignBookToClass: (classroomId, bookId) => assignBookToClass(classroomId, bookId),
  assignBook: (studentId, bookId) => assignBook(studentId, bookId),
  setReaderFlag: (id, field, value) => setReaderFlag(id, field, value),
  removeReader: (id) => removeReader(id),
};

export default function BookPickerCard({ classroomId, classroom, api = serverApi, active }: { classroomId: string; classroom: string; api?: BookApi; active?: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [books, setBooks] = useState<Book[]>([]);
  const [picked, setPicked] = useState<Book | null>(null);
  const [lastTitle, setLastTitle] = useState('');
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);
  const [readers, setReaders] = useState<ReadersData | null>(null);
  const [readersError, setReadersError] = useState('');
  const [filter, setFilter] = useState<'all' | 'out' | 'project'>('all');
  const [note, setNote] = useState('');
  const [giveStudent, setGiveStudent] = useState('');
  const [giveBook, setGiveBook] = useState('');
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const skip = useRef(false);

  const start = useCallback(async () => {
    if (!classroomId) { setError('Create a classroom first.'); return; }
    setError('');
    skip.current = false;
    setPhase('loading');
    try {
      const [list, chosen] = await Promise.all([books.length ? Promise.resolve(books) : api.getBooks(), api.pickBook(classroomId)]);
      setBooks(list);
      setPicked(chosen);
      setLastTitle(chosen.title);
      setScale(Math.min(1.15, Math.max(0.42, window.innerWidth / 900)));
      setPhase(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'revealed' : 'shuffling');
    } catch {
      setPhase('idle');
      setError('Could not pick a book. Check that the book list has been set up and try again.');
    }
  }, [classroomId, books, api]);

  const loadReaders = useCallback(async () => {
    if (!classroomId) { setReaders(null); return; }
    try { setReaders(await api.getReaders(classroomId)); setReadersError(''); }
    catch { setReaders(null); setReadersError('The reader list is not ready yet. It needs one more database update.'); }
  }, [classroomId, api]);

  useEffect(() => { loadReaders(); }, [loadReaders]);
  useEffect(() => { api.getBooks().then(setBooks).catch(() => { /* the list loads again when you pick */ }); }, [api]);

  const flag = async (r: Reader, field: 'returned' | 'project_done') => {
    const value = !r[field];
    setReaders((cur) => cur && { ...cur, rows: cur.rows.map((x) => (x.id === r.id ? { ...x, [field]: value } : x)) });
    try { await api.setReaderFlag(r.id, field, value); }
    catch { setReaders((cur) => cur && { ...cur, rows: cur.rows.map((x) => (x.id === r.id ? { ...x, [field]: !value } : x)) }); setNote('Could not save that. Please try again.'); }
  };
  const giveToClass = async () => {
    if (!picked) return;
    try { const n = await api.assignBookToClass(classroomId, picked.id); setNote(n ? `Gave “${picked.title}” to ${n} student${n === 1 ? '' : 's'}.` : `Everyone already has “${picked.title}”.`); await loadReaders(); }
    catch { setNote('Could not give the book to the class. Please try again.'); }
  };
  const giveOne = async () => {
    if (!giveStudent || !giveBook) return;
    try { await api.assignBook(giveStudent, giveBook); setGiveStudent(''); setNote('Book given.'); await loadReaders(); }
    catch { setNote('Could not give that book. Please try again.'); }
  };
  const dropRow = async (r: Reader) => {
    if (!window.confirm(`Remove “${r.title}” from ${shortName(r.student)}?`)) return;
    try { await api.removeReader(r.id); await loadReaders(); } catch { setNote('Could not remove it. Please try again.'); }
  };

  const rows = readers?.rows ?? [];
  const backCount = rows.filter((r) => r.returned).length;
  const doneCount = rows.filter((r) => r.project_done).length;
  const shown = rows.filter((r) => (filter === 'out' ? !r.returned : filter === 'project' ? !r.project_done : true));

  // The 3D shuffle: books ring around the stage, swap places a few times, then the ring spins down onto the chosen book.
  useEffect(() => {
    if (phase !== 'shuffling' || !picked) return;
    const n = books.length;
    const step = 360 / n;
    const chosenIdx = books.findIndex((b) => b.id === picked.id);
    const maxW = Math.max(...books.map((b) => b.aspect * BASE_H));
    const radius = Math.max(330, maxW / (2 * Math.sin(Math.PI / n)) + 36);
    const angle = books.map((_, i) => i * step);
    let slotOf = books.map((_, i) => i);
    let ring = 0;
    let lastPerm = -1;
    let spinning = false;
    let ringAtSpin = 0;
    let ringFinal = 0;
    const t0 = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      if (skip.current) { setPhase('revealed'); return; }
      const t = now - t0;
      let calm = 0;
      if (t < SHUFFLE_MS) {
        const k = Math.floor(t / 440);
        if (k !== lastPerm) { lastPerm = k; slotOf = permutation(n); }
        ring = (t / 1000) * 540;
      } else {
        if (!spinning) {
          spinning = true;
          slotOf = permutation(n);
          ringAtSpin = ring;
          const need = ((((-slotOf[chosenIdx] * step - ringAtSpin) % 360) + 360) % 360);
          ringFinal = ringAtSpin + 720 + need;
        }
        const p = Math.min(1, (t - SHUFFLE_MS) / SPIN_MS);
        ring = ringAtSpin + (ringFinal - ringAtSpin) * easeOutQuart(p);
        calm = p;
        if (p >= 1) { setPhase('revealed'); return; }
      }
      const energy = 1 - Math.min(1, calm * 3);
      for (let i = 0; i < n; i++) {
        angle[i] += wrap180(slotOf[i] * step - angle[i]) * (spinning ? 0.2 : 0.14);
        const el = els.current[i];
        if (!el) continue;
        const bob = Math.sin(t / 180 + i * 1.7) * 16 * energy;
        const tilt = Math.sin(t / 260 + i) * 7 * energy;
        el.style.transform = `translate(-50%,-50%) rotateY(${angle[i] + ring}deg) translateZ(${radius}px) translateY(${bob}px) rotateZ(${tilt}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, picked, books]);

  useEffect(() => {
    if (phase === 'idle') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPhase('idle'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  return (
    <>
      <section className={`fun-card readers-card${active === undefined ? '' : ' tool-pane'}${active ? ' is-active' : ''}`}>
        <div className="readers-head">
          <span className="readers-emoji" aria-hidden="true">📚</span>
          <div><h2>OUR READERS</h2><p>Pick a book for {classroom || 'your class'}, then see who returned it and who finished the project.</p></div>
        </div>
        <div className="readers-pick">
          <button className="fun-action primary readers-shuffle" onClick={start} disabled={phase === 'loading' || phase === 'shuffling'}>
            <Shuffle size={18} /> Shuffle &amp; pick a book
          </button>
          <p className="readers-rule">A class never gets the same book twice in a row.</p>
          {lastTitle && <div className="readers-last">🎉 Picked: <strong>{lastTitle}</strong>{picked && <button type="button" className="readers-give" onClick={giveToClass}>Give to the whole class</button>}</div>}
        </div>
        {error && <p className="book-error" role="alert">{error}</p>}
        {note && <p className="readers-note" role="status">{note}</p>}
        {readersError && <p className="book-error" role="alert">{readersError}</p>}
        {readers && (
          <>
            <div className="readers-stats">
              <span className="chip-stat">📕 Returned <b>{backCount}</b>/{rows.length}</span>
              <span className="chip-stat">⭐ Projects done <b>{doneCount}</b>/{rows.length}</span>
              <div className="seg" role="group" aria-label="Show">
                {([['all', 'Everyone'], ['out', 'Not returned'], ['project', 'Project to do']] as const).map(([id, label]) => (
                  <button key={id} type="button" className={filter === id ? 'on' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
                ))}
              </div>
            </div>
            {rows.length === 0 ? <p className="readers-empty">No books given out yet. Pick a book and press “Give to the whole class”.</p> : (
              <ul className="readers-list">
                {shown.map((r) => (
                  <li key={r.id} className={`reader-row${r.returned ? ' is-back' : ''}`}>
                    <span className="reader-avatar" aria-hidden="true">{avatarEmoji[r.avatar_key] || '🙂'}</span>
                    <span className="reader-who"><strong>{shortName(r.student)}</strong><small>📖 {r.title}</small></span>
                    <button type="button" className={`reader-toggle${r.returned ? ' on' : ''}`} aria-pressed={r.returned} onClick={() => flag(r, 'returned')}>{r.returned ? '✅ Returned' : '📕 Not returned'}</button>
                    <button type="button" className={`reader-toggle project${r.project_done ? ' on' : ''}`} aria-pressed={r.project_done} onClick={() => flag(r, 'project_done')}>{r.project_done ? '⭐ Project done' : '✏️ Project to do'}</button>
                    <button type="button" className="reader-x" aria-label={`Remove ${r.title} from ${shortName(r.student)}`} onClick={() => dropRow(r)}>×</button>
                  </li>
                ))}
                {shown.length === 0 && <li className="readers-empty">Nobody here. 🎉</li>}
              </ul>
            )}
            <details className="readers-give-one">
              <summary>Give a book to one student{readers.without.length ? ` (${readers.without.length} without a book)` : ''}</summary>
              <div className="readers-give-form">
                <select aria-label="Student" value={giveStudent} onChange={(e) => setGiveStudent(e.target.value)}>
                  <option value="">Choose a student</option>
                  {[...readers.without.map((s) => ({ id: s.student_id, name: s.student })), ...Array.from(new Map(rows.map((r) => [r.student_id, { id: r.student_id, name: r.student }])).values())].map((s) => (
                    <option key={s.id} value={s.id}>{shortName(s.name)}</option>
                  ))}
                </select>
                <select aria-label="Book" value={giveBook} onChange={(e) => setGiveBook(e.target.value)}>
                  <option value="">Choose a book</option>
                  {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
                <button type="button" className="fun-action secondary" disabled={!giveStudent || !giveBook} onClick={giveOne}>Give book</button>
              </div>
            </details>
          </>
        )}
      </section>

      {phase !== 'idle' && (
        <div className="bk-overlay" role="dialog" aria-modal="true" aria-label="Book picker">
          <button className="bk-close" onClick={() => setPhase('idle')} aria-label="Close book picker"><X size={22} /></button>

          {phase !== 'revealed' && (
            <>
              <div className="bk-stage" aria-hidden="true">
                <div className="bk-ring" style={{ transform: `scale(${scale}) rotateX(-9deg)` }}>
                  {phase === 'shuffling' && books.map((b, i) => (
                    <div key={b.id} className="bk-book" ref={(el) => { els.current[i] = el; }}
                      style={{ width: b.aspect * BASE_H, height: BASE_H, ['--t' as string]: `${THICK}px` }}>
                      <div className="bk-face bk-front">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={b.cover_path} alt="" /></div>
                      <div className="bk-face bk-back" />
                      <div className="bk-face bk-spine" />
                      <div className="bk-face bk-pages" />
                    </div>
                  ))}
                </div>
              </div>
              <p className="bk-status" role="status">{phase === 'loading' ? 'Opening the library…' : 'Shuffling the books…'}</p>
              {phase === 'shuffling' && <button className="bk-skip" onClick={() => { skip.current = true; }}>Skip</button>}
            </>
          )}

          {phase === 'revealed' && picked && (
            <div className="bk-reveal">
              <div className="bk-cover" style={{ ['--ar' as string]: picked.aspect }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={picked.cover_path} alt={`Cover of ${picked.title}`} />
              </div>
              <div className="bk-caption">
                <div><strong>{picked.title}</strong><span>{picked.series}{picked.level ? ` · Level ${picked.level}` : ''}</span></div>
                <div className="bk-actions">
                  <button className="bk-btn" onClick={async () => { await giveToClass(); setPhase('idle'); }}>Give to the whole class</button>
                  <button className="bk-btn ghost" onClick={start}><Shuffle size={16} /> Pick another</button>
                  <button className="bk-btn" onClick={() => setPhase('idle')}>Done</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
