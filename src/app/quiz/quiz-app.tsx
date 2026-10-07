'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import './quiz.css';

type OrderQ = { type: 'order'; chunks: string[]; explain: string };
type McqQ = { type: 'mcq'; q: string; options: string[]; answer: number; explain: string };
type Q = OrderQ | McqQ;
type Chip = { id: number; t: string; o: number };
type Verdict = { ok: boolean; gain: number; extra: string };
type Game = {
  qs: Q[]; i: number; xp: number; streak: number; best: number; lives: number; right: number;
  miss: number[]; tray: Chip[]; bank: Chip[]; verdict: Verdict | null; picked: number | null;
};
type Screen = 'home' | 'review' | 'game' | 'result';
type Status = { msg: string; err: boolean; busy: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; r: number; c: string; a: number; rot: number };

const SAMPLE: Q[] = [
  { type: 'order', chunks: ['She', 'has', 'lived', 'in', 'Istanbul', 'for', 'ten years'], explain: 'Present perfect with for + a period of time.' },
  { type: 'mcq', q: 'If it rains tomorrow, we ___ the picnic.', options: ['cancel', 'will cancel', 'would cancel', 'cancelled'], answer: 1, explain: 'First conditional: if + present simple, will + base verb.' },
  { type: 'order', chunks: ['Could', 'you', 'tell', 'me', 'where', 'the station', 'is?'], explain: 'In an indirect question the verb follows the subject: where the station is.' },
  { type: 'mcq', q: 'Choose the sentence with the correct article.', options: ['He is an university student.', 'He is a university student.', 'He is the university student.', 'He is university student.'], answer: 1, explain: 'University starts with the sound /ju:/, so we use a.' },
  { type: 'order', chunks: ['I', 'wish', 'I', 'had', 'studied', 'harder'], explain: 'Wish + past perfect talks about a regret about the past.' },
  { type: 'mcq', q: 'By next year, they ___ the new bridge.', options: ['finish', 'are finishing', 'will have finished', 'have finished'], answer: 2, explain: 'Future perfect: will have + past participle, for an action completed before a future time.' },
];

const BEST_KEY = 'snapquiz.best';

function shuffle<T>(list: T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeBank(q: Q): Chip[] {
  if (q.type !== 'order') return [];
  const base = q.chunks.map((t, id) => ({ id, t, o: 0 }));
  let ordered = base;
  for (let tries = 0; tries < 8; tries++) {
    ordered = shuffle(base);
    if (ordered.map((c) => c.t).join(' ') !== q.chunks.join(' ')) break;
  }
  return ordered.map((c, o) => ({ ...c, o }));
}

function newGame(qs: Q[]): Game {
  return { qs, i: 0, xp: 0, streak: 0, best: 0, lives: 3, right: 0, miss: [], tray: [], bank: makeBank(qs[0]), verdict: null, picked: null };
}

function moveChip(g: Game, id: number, to: 'tray' | 'bank', idx?: number): Game {
  const fromTray = g.tray.findIndex((c) => c.id === id);
  const fromBank = g.bank.findIndex((c) => c.id === id);
  const chip = fromTray >= 0 ? g.tray[fromTray] : g.bank[fromBank];
  if (!chip) return g;
  const tray = g.tray.filter((c) => c.id !== id);
  const bank = g.bank.filter((c) => c.id !== id);
  if (to === 'tray') tray.splice(Math.min(idx ?? tray.length, tray.length), 0, chip);
  else bank.push(chip);
  return { ...g, tray, bank };
}

async function prepareImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '';
}

