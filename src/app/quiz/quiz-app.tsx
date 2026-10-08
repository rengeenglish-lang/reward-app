'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './quiz.css';
import { MIXED, TYPE_INFO } from './types';
import type { Done, Persona, Q, QType, Quiz } from './types';
import { SAMPLE_ALL, SAMPLE_GRAMMAR, SAMPLE_PERSONALITY } from './samples';
import {
  ArithView, BlanksView, CardsView, ChoiceView, CrosswordView, DictationView, DragWordsView, EssayView, MarkWordsView,
  MatchView, MemoryView, PersonalityView, SortParasView, SortWordsView, SummaryView, TrueFalseView, WordSearchView, shuffle,
} from './question-views';

type Verdict = { ok: boolean; gain: number; note: string };
type Game = {
  quiz: Quiz; i: number; run: number; xp: number; streak: number; best: number; lives: number;
  right: number; miss: number[]; verdict: Verdict | null; tally: number[];
};
type Screen = 'home' | 'options' | 'review' | 'game' | 'result';
type Status = { msg: string; err: boolean; busy: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; r: number; c: string; a: number; rot: number };
type Op = '+' | '-' | '×' | '÷';

const BEST_KEY = 'snapquiz.best';
const info = (t: QType) => TYPE_INFO.find((x) => x.id === t);

function promptOf(q: Q): string {
  switch (q.type) {
    case 'blanks': return 'Type the missing words.';
    case 'dragwords': return 'Drag each word into the right gap.';
    case 'sortwords': return 'Put the pieces in the right order.';
    case 'dictation': return 'Listen and type what you hear.';
    case 'arith': return `${q.a} ${q.op} ${q.b} = ?`;
    case 'memory': return q.q || 'Find the matching pairs.';
    case 'wordsearch': return q.q || 'Find all the hidden words.';
    case 'crossword': return q.q || 'Solve the crossword.';
    default: return q.q;
  }
}

function summarise(q: Q): string {
  switch (q.type) {
    case 'blanks': case 'dragwords': case 'markwords': return q.text.replace(/\*/g, '_');
    case 'sortwords': return q.chunks.join(' ');
    case 'sortparas': return q.items.join(' → ');
    case 'summary': return q.q;
    case 'match': case 'memory': return `${q.q || 'Pairs'} (${q.pairs.length} pairs)`;
    case 'cards': return `${q.q || 'Flashcards'} (${q.cards.length} cards)`;
    case 'wordsearch': return `${q.q || 'Word search'}: ${q.words.join(', ')}`;
    case 'crossword': return `${q.q || 'Crossword'} (${q.entries.length} words)`;
    case 'dictation': return q.sentence;
    case 'arith': return `${q.a} ${q.op} ${q.b}`;
    default: return q.q;
  }
}

