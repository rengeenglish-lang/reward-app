'use client';

import { useEffect, useRef } from 'react';

const APPLAUSE = '/sounds/applause.mp3';
const PREFS_KEY = 'ezgili-classroom-fun';
const HALF_MS = 3500; // a short cheer when the class goal is halfway
const FULL_MS = 9000; // a longer one when it is reached

type Milestone = 'half' | 'full';

function readGoal(classroomId: string): number {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return Math.max(1, Number(prefs.goals?.[classroomId]) || 20);
  } catch { return 20; }
}

/** Plays the applause recording, softer and shorter for the halfway cheer. Respects the "Celebration style" setting. */
export function playGoalSound(kind: Milestone) {
  try {
    const mode = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}').celebrationSound || 'applause';
    if (mode === 'silent') return;
    const audio = new Audio(APPLAUSE);
    const volume = (kind === 'half' ? 0.55 : 1) * (mode === 'gentle' ? 0.4 : 1);
    const limit = kind === 'half' ? HALF_MS : FULL_MS;
    audio.volume = volume;
    const begun = performance.now();
    const timer = window.setInterval(() => {
      const t = performance.now() - begun;
      if (t >= limit) { audio.pause(); window.clearInterval(timer); return; }
      if (t > limit - 1000) audio.volume = Math.max(0, (volume * (limit - t)) / 1000); // fade out over the last second
    }, 80);
    audio.addEventListener('ended', () => window.clearInterval(timer));
    void audio.play().catch(() => window.clearInterval(timer)); // browsers may block sound before the first tap on the page
  } catch { /* sound is a nice extra, never an error */ }
}

/**
 * Plays a cheer by itself the moment the class goal passes half and again when it is fully reached.
 * It only reacts to small steps (a student's check box), so opening the page or switching class stays quiet,
 * and each milestone plays once per class per day.
 */
export function useGoalSounds(classroomId: string, earned: number, today: string) {
  const last = useRef<{ classroomId: string; earned: number; goal: number } | null>(null);

  useEffect(() => {
    if (!classroomId) return;
    const goal = readGoal(classroomId);
    const before = last.current;
    last.current = { classroomId, earned, goal };
    if (!before || before.classroomId !== classroomId || before.goal !== goal) return; // first look: just remember where we are
    const step = earned - before.earned;
    if (step <= 0 || step > 3) return;

    const key = `ezgili-goal-sound-${today}-${classroomId}`;
    let played: { half?: boolean; full?: boolean } = {};
    try { played = JSON.parse(localStorage.getItem(key) || '{}'); } catch { /* none yet */ }
    const half = Math.ceil(goal / 2);

    let fire: Milestone | null = null;
    if (before.earned < goal && earned >= goal && !played.full) { fire = 'full'; played = { half: true, full: true }; }
    else if (before.earned < half && earned >= half && !played.half) { fire = 'half'; played = { ...played, half: true }; }
    if (!fire) return;

    try { localStorage.setItem(key, JSON.stringify(played)); } catch { /* ignore */ }
    playGoalSound(fire);
  }, [classroomId, earned, today]);
}