export default function QuizApp({ canGenerate }: { canGenerate: boolean }) {
  const [screen, setScreen] = useState<Screen>('home');
  const [title, setTitle] = useState('Your quiz');
  const [quiz, setQuiz] = useState<Q[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<Status>({ msg: '', err: false, busy: false });
  const [bestXp, setBestXp] = useState(0);
  const [hover, setHover] = useState<'tray' | 'bank' | null>(null);

  const trayRef = useRef<HTMLDivElement>(null);
  const bankRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragRef = useRef<{ id: number; el: HTMLElement; x: number; y: number; on: boolean; ghost: HTMLElement | null; pid: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const partsRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    try { setBestXp(parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => () => { if (thumb) URL.revokeObjectURL(thumb); }, [thumb]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [screen]);

  /* ---------- confetti ---------- */
  const burst = useCallback((n: number) => {
    const cv = canvasRef.current;
    if (!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = window.innerWidth * dpr;
    cv.height = window.innerHeight * dpr;
    const cx = cv.getContext('2d');
    if (!cx) return;
    const cols = ['#7057c9', '#ffd052', '#218c79', '#ee7259', '#35a6d0'];
    for (let i = 0; i < n; i++) {
      partsRef.current.push({ x: window.innerWidth / 2, y: window.innerHeight * 0.35, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 11 - 3, r: Math.random() * 6 + 3, c: cols[i % cols.length], a: 1, rot: Math.random() * 6 });
    }
    const tick = () => {
      cx.clearRect(0, 0, cv.width, cv.height);
      partsRef.current = partsRef.current.filter((p) => p.a > 0.02);
      for (const p of partsRef.current) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.vx *= 0.99; p.a -= 0.012; p.rot += 0.15;
        cx.save();
        cx.globalAlpha = Math.max(p.a, 0);
        cx.translate(p.x * dpr, p.y * dpr);
        cx.rotate(p.rot);
        cx.fillStyle = p.c;
        cx.fillRect((-p.r * dpr) / 2, (-p.r * dpr) / 2, p.r * dpr, p.r * dpr * 0.6);
        cx.restore();
      }
      if (partsRef.current.length) rafRef.current = requestAnimationFrame(tick);
      else { rafRef.current = 0; cx.clearRect(0, 0, cv.width, cv.height); }
    };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  /* ---------- home: photo → quiz ---------- */
  function pickPhoto(file: File | undefined | null) {
    if (!file) return;
    setPhoto(file);
    setThumb(URL.createObjectURL(file));
    setStatus({ msg: '', err: false, busy: false });
  }

  async function makeQuiz() {
    if (!photo) return;
    const ctl = new AbortController();
    abortRef.current = ctl;
    setStatus({ msg: 'Reading your photo and writing questions…', err: false, busy: true });
    try {
      const image = await prepareImage(photo);
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, mediaType: 'image/jpeg' }),
        signal: ctl.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; title?: string; questions?: Q[] };
      if (!res.ok || !data.questions) throw new Error(data.error || 'Something went wrong while reading the photo. Try again.');
      setStatus({ msg: '', err: false, busy: false });
      openReview(data.questions, data.title || 'Your quiz');
    } catch (e) {
      if (ctl.signal.aborted) setStatus({ msg: '', err: false, busy: false });
      else setStatus({ msg: e instanceof Error ? e.message : 'Something went wrong. Try again.', err: true, busy: false });
    } finally {
      abortRef.current = null;
    }
  }

  function openReview(qs: Q[], name: string) {
    setQuiz(qs);
    setTitle(name);
    setScreen('review');
  }

  /* ---------- game ---------- */
  function begin(qs: Q[]) {
    if (!qs.length) return;
    setGame(newGame(qs));
    setScreen('game');
  }

  function award(g: Game, ok: boolean): { g: Game; gain: number } {
    if (!ok) return { g: { ...g, streak: 0, lives: g.lives - 1, miss: [...g.miss, g.i] }, gain: 0 };
    const streak = g.streak + 1;
    const gain = 10 + Math.min(streak - 1, 5) * 3;
    return { g: { ...g, streak, best: Math.max(g.best, streak), right: g.right + 1, xp: g.xp + gain }, gain };
  }

  function settle(g: Game, ok: boolean, extra: string, picked: number | null) {
    const r = award(g, ok);
    setGame({ ...r.g, verdict: { ok, gain: r.gain, extra }, picked });
    if (ok && r.g.streak >= 3) burst(24);
  }

  function checkOrder() {
    if (!game || game.verdict) return;
    const q = game.qs[game.i];
    if (q.type !== 'order') return;
    const want = q.chunks.join(' ');
    const ok = game.tray.map((c) => c.t).join(' ') === want;
    settle(game, ok, ok ? '' : `Correct sentence: ${want}`, null);
  }

  function answerMcq(k: number) {
    if (!game || game.verdict) return;
    const q = game.qs[game.i];
    if (q.type !== 'mcq') return;
    const ok = k === q.answer;
    settle(game, ok, ok ? '' : `Right answer: ${q.options[q.answer]}`, k);
  }

  function next() {
    if (!game) return;
    if (game.i >= game.qs.length - 1 || game.lives <= 0) {
      const done = game.right + game.miss.length;
      const acc = done ? Math.round((game.right / done) * 100) : 0;
      if (game.xp > bestXp) {
        setBestXp(game.xp);
        try { localStorage.setItem(BEST_KEY, String(game.xp)); } catch { /* ignore */ }
      }
      setScreen('result');
      if (acc >= 60) burst(90);
      return;
    }
    const i = game.i + 1;
    setGame({ ...game, i, tray: [], bank: makeBank(game.qs[i]), verdict: null, picked: null });
  }

  /* ---------- drag and drop (pointer events: mouse, pen and touch) ---------- */
  function zoneAt(x: number, y: number): 'tray' | 'bank' | null {
    const pad = 14;
    const inside = (el: HTMLElement | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    };
    if (inside(trayRef.current)) return 'tray';
    if (inside(bankRef.current)) return 'bank';
    return null;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-chip]');
    if (!chip || !game || game.verdict || e.button > 0) return;
    dragRef.current = { id: Number(chip.dataset.chip), el: chip, x: e.clientX, y: e.clientY, on: false, ghost: null, pid: e.pointerId };
    try { chip.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pid) return;
    if (!d.on && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
      d.on = true;
      const ghost = d.el.cloneNode(true) as HTMLElement;
      ghost.className = 'sq-chipbtn sq-ghostchip';
      document.body.append(ghost);
      d.ghost = ghost;
      d.el.classList.add('sq-lifting');
    }
    if (d.on && d.ghost) {
      d.ghost.style.left = `${e.clientX}px`;
      d.ghost.style.top = `${e.clientY}px`;
      setHover(zoneAt(e.clientX, e.clientY));
    }
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pid) return;
    dragRef.current = null;
    d.ghost?.remove();
    d.el.classList.remove('sq-lifting');
    setHover(null);
    if (cancelled) return;
    if (!d.on) { // a tap sends the piece to the other side
      setGame((g) => (g ? moveChip(g, d.id, g.tray.some((c) => c.id === d.id) ? 'bank' : 'tray') : g));
      return;
    }
    const zone = zoneAt(e.clientX, e.clientY);
    if (zone === 'tray') {
      let idx = 0;
      trayRef.current?.querySelectorAll<HTMLElement>('[data-chip]').forEach((el) => {
        if (Number(el.dataset.chip) === d.id) return;
        const r = el.getBoundingClientRect();
        if (e.clientY > r.bottom || (e.clientY >= r.top && e.clientX > r.left + r.width / 2)) idx++;
      });
      setGame((g) => (g ? moveChip(g, d.id, 'tray', idx) : g));
    } else if (zone === 'bank') {
      setGame((g) => (g ? moveChip(g, d.id, 'bank') : g));
    }
  }

  /* ---------- render ---------- */
  const q = game ? game.qs[game.i] : null;
  const done = game ? game.right + game.miss.length : 0;
  const acc = done ? Math.round(((game?.right ?? 0) / done) * 100) : 0;
  const outOfLives = !!game && game.lives <= 0 && done < game.qs.length;
  const stars = outOfLives ? (acc >= 60 ? 1 : 0) : acc >= 90 ? 3 : acc >= 60 ? 2 : 1;
  const missedQs = game
    ? [...game.miss, ...Array.from({ length: Math.max(game.qs.length - done, 0) }, (_, k) => done + k)].map((i) => game.qs[i]).filter(Boolean)
    : [];
  const canPhoto = canGenerate;

  const chipButton = (c: Chip, verdictClass: string) => (
    <button
      key={c.id}
      type="button"
      data-chip={c.id}
      className={`sq-chipbtn${verdictClass}`}
      onClick={(e) => {
        if (e.detail !== 0 || !game || game.verdict) return; // pointer taps are handled on pointerup
        setGame(moveChip(game, c.id, game.tray.some((t) => t.id === c.id) ? 'bank' : 'tray'));
      }}
    >
      {c.t}
    </button>
  );

  return (
    <div className="sq-root">
      <canvas ref={canvasRef} className="sq-fx" aria-hidden="true" />
      <div className="sq-wrap">
        <div className="sq-top">
          <a className="sq-logo" href="/">Snap<b>Quiz</b></a>
          <div className="sq-best">{bestXp ? `Best round: ${bestXp} XP` : ''}</div>
        </div>

        {screen === 'home' && (
          <section className="sq-card">
            <div className="sq-hero">
              <h1>Photograph a worksheet. Play it as a quiz.</h1>
              <p className="sq-muted">Upload a picture of questions or a text. SnapQuiz turns it into sentence-builder and multiple-choice rounds with XP, streaks and lives.</p>
            </div>
            <label
              className={`sq-drop${over ? ' sq-over' : ''}${canPhoto ? '' : ' sq-off'}`}
              htmlFor="sq-file"
              onDragEnter={(e) => { e.preventDefault(); if (canPhoto) setOver(true); }}
              onDragOver={(e) => { e.preventDefault(); if (canPhoto) setOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
              onDrop={(e) => { e.preventDefault(); setOver(false); if (canPhoto) pickPhoto(e.dataTransfer.files[0]); }}
            >
              <strong>Drop a photo here or tap to choose one</strong>
              <div className="sq-muted sq-small">JPG, PNG or WebP. Printed text works best.</div>
              <input id="sq-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={!canPhoto || status.busy} onChange={(e) => pickPhoto(e.target.files?.[0])} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumb && <img className="sq-thumb" src={thumb} alt="Selected photo" />}
            </label>
            <div className="sq-row" style={{ marginTop: 14 }}>
              <button className="sq-btn" disabled={!photo || status.busy || !canPhoto} onClick={makeQuiz}>Make my quiz</button>
              {status.busy && <button className="sq-btn sq-ghost" onClick={() => abortRef.current?.abort()}>Stop</button>}
              <button className="sq-btn sq-sun" disabled={status.busy} onClick={() => openReview(SAMPLE.map((s) => ({ ...s })), 'Sample quiz: English grammar')}>Play the sample quiz</button>
            </div>
            {!canPhoto && (
              <div className="sq-status" role="status">Photo quizzes need the tutor to be signed in. <a href="/login">Sign in</a> to use them, or play the sample quiz.</div>
            )}
            {status.msg && <div className={`sq-status${status.err ? ' sq-err' : ''}`} role="status">{status.msg}</div>}
            <div className="sq-how">
              <div><b>Build it</b>Drag word pieces into the right order to make a correct sentence.</div>
              <div><b>Pick it</b>Choose the right answer from four options.</div>
              <div><b>Keep going</b>Correct answers build a streak that multiplies your XP. Three wrong answers end the round.</div>
            </div>
          </section>
        )}

        {screen === 'review' && (
          <section className="sq-card">
            <h2>{title}</h2>
            <p className="sq-muted sq-small" style={{ margin: '6px 0 0' }}>Remove any question that was read wrongly, then start.</p>
            <ul className="sq-qlist">
              {quiz.map((item, i) => (
                <li key={i}>
                  <span className={`sq-tag ${item.type === 'order' ? 'sq-order' : ''}`}>{item.type === 'order' ? 'Build' : 'Choose'}</span>
                  <span className="sq-txt">{item.type === 'order' ? item.chunks.join(' ') : item.q}</span>
                  <button className="sq-x" aria-label={`Remove question ${i + 1}`} onClick={() => setQuiz(quiz.filter((_, k) => k !== i))}>×</button>
                </li>
              ))}
            </ul>
            <div className="sq-row" style={{ marginTop: 16 }}>
              <button className="sq-btn" disabled={!quiz.length} onClick={() => begin(quiz)}>Start the quiz</button>
              <button className="sq-btn sq-ghost" onClick={() => setScreen('home')}>Back</button>
            </div>
          </section>
        )}

        {screen === 'game' && game && q && (
          <section className="sq-card">
            <div className="sq-hud">
              <div className="sq-hearts" aria-label={`${game.lives} lives left`}>
                {[0, 1, 2].map((k) => <span key={k} className={k >= game.lives ? 'sq-gone' : ''}>♥</span>)}
              </div>
              <div className="sq-bar" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((game.i / game.qs.length) * 100)}>
                <i style={{ width: `${(game.i / game.qs.length) * 100}%` }} />
              </div>
              <div className="sq-score">
                <span>{game.xp}</span> XP
                {game.streak >= 2 && <span className="sq-streak">{game.streak} in a row</span>}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="sq-kind">{q.type === 'order' ? 'Build the sentence' : 'Choose the answer'}</div>
              <div className="sq-prompt">{q.type === 'order' ? 'Put the pieces in the right order.' : q.q}</div>

              {q.type === 'order' ? (
                <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={(e) => endDrag(e, false)} onPointerCancel={(e) => endDrag(e, true)}>
                  <div ref={trayRef} className={`sq-tray${game.tray.length ? '' : ' sq-hint'}${hover === 'tray' ? ' sq-over' : ''}`}>
                    {game.tray.length ? game.tray.map((c) => chipButton(c, game.verdict ? (game.verdict.ok ? ' sq-ok' : ' sq-no') : '')) : 'Drag the pieces here to build the sentence'}
                  </div>
                  <div ref={bankRef} className={`sq-bank${hover === 'bank' ? ' sq-over' : ''}`}>
                    {game.bank.slice().sort((a, b) => a.o - b.o).map((c) => chipButton(c, ''))}
                  </div>
                </div>
              ) : (
                <div className="sq-opts">
                  {q.options.map((o, k) => {
                    const cls = game.verdict ? (k === q.answer ? ' sq-ok' : k === game.picked ? ' sq-no' : '') : '';
                    return (
                      <button key={k} type="button" className={`sq-opt${cls}`} disabled={!!game.verdict} onClick={() => answerMcq(k)}>
                        <span className="sq-letter">{'ABCD'[k]}</span>
                        <span>{o}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {game.verdict && (
                <div className={`sq-fb ${game.verdict.ok ? 'sq-ok' : 'sq-no'}`} role="status">
                  <h3>{game.verdict.ok ? `Correct! +${game.verdict.gain} XP${game.streak >= 3 ? ` · streak x${game.streak}` : ''}` : 'Not quite'}</h3>
                  {game.verdict.extra && <p>{game.verdict.extra}</p>}
                  {q.explain && <p className="sq-small">{q.explain}</p>}
                </div>
              )}

              <div className="sq-foot">
                {game.verdict ? (
                  <button className="sq-btn" autoFocus onClick={next}>{game.i >= game.qs.length - 1 || game.lives <= 0 ? 'See results' : 'Continue'}</button>
                ) : q.type === 'order' ? (
                  <button className="sq-btn" disabled={game.bank.length > 0} onClick={checkOrder}>Check</button>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {screen === 'result' && game && (
          <section className="sq-card">
            <div className="sq-stars" aria-hidden="true">
              {[0, 1, 2].map((k) => <span key={k} className={k < stars ? 'sq-on' : ''}>★</span>)}
            </div>
            <h2 style={{ marginTop: 10 }}>{outOfLives ? 'Out of lives. Good effort.' : acc === 100 ? 'Perfect round!' : acc >= 60 ? 'Nice work!' : 'Keep practising!'}</h2>
            <p className="sq-muted" style={{ margin: '6px 0 0' }}>
              {outOfLives ? `You answered ${done} of ${game.qs.length} questions before running out.` : `${game.right} of ${game.qs.length} correct.`}
            </p>
            <div className="sq-stats">
              <div><b>{game.xp}</b><span className="sq-muted sq-small">XP earned</span></div>
              <div><b>{acc}%</b><span className="sq-muted sq-small">Accuracy</span></div>
              <div><b>{game.best}</b><span className="sq-muted sq-small">Best streak</span></div>
            </div>
            <div className="sq-row">
              <button className="sq-btn" onClick={() => begin(game.qs)}>Play again</button>
              {missedQs.length > 0 && <button className="sq-btn sq-sun" onClick={() => begin(missedQs)}>Practise missed ones</button>}
              <button className="sq-btn sq-ghost" onClick={() => setScreen('home')}>New photo</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