function makeArithmetic(ops: Op[], count: number): Q[] {
  const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
  return Array.from({ length: count }, () => {
    const op = ops[rnd(0, ops.length - 1)];
    let a = rnd(2, 40);
    let b = rnd(2, 20);
    let answer = 0;
    if (op === '+') answer = a + b;
    else if (op === '-') { if (b > a) [a, b] = [b, a]; answer = a - b; }
    else if (op === '×') { a = rnd(2, 12); b = rnd(2, 12); answer = a * b; }
    else { b = rnd(2, 12); answer = rnd(2, 12); a = b * answer; }
    return { type: 'arith', a, b, op, answer, explain: '' } as Q;
  });
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

function renderQuestion(q: Q, onDone: (d: Done) => void) {
  switch (q.type) {
    case 'mcq': case 'single': return <ChoiceView q={q} onDone={onDone} />;
    case 'truefalse': return <TrueFalseView q={q} onDone={onDone} />;
    case 'blanks': return <BlanksView q={q} onDone={onDone} />;
    case 'dragwords': return <DragWordsView q={q} onDone={onDone} />;
    case 'markwords': return <MarkWordsView q={q} onDone={onDone} />;
    case 'sortwords': return <SortWordsView q={q} onDone={onDone} />;
    case 'sortparas': return <SortParasView q={q} onDone={onDone} />;
    case 'summary': return <SummaryView q={q} onDone={onDone} />;
    case 'match': return <MatchView q={q} onDone={onDone} />;
    case 'memory': return <MemoryView q={q} onDone={onDone} />;
    case 'cards': return <CardsView q={q} onDone={onDone} />;
    case 'essay': return <EssayView q={q} onDone={onDone} />;
    case 'wordsearch': return <WordSearchView q={q} onDone={onDone} />;
    case 'crossword': return <CrosswordView q={q} onDone={onDone} />;
    case 'dictation': return <DictationView q={q} onDone={onDone} />;
    case 'personality': return <PersonalityView q={q} onDone={onDone} />;
    case 'arith': return <ArithView q={q} onDone={onDone} />;
  }
}

export default function QuizApp({ canGenerate }: { canGenerate: boolean }) {
  const [screen, setScreen] = useState<Screen>('home');
  const [quiz, setQuiz] = useState<Quiz>({ title: 'Your quiz', qs: [] });
  const [game, setGame] = useState<Game | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<Status>({ msg: '', err: false, busy: false });
  const [bestXp, setBestXp] = useState(0);
  const [picked, setPicked] = useState<Set<QType>>(new Set(MIXED));
  const [count, setCount] = useState(8);
  const [ops, setOps] = useState<Op[]>(['+', '-', '×']);

  const abortRef = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const partsRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);
  const gameRef = useRef<Game | null>(null);
  gameRef.current = game;

  useEffect(() => {
    try { setBestXp(parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => () => { if (thumb) URL.revokeObjectURL(thumb); }, [thumb]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [screen]);
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

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

  /* ---------- home and options ---------- */
  function pickPhoto(file: File | undefined | null) {
    if (!file) return;
    setPhoto(file);
    setThumb(URL.createObjectURL(file));
    setStatus({ msg: '', err: false, busy: false });
  }

  function toggleType(t: QType) {
    setPicked((cur) => {
      const n = new Set(cur);
      const ex = info(t)?.exclusive;
      if (n.has(t)) { n.delete(t); return n; }
      if (ex) return new Set([t]);
      Array.from(n).forEach((x) => { if (info(x)?.exclusive) n.delete(x); });
      n.add(t);
      return n;
    });
  }
  const toggleOp = (o: Op) => setOps((cur) => (cur.includes(o) ? (cur.length > 1 ? cur.filter((x) => x !== o) : cur) : [...cur, o]));

  async function createQuiz() {
    const types = Array.from(picked);
    if (!types.length) return;
    if (types.includes('arith')) {
      openReview({ title: 'Arithmetic quiz', qs: makeArithmetic(ops, Math.min(count, 15)) });
      return;
    }
    if (!photo) return;
    const ctl = new AbortController();
    abortRef.current = ctl;
    setStatus({ msg: 'Reading your photo and writing questions…', err: false, busy: true });
    try {
      const image = await prepareImage(photo);
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, mediaType: 'image/jpeg', types, count }),
        signal: ctl.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; title?: string; questions?: Q[]; outcomes?: Persona[] };
      if (!res.ok || !data.questions) throw new Error(data.error || 'Something went wrong while reading the photo. Try again.');
      setStatus({ msg: '', err: false, busy: false });
      openReview({ title: data.title || 'Your quiz', qs: data.questions, outcomes: data.outcomes });
    } catch (e) {
      if (ctl.signal.aborted) setStatus({ msg: '', err: false, busy: false });
      else setStatus({ msg: e instanceof Error ? e.message : 'Something went wrong. Try again.', err: true, busy: false });
    } finally {
      abortRef.current = null;
    }
  }

  function openReview(qz: Quiz) {
    setQuiz(qz);
    setScreen('review');
  }

  /* ---------- game ---------- */
  function begin(qz: Quiz) {
    if (!qz.qs.length) return;
    setGame({
      quiz: qz, i: 0, run: (gameRef.current?.run ?? 0) + 1, xp: 0, streak: 0, best: 0, lives: qz.lives ?? 3,
      right: 0, miss: [], verdict: null, tally: Array(Math.max(qz.outcomes?.length ?? 0, 1)).fill(0),
    });
    setScreen('game');
  }

  function finish(g: Game) {
    if (g.xp > bestXp) {
      setBestXp(g.xp);
      try { localStorage.setItem(BEST_KEY, String(g.xp)); } catch { /* ignore */ }
    }
    setScreen('result');
    const done = g.right + g.miss.length;
    if (g.quiz.qs[0]?.type === 'personality' || (done ? g.right / done : 0) >= 0.6) burst(90);
  }

  function advance(g: Game) {
    if (g.i >= g.quiz.qs.length - 1 || g.lives <= 0) { finish(g); return; }
    setGame({ ...g, i: g.i + 1, verdict: null });
  }

  const onDone = useCallback((d: Done) => {
    const g = gameRef.current;
    if (!g || g.verdict) return;
    const q = g.quiz.qs[g.i];
    if (q.type === 'personality') {
      const tally = g.tally.slice();
      if (d.pick !== undefined) tally[d.pick] = (tally[d.pick] ?? 0) + 1;
      const ng = { ...g, tally };
      setTimeout(() => { const cur = gameRef.current; if (cur && cur.i === g.i && cur.run === g.run) advance({ ...ng }); }, 450);
      setGame(ng);
      return;
    }
    let ng: Game;
    let gain = 0;
    if (d.ok) {
      const streak = g.streak + 1;
      gain = 10 + Math.min(streak - 1, 5) * 3 + (d.bonus ?? 0);
      ng = { ...g, streak, best: Math.max(g.best, streak), right: g.right + 1, xp: g.xp + gain };
    } else {
      ng = { ...g, streak: 0, lives: g.lives - 1, miss: [...g.miss, g.i] };
    }
    ng.verdict = { ok: d.ok, gain, note: d.note ?? '' };
    setGame(ng);
    if (d.ok && ng.streak >= 3) burst(24);
    if (d.ok && q.type === 'single') {
      setTimeout(() => { const cur = gameRef.current; if (cur && cur.i === g.i && cur.run === g.run && cur.verdict) advance(cur); }, 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst, bestXp]);

  /* ---------- derived ---------- */
  const qs = game?.quiz.qs ?? [];
  const q = game ? qs[game.i] : null;
  const personality = qs[0]?.type === 'personality';
  const done = game ? game.right + game.miss.length : 0;
  const acc = done ? Math.round(((game?.right ?? 0) / done) * 100) : 0;
  const outOfLives = !!game && !personality && game.lives <= 0 && game.i < qs.length - 1;
  const stars = outOfLives ? (acc >= 60 ? 1 : 0) : acc >= 90 ? 3 : acc >= 60 ? 2 : 1;
  const missedQs: Q[] = game ? game.miss.map((i) => qs[i]).concat(qs.slice(game.i + 1)).filter(Boolean) : [];
  const persona = (() => {
    if (!game || !personality) return null;
    const top = game.tally.reduce((b, v, i) => (v > game.tally[b] ? i : b), 0);
    return game.quiz.outcomes?.[top] ?? null;
  })();
  const needsPhoto = Array.from(picked).some((t) => info(t)?.photo);
  const canCreate = picked.size > 0 && (!needsPhoto || (!!photo && canGenerate)) && !status.busy;
  const isLast = !!game && (game.i >= qs.length - 1 || game.lives <= 0);

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
              <p className="sq-muted">Upload a picture of questions or a text, then choose the kind of quiz: multiple choice, drag the words, crossword, memory game and more. Earn XP, build streaks and keep your lives.</p>
            </div>
            <label
              className={`sq-drop${over ? ' sq-over' : ''}${canGenerate ? '' : ' sq-off'}`}
              htmlFor="sq-file"
              onDragEnter={(e) => { e.preventDefault(); if (canGenerate) setOver(true); }}
              onDragOver={(e) => { e.preventDefault(); if (canGenerate) setOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
              onDrop={(e) => { e.preventDefault(); setOver(false); if (canGenerate) pickPhoto(e.dataTransfer.files[0]); }}
            >
              <strong>Drop a photo here or tap to choose one</strong>
              <div className="sq-muted sq-small">JPG, PNG or WebP. Printed text works best.</div>
              <input id="sq-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={!canGenerate} onChange={(e) => pickPhoto(e.target.files?.[0])} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumb && <img className="sq-thumb" src={thumb} alt="Selected photo" />}
            </label>
            <div className="sq-row" style={{ marginTop: 14 }}>
              <button className="sq-btn" disabled={!photo || !canGenerate} onClick={() => setScreen('options')}>Choose quiz type</button>
              <button className="sq-btn sq-sun" onClick={() => openReview({ title: 'Sample quiz: English grammar', qs: SAMPLE_GRAMMAR.map((s) => ({ ...s })) })}>Play the sample quiz</button>
            </div>
            <div className="sq-row" style={{ marginTop: 10 }}>
              <button className="sq-btn sq-ghost" onClick={() => openReview({ title: 'Every quiz type', qs: SAMPLE_ALL.map((s) => ({ ...s })), lives: 9 })}>Try every quiz type</button>
              <button className="sq-btn sq-ghost" onClick={() => openReview({ title: 'Personality quiz: what kind of learner are you?', qs: SAMPLE_PERSONALITY.qs, outcomes: SAMPLE_PERSONALITY.outcomes })}>Personality quiz</button>
              <button className="sq-btn sq-ghost" onClick={() => { setPicked(new Set<QType>(['arith'])); setScreen('options'); }}>Arithmetic practice</button>
            </div>
            {!canGenerate && (
              <div className="sq-status" role="status">Photo quizzes need the tutor to be signed in. <a href="/login">Sign in</a> to use them. The samples and arithmetic practice work without signing in.</div>
            )}
            <div className="sq-how">
              <div><b>1. Upload</b>Take a photo of a worksheet, textbook page or notes.</div>
              <div><b>2. Choose</b>Pick one or more quiz types and how many questions.</div>
              <div><b>3. Play</b>Correct answers build a streak that multiplies your XP. Three wrong answers end the round.</div>
            </div>
          </section>
        )}

        {screen === 'options' && (
          <section className="sq-card">
            <h2>Choose your quiz type</h2>
            <p className="sq-muted sq-small" style={{ margin: '6px 0 0' }}>Select one or more. Quiz types match the H5P interactive content types.</p>
            {thumb && needsPhoto && (
              <div className="sq-optphoto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb} alt="Your photo" /><span className="sq-muted sq-small">Questions will be made from this photo.</span>
              </div>
            )}
            <div className="sq-row" style={{ marginTop: 12 }}>
              <button className="sq-btn sq-sun" onClick={() => setPicked(new Set(MIXED))}>Mixed quiz</button>
              <button className="sq-btn sq-ghost" onClick={() => setPicked(new Set(TYPE_INFO.filter((t) => !t.exclusive && t.photo).map((t) => t.id)))}>Select all</button>
              <button className="sq-btn sq-ghost" onClick={() => setPicked(new Set())}>Clear</button>
            </div>
            <div className="sq-types" role="group" aria-label="Quiz types">
              {TYPE_INFO.map((t) => {
                const on = picked.has(t.id);
                const off = t.photo && !photo;
                return (
                  <button key={t.id} type="button" className={`sq-type${on ? ' sq-on' : ''}`} aria-pressed={on} disabled={off} onClick={() => toggleType(t.id)}>
                    <b>{t.title}</b>
                    <span>{t.blurb}</span>
                    <small>H5P: {t.h5p}</small>
                  </button>
                );
              })}
            </div>
            {!photo && <p className="sq-muted sq-small">Upload a photo on the first screen to unlock the other types.</p>}
            <div className="sq-row" style={{ marginTop: 14 }}>
              <label className="sq-small" htmlFor="sq-count"><b>How many questions</b></label>
              <select id="sq-count" className="sq-select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[4, 6, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {picked.has('arith') && (
              <div className="sq-row" style={{ marginTop: 10 }}>
                <b className="sq-small">Sums:</b>
                {(['+', '-', '×', '÷'] as Op[]).map((o) => (
                  <button key={o} type="button" className={`sq-op${ops.includes(o) ? ' sq-on' : ''}`} aria-pressed={ops.includes(o)} onClick={() => toggleOp(o)}>{o === '-' ? '−' : o}</button>
                ))}
              </div>
            )}
            <div className="sq-row" style={{ marginTop: 16 }}>
              <button className="sq-btn" disabled={!canCreate} onClick={createQuiz}>{status.busy ? 'Working…' : 'Create quiz'}</button>
              {status.busy && <button className="sq-btn sq-ghost" onClick={() => abortRef.current?.abort()}>Stop</button>}
              <button className="sq-btn sq-ghost" disabled={status.busy} onClick={() => setScreen('home')}>Back</button>
            </div>
            {status.msg && <div className={`sq-status${status.err ? ' sq-err' : ''}`} role="status">{status.msg}</div>}
          </section>
        )}

        {screen === 'review' && (
          <section className="sq-card">
            <h2>{quiz.title}</h2>
            <p className="sq-muted sq-small" style={{ margin: '6px 0 0' }}>Remove any question that was read wrongly, then start.</p>
            <ul className="sq-qlist">
              {quiz.qs.map((item, i) => (
                <li key={i}>
                  <span className="sq-tag">{info(item.type)?.title ?? item.type}</span>
                  <span className="sq-txt">{summarise(item)}</span>
                  <button className="sq-x" aria-label={`Remove question ${i + 1}`} onClick={() => setQuiz({ ...quiz, qs: quiz.qs.filter((_, k) => k !== i) })}>×</button>
                </li>
              ))}
            </ul>
            <div className="sq-row" style={{ marginTop: 16 }}>
              <button className="sq-btn" disabled={!quiz.qs.length} onClick={() => begin(quiz)}>Start the quiz</button>
              <button className="sq-btn sq-ghost" onClick={() => setScreen('home')}>Back</button>
            </div>
          </section>
        )}

        {screen === 'game' && game && q && (
          <section className="sq-card">
            <div className="sq-hud">
              <div className="sq-hearts" aria-label={personality ? 'No lives in this quiz' : `${game.lives} lives left`}>
                {!personality && Array.from({ length: Math.min(game.quiz.lives ?? 3, 5) }, (_, k) => <span key={k} className={k >= game.lives ? 'sq-gone' : ''}>♥</span>)}
              </div>
              <div className="sq-bar" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((game.i / qs.length) * 100)}>
                <i style={{ width: `${(game.i / qs.length) * 100}%` }} />
              </div>
              <div className="sq-score">
                {!personality && <><span>{game.xp}</span> XP</>}
                {game.streak >= 2 && <span className="sq-streak">{game.streak} in a row</span>}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="sq-kind">{info(q.type)?.title} · {game.i + 1} of {qs.length}</div>
              <div className="sq-prompt">{promptOf(q)}</div>
              <div key={`${game.run}-${game.i}`}>{renderQuestion(q, onDone)}</div>

              {game.verdict && !personality && (
                <div className={`sq-fb ${game.verdict.ok ? 'sq-ok' : 'sq-no'}`} role="status">
                  <h3>{game.verdict.ok ? `Correct! +${game.verdict.gain} XP${game.streak >= 3 ? ` · streak x${game.streak}` : ''}` : 'Not quite'}</h3>
                  {game.verdict.note && <p>{game.verdict.note}</p>}
                  {q.explain && <p className="sq-small">{q.explain}</p>}
                </div>
              )}
              {game.verdict && !personality && (
                <div className="sq-foot">
                  <button className="sq-btn" autoFocus onClick={() => advance(game)}>{isLast ? 'See results' : 'Continue'}</button>
                </div>
              )}
            </div>
          </section>
        )}

        {screen === 'result' && game && (
          <section className="sq-card">
            {personality ? (
              <>
                <div className="sq-kind">Your result</div>
                <h2 style={{ marginTop: 8 }}>{persona?.title ?? 'All done!'}</h2>
                <p className="sq-muted" style={{ margin: '8px 0 0' }}>{persona?.description ?? 'Thanks for playing.'}</p>
                <div className="sq-row" style={{ marginTop: 18 }}>
                  <button className="sq-btn" onClick={() => begin(game.quiz)}>Play again</button>
                  <button className="sq-btn sq-ghost" onClick={() => setScreen('home')}>Home</button>
                </div>
              </>
            ) : (
              <>
                <div className="sq-stars" aria-hidden="true">{[0, 1, 2].map((k) => <span key={k} className={k < stars ? 'sq-on' : ''}>★</span>)}</div>
                <h2 style={{ marginTop: 10 }}>{outOfLives ? 'Out of lives. Good effort.' : acc === 100 ? 'Perfect round!' : acc >= 60 ? 'Nice work!' : 'Keep practising!'}</h2>
                <p className="sq-muted" style={{ margin: '6px 0 0' }}>
                  {outOfLives ? `You answered ${done} of ${qs.length} questions before running out.` : `${game.right} of ${qs.length} correct.`}
                </p>
                <div className="sq-stats">
                  <div><b>{game.xp}</b><span className="sq-muted sq-small">XP earned</span></div>
                  <div><b>{acc}%</b><span className="sq-muted sq-small">Accuracy</span></div>
                  <div><b>{game.best}</b><span className="sq-muted sq-small">Best streak</span></div>
                </div>
                <div className="sq-row">
                  <button className="sq-btn" onClick={() => begin({ ...game.quiz, qs: shuffle(game.quiz.qs) })}>Play again</button>
                  {missedQs.length > 0 && <button className="sq-btn sq-sun" onClick={() => begin({ ...game.quiz, qs: missedQs })}>Practise missed ones</button>}
                  <button className="sq-btn sq-ghost" onClick={() => setScreen('home')}>New photo</button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
