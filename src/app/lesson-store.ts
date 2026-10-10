import { useEffect, useSyncExternalStore } from 'react';
import { recordLesson } from './ballot-alert';
import { className, currentLesson, nextLesson, scheduleClock, type Slot } from './lesson-schedule';

/**
 * The lesson countdown and the weekly timetable live here, outside any page.
 * A lesson starts by itself at the start of each timetable period and ends with the school bell.
 * It only runs while Ezgili Champs is open in a browser tab.
 */
export type LessonState = {
  deadline: number | null; classroom: string; label: string;
  /** When the running lesson began, so an early End lesson can still count if most of it was taught. */
  startedAt: number | null;
  /** True when the timetable started this lesson (the teacher did not press Start). */
  fromSchedule: boolean;
  auto: boolean; now: number;
  /** Set when a lesson has just finished, until it is dismissed. */
  ended: string | null;
};

const KEY = 'ezgili-lesson-bell';
const AUTO_KEY = 'ezgili-auto-lessons';
const DONE_KEY = 'ezgili-auto-lesson-done';

const initial: LessonState = { deadline: null, startedAt: null, classroom: '', label: '', fromSchedule: false, auto: true, now: 0, ended: null };
let state: LessonState = initial;
let loaded = false;
let autoDone = '';
const listeners = new Set<() => void>();
const store = {
  get: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};

function set(patch: Partial<LessonState>) { state = { ...state, ...patch }; listeners.forEach((l) => l()); }

function save() {
  try {
    if (state.deadline) localStorage.setItem(KEY, JSON.stringify({ deadline: state.deadline, startedAt: state.startedAt, classroom: state.classroom, label: state.label, fromSchedule: state.fromSchedule }));
    else localStorage.removeItem(KEY);
  } catch { /* storage can be blocked */ }
}

let bellContext: AudioContext | null = null;
/** Browsers only allow sound after a first tap, so the first tap anywhere prepares the bell. */
function prepareBell() {
  try { bellContext ??= new window.AudioContext(); void bellContext.resume(); } catch { /* no audio */ }
}

export function ringSchoolBell() {
  try {
    prepareBell();
    const context = bellContext;
    if (!context) return;
    void context.resume().then(() => {
      const master = context.createGain();
      master.gain.value = 0.24;
      master.connect(context.destination);
      [0, 0.62, 1.24].forEach((offset) => {
        ([[880, 1], [1320, 0.45], [1760, 0.2]] as const).forEach(([frequency, volume]) => {
          const oscillator = context.createOscillator(), gain = context.createGain(), at = context.currentTime + offset;
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(volume * 0.38, at + 0.018);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
          oscillator.connect(gain);
          gain.connect(master);
          oscillator.start(at);
          oscillator.stop(at + 0.92);
        });
      });
    });
  } catch { /* no audio */ }
}

const announce = (name: string, detail: Record<string, unknown>) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* ignore */ } };

export function loadLessons() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<LessonState> | null;
    autoDone = localStorage.getItem(DONE_KEY) || '';
    const auto = localStorage.getItem(AUTO_KEY) !== 'off';
    if (saved?.deadline && saved.deadline > Date.now()) set({ auto, now: Date.now(), deadline: saved.deadline, startedAt: saved.startedAt ?? null, classroom: saved.classroom || '', label: saved.label || '', fromSchedule: Boolean(saved.fromSchedule) });
    else { set({ auto, now: Date.now() }); if (saved) save(); }
  } catch { set({ now: Date.now() }); }
}

function tick() {
  const at = Date.now();
  if (state.deadline) {
    if (at >= state.deadline) {
      const name = state.classroom || 'your class';
      set({ deadline: null, startedAt: null, classroom: '', label: '', fromSchedule: false, now: at, ended: name });
      save();
      ringSchoolBell();
      recordLesson(name === 'your class' ? '' : name); // every 3rd lesson of the week for a class starts the ballot alert
      announce('ezgili-lesson-ended', { classroom: name });
    } else set({ now: at });
  } else if (Math.floor(at / 60000) !== Math.floor(state.now / 60000)) set({ now: at }); // keeps "up next" fresh
  if (!state.auto) return;
  const lesson = currentLesson(scheduleClock.now());
  if (!lesson || lesson.key === autoDone) return;
  if (state.deadline && state.fromSchedule) return; // already inside a timetable lesson
  autoDone = lesson.key;
  try { localStorage.setItem(DONE_KEY, autoDone); } catch { /* ignore */ }
  const name = className(lesson.cls);
  set({ deadline: lesson.endsAt, startedAt: lesson.startsAt, classroom: name, label: lesson.label, fromSchedule: true, now: at, ended: null });
  save();
  if (at - lesson.startsAt < 20000) ringSchoolBell(); // a lesson that is starting right now gets a bell; one joined late does not
  announce('ezgili-lesson-started', { classroom: name, label: lesson.label });
}

let engine: ReturnType<typeof setInterval> | null = null;
export function startLessonEngine() {
  loadLessons();
  if (engine) return;
  const unlock = () => { prepareBell(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  tick();
  engine = setInterval(tick, 1000);
}

export const lessonStore = {
  start(classroom: string) {
    prepareBell();
    set({ deadline: Date.now() + 40 * 60 * 1000, startedAt: Date.now(), classroom, label: classroom, fromSchedule: false, now: Date.now(), ended: null });
    save();
  },
  stop() {
    // ending a lesson with most of it taught still counts towards the ballot, without the alert popping up while you are closing the lesson
    const taught = state.startedAt && state.deadline ? Date.now() - state.startedAt >= (state.deadline - state.startedAt) / 2 : false;
    const name = state.classroom;
    set({ deadline: null, startedAt: null, classroom: '', label: '', fromSchedule: false, ended: null });
    save();
    if (taught && name) recordLesson(name);
  },
  setAuto(auto: boolean) { try { localStorage.setItem(AUTO_KEY, auto ? 'on' : 'off'); } catch { /* ignore */ } set({ auto }); },
  clearEnded() { set({ ended: null }); },
};

export function useLesson() {
  useEffect(() => { loadLessons(); }, []);
  const lesson = useSyncExternalStore(store.subscribe, store.get, () => initial);
  const remaining = lesson.deadline ? Math.max(0, Math.ceil((lesson.deadline - (lesson.now || Date.now())) / 1000)) : 0;
  const display = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const upNext: Slot | null = lesson.deadline || !lesson.now ? null : nextLesson(new Date(lesson.now));
  return { ...lesson, remaining, display, upNext };
}
