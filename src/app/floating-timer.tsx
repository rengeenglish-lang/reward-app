'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TimerStage from './timer-effects';
import { formatClock, startTimerEngine, timerStore, useTimer } from './timer-store';
import { lessonStore, startLessonEngine, useLesson } from './lesson-store';

type Pos = { x: number; y: number };
const POS_KEY = 'ezgili-float-pos';
const MIN_KEY = 'ezgili-float-min';

type DocPiP = { requestWindow: (o?: { width?: number; height?: number }) => Promise<Window> };
const pipApi = (): DocPiP | null => (typeof window !== 'undefined' && (window as unknown as { documentPictureInPicture?: DocPiP }).documentPictureInPicture) || null;

/**
 * The timer and the lesson countdown, floating over every page. It is mounted once in the root layout,
 * so changing page never closes it. Drag the top bar to move it anywhere; the dash button shrinks it to a pill.
 */
export default function FloatingTimer() {
  const timer = useTimer();
  const lesson = useLesson();
  const [pos, setPos] = useState<Pos | null>(null);
  const [mini, setMini] = useState(false);
  const [look, setLook] = useState(false);
  const [pip, setPip] = useState<Window | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => { startTimerEngine(); startLessonEngine(); }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null') as Pos | null;
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) setPos(saved);
      setMini(localStorage.getItem(MIN_KEY) === 'on');
    } catch { /* storage can be blocked */ }
  }, []);

  const clamp = useCallback((p: Pos): Pos => {
    const w = box.current?.offsetWidth ?? 300, h = box.current?.offsetHeight ?? 120;
    return { x: Math.min(Math.max(0, p.x), Math.max(0, window.innerWidth - w)), y: Math.min(Math.max(0, p.y), Math.max(0, window.innerHeight - h)) };
  }, []);
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPos(clamp({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }));
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setPos((p) => { if (p) { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* ignore */ } } return p; });
  };
  const toggleMini = () => { const next = !mini; setMini(next); try { localStorage.setItem(MIN_KEY, next ? 'on' : 'off'); } catch { /* ignore */ } };

  const popOut = async () => {
    const api = pipApi();
    if (!api) return;
    try {
      const win = await api.requestWindow({ width: 320, height: 220 });
      document.documentElement.getAttributeNames().forEach((n) => win.document.documentElement.setAttribute(n, document.documentElement.getAttribute(n) ?? ''));
      document.body.getAttributeNames().forEach((n) => win.document.body.setAttribute(n, document.body.getAttribute(n) ?? ''));
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const style = win.document.createElement('style');
          style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
          win.document.head.appendChild(style);
        } catch {
          if (sheet.href) { const link = win.document.createElement('link'); link.rel = 'stylesheet'; link.href = sheet.href; win.document.head.appendChild(link); }
        }
      }
      win.addEventListener('pagehide', () => setPip(null));
      setPip(win);
    } catch { /* the browser said no */ }
  };

  const timerOn = timer.shown;
  const lessonOn = Boolean(lesson.deadline);
  if (!timerOn && !lessonOn && !lesson.ended) return null;

  const finished = timerOn && timer.remaining === 0 && !timer.running;
  const clock = formatClock(timer.remaining);
  const pct = Math.round((1 - timer.remaining / Math.max(1, timer.duration)) * 100);

  const content = (inPip: boolean) => (
    <>
      {timerOn && (
        <div className={`ft-timer${finished ? ' done' : ''}`}>
          <div className="ft-row">
            <strong className="ft-clock" aria-live="off">{clock}</strong>
            <span className="ft-label">{finished ? 'Time’s up! 🌟' : timer.activity || 'Timer'}{timer.classroom ? ` · ${timer.classroom}` : ''}</span>
          </div>
          <div className="ft-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
          {look && !inPip && timer.effect !== 'ring' && <div className="ft-stage"><TimerStage effect={timer.effect} remaining={timer.remaining} duration={timer.duration} running={timer.running} clock={clock} size="card" /></div>}
          <div className="ft-actions">
            <button type="button" onClick={() => (timer.running ? timerStore.pause() : timerStore.start())} aria-label={timer.running ? 'Pause timer' : 'Start timer'}>{timer.running ? '⏸ Pause' : finished ? '▶ Again' : '▶ Start'}</button>
            <button type="button" onClick={() => timerStore.reset()} aria-label="Reset timer">↺ Reset</button>
            {!inPip && timer.effect !== 'ring' && <button type="button" aria-pressed={look} onClick={() => setLook(!look)}>{look ? 'Hide look' : 'Show look'}</button>}
            <button type="button" onClick={() => timerStore.dismiss()} aria-label="Close timer">✕ Close</button>
          </div>
        </div>
      )}
      {lessonOn && (
        <div className="ft-lesson">
          <div className="ft-row">
            <strong className="ft-clock">{lesson.display}</strong>
            <span className="ft-label">🔔 {lesson.label || lesson.classroom} · lesson{lesson.fromSchedule ? ' (timetable)' : ''}</span>
          </div>
          <div className="ft-actions"><button type="button" onClick={() => lessonStore.stop()}>End lesson</button></div>
        </div>
      )}
      {lesson.ended && !lessonOn && (
        <div className="ft-lesson ended" role="status">
          <span className="ft-label">🔔 Lesson complete for {lesson.ended}!</span>
          <div className="ft-actions"><button type="button" onClick={() => lessonStore.clearEnded()}>Okay</button></div>
        </div>
      )}
    </>
  );

  if (pip) return createPortal(<div className="ft-card ft-pip">{content(true)}</div>, pip.document.body);

  const style: React.CSSProperties = pos ? { left: pos.x, top: pos.y } : { right: 16, bottom: 16 };
  const miniText = timerOn ? clock : lessonOn ? lesson.display : '🔔';

  return (
    <div ref={box} className={`ft-card${mini ? ' mini' : ''}`} style={style} role="region" aria-label="Floating timer">
      <div className="ft-handle" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} title="Drag me anywhere">
        <span aria-hidden="true">⠿</span>
        <b>{mini ? miniText : timerOn ? 'Timer' : 'Lesson'}</b>
        <span className="ft-spacer" />
        {pipApi() && !mini && <button type="button" onClick={popOut} aria-label="Pop out over other windows" title="Pop out over other windows">⧉</button>}
        <button type="button" onClick={toggleMini} aria-label={mini ? 'Expand timer' : 'Shrink timer'} title={mini ? 'Expand' : 'Shrink'}>{mini ? '▢' : '–'}</button>
      </div>
      {!mini && content(false)}
    </div>
  );
}
