import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * "It's ballot time, Champs!": a full-screen alert with blinking amber and red lights and a soft alarm.
 * It starts by itself after every 3 lessons a class has this week, or by hand from Fun & focus.
 * Any click, tap or key press turns it off.
 */
export type BallotAlertState = { active: boolean; classroom: string; reason: 'auto' | 'manual' };
const idle: BallotAlertState = { active: false, classroom: '', reason: 'manual' };

let state: BallotAlertState = idle;
const listeners = new Set<() => void>();
const store = {
  get: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
function set(next: BallotAlertState) { state = next; listeners.forEach((l) => l()); }

const AUTO_KEY = 'ezgili-ballot-auto';
const COUNT_PREFIX = 'ezgili-lesson-count';
const EVENT = 'ezgili-ballot-count';
export const LESSONS_PER_BALLOT = 3;

/* ---------------------------------------------- soft alarm ---------------------------------------------- */

let context: AudioContext | null = null;
let loop: ReturnType<typeof setInterval> | null = null;

function beep() {
  try {
    context ??= new window.AudioContext();
    const ctx = context;
    void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.09; // quiet on purpose: it should be noticed, not startle the class
    master.connect(ctx.destination);
    // two soft, falling notes, then silence: a gentle "ding-dong" that repeats every couple of seconds
    ([[660, 0], [494, 0.34]] as const).forEach(([frequency, offset]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + offset;
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(1, at + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
      osc.connect(gain);
      gain.connect(master);
      osc.start(at);
      osc.stop(at + 0.6);
    });
  } catch { /* no audio */ }
}
const startAlarm = () => { stopAlarm(); beep(); loop = setInterval(beep, 2200); };
function stopAlarm() { if (loop) { clearInterval(loop); loop = null; } }

/** Browsers only allow sound after a first tap, so the first tap anywhere prepares it. */
export function prepareBallotSound() {
  try { context ??= new window.AudioContext(); void context.resume(); } catch { /* no audio */ }
}

/* ---------------------------------------------- controls ---------------------------------------------- */

export function announceBallot(classroom = '', reason: 'auto' | 'manual' = 'manual') {
  set({ active: true, classroom, reason });
  startAlarm();
}
export function dismissBallot() {
  if (!state.active) return;
  stopAlarm();
  set(idle);
}

export const ballotAutoEnabled = () => { try { return localStorage.getItem(AUTO_KEY) !== 'off'; } catch { return true; } };
export function setBallotAuto(on: boolean) {
  try { localStorage.setItem(AUTO_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
}

/* ---------------------------------------------- lessons this week ---------------------------------------------- */

/** The Monday of the current week, as YYYY-MM-DD. A new week starts counting from zero. */
function weekStart(at = new Date()) {
  const d = new Date(at); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const countKey = (classroom: string) => `${COUNT_PREFIX}:${weekStart()}:${classroom}`;

export function lessonCount(classroom: string): number {
  try { return Number(localStorage.getItem(countKey(classroom))) || 0; } catch { return 0; }
}

/** Call when a lesson for this class has finished. Announces the ballot after every 3rd lesson of the week. */
export function recordLesson(classroom: string) {
  if (!classroom) return;
  const next = lessonCount(classroom) + 1;
  try { localStorage.setItem(countKey(classroom), String(next)); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
  if (next % LESSONS_PER_BALLOT === 0 && ballotAutoEnabled()) announceBallot(classroom, 'auto');
}

/** Lessons finished this week for a class, and whether the automatic announcement is on. */
export function useBallotProgress(classroom: string) {
  const [info, setInfo] = useState({ count: 0, auto: true });
  useEffect(() => {
    const read = () => setInfo({ count: lessonCount(classroom), auto: ballotAutoEnabled() });
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener('storage', read);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener('storage', read); };
  }, [classroom]);
  const untilNext = LESSONS_PER_BALLOT - (info.count % LESSONS_PER_BALLOT);
  return { ...info, untilNext };
}

export function useBallotAlert(): BallotAlertState {
  return useSyncExternalStore(store.subscribe, store.get, () => idle);
}
