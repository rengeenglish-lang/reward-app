'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Shuffle, X } from 'lucide-react';
import { getBooks, pickBook } from './actions';

export type Book = { id: string; title: string; series: string; level: string | null; cover_path: string; aspect: number; position: number };
export type BookApi = { getBooks: () => Promise<Book[]>; pickBook: (classroomId: string) => Promise<Book> };
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

const serverApi: BookApi = { getBooks: () => getBooks() as Promise<Book[]>, pickBook: (id) => pickBook(id) as Promise<Book> };

export default function BookPickerCard({ classroomId, classroom, api = serverApi }: { classroomId: string; classroom: string; api?: BookApi }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [books, setBooks] = useState<Book[]>([]);
  const [picked, setPicked] = useState<Book | null>(null);
  const [lastTitle, setLastTitle] = useState('');
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);
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
      <section className="fun-card book-card">
        <div className="fun-card-title">
          <div className="fun-panel-icon"><BookOpen size={18} /></div>
          <div><h2>Book picker</h2><p>Shuffle the library and pick a book for {classroom || 'your class'}.</p></div>
        </div>
        <p className="book-note">A class never gets the same book twice in a row.</p>
        {lastTitle && <p className="book-last">Last pick: <strong>{lastTitle}</strong></p>}
        {error && <p className="book-error" role="alert">{error}</p>}
        <button className="fun-action" onClick={start} disabled={phase === 'loading' || phase === 'shuffling'}>
          <Shuffle size={16} /> Shuffle &amp; pick a book
        </button>
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
