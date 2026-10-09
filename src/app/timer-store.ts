import { useEffect, useSyncExternalStore } from 'react';
import { timerSounds } from './timer-sounds';
import { TIMER_EFFECTS, type TimerEffect } from './timer-effects';

/**
 * The activity timer lives here, outside any page, so it keeps running (and keeps its look and sound)
 * while the teacher moves between pages. It counts down to a fixed end time, so it stays accurate even
 * when the browser slows a background tab. It is also saved, so a page reload does not lose it.
 */
export type TimerState = {
  duration: number; remaining: number; running: boolean; endsAt: number | null;
  effect: TimerEffect; sound: boolean; activity: string; classroom: string;
  /** True once the timer was started: the floating timer shows until it is closed. */
  shown: boolean;
};

const KEY = 'ezgili-timer-state';
const initial: TimerState = { duration: 300, remaining: 300, running: false, endsAt: null, effect: 'ring', sound: true, activity: 'Quiet reading', classroom: '', shown: false };

let state: TimerState = initial;
let loaded = false;
let fuseOn = false;
const listeners = new Set<() => void>();

const store = {
  get: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};

function persist() {
  try {
    const { effect, sound, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
    localStorage.setItem('ezgili-timer-effect', effect);
    localStorage.setItem('ezgili-timer-sound', sound ? 'on' : 'off');
  } catch { /* storage can be blocked */ }
}

function set(patch: Partial<TimerState>) {
  state = { ...state, ...patch };
  persist();
  const wantFuse = state.effect === 'bomb' && state.running && state.sound;
  if (wantFuse !== fuseOn) { fuseOn = wantFuse; timerSounds.fuse(wantFuse); }
  listeners.forEach((l) => l());
}

/** Reads the saved timer once. Safe to call many times. */
export function loadTimer() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<TimerState> | null;
    const effect = localStorage.getItem('ezgili-timer-effect');
    const next: TimerState = { ...initial, ...(saved || {}) };
    if (TIMER_EFFECTS.some((e) => e.id === effect)) next.effect = effect as TimerEffect;
    next.sound = localStorage.getItem('ezgili-timer-sound') !== 'off';
    if (next.running && next.endsAt) {
      next.remaining = Math.max(0, Math.ceil((next.endsAt - Date.now()) / 1000));
      if (next.remaining === 0) { next.running = false; next.endsAt = null; }
    } else next.running = false;
    state = next;
    listeners.forEach((l) => l());
  } catch { /* start fresh */ }
}

function tick() {
  if (!state.running || !state.endsAt) return;
  const remaining = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
  if (remaining === state.remaining) return;
  const finished = remaining === 0;
  const { sound, effect, duration } = state;
  set({ remaining, running: !finished, endsAt: finished ? null : state.endsAt });
  if (sound) { if (finished) timerSounds.finish(effect); else timerSounds.second(effect, remaining, duration); }
}

let engine: ReturnType<typeof setInterval> | null = null;
/** Starts the one clock that moves the timer. Called once by the floating timer, which is on every page. */
export function startTimerEngine() {
  loadTimer();
  if (engine) return;
  engine = setInterval(tick, 250);
}

export const timerStore = {
  start(classroom?: string) {
    const remaining = state.remaining === 0 ? state.duration : state.remaining;
    timerSounds.unlock();
    if (state.sound) timerSounds.start(state.effect);
    set({ remaining, running: true, endsAt: Date.now() + remaining * 1000, shown: true, classroom: classroom ?? state.classroom });
  },
  pause() {
    if (!state.running) return;
    set({ running: false, endsAt: null, remaining: state.endsAt ? Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)) : state.remaining });
  },
  reset() { set({ running: false, endsAt: null, remaining: state.duration }); },
  setPreset(minutes: number) { const seconds = Math.round(minutes * 60); set({ duration: seconds, remaining: seconds, running: false, endsAt: null }); },
  /** Closes the floating timer. */
  dismiss() { timerSounds.stop(); set({ running: false, endsAt: null, remaining: state.duration, shown: false }); },
  setEffect(effect: TimerEffect) { set({ effect }); },
  setActivity(activity: string) { set({ activity }); },
  toggleSound() { const sound = !state.sound; if (sound) timerSounds.unlock(); else timerSounds.stop(); set({ sound }); },
};

export const formatClock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export function useTimer(): TimerState {
  useEffect(() => { loadTimer(); }, []);
  return useSyncExternalStore(store.subscribe, store.get, () => initial);
}
