'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPeriodReport } from './actions';
import { playGoalSound } from './goal-sounds';

export type WeeklyGoal = { id: string; title: string; emoji: string; target: number };
type Saved = { goals: WeeklyGoal[]; reached: string[] };
export type WeeklyState = {
  goals: WeeklyGoal[];
  stars: number;
  setGoals: (goals: WeeklyGoal[]) => void;
  celebrate: WeeklyGoal | null;
  dismiss: () => void;
};

const EMPTY: Saved = { goals: [], reached: [] };

/** Where the week's stars come from. Tests can swap this out. */
export const weeklySource = { fetch: (classroomId: string) => getPeriodReport(classroomId, 'week') as Promise<{ from: unknown; rows: { total?: unknown }[] }> };
export const GOAL_IDEAS: { emoji: string; title: string; target: number }[] = [
  { emoji: '🌱', title: 'A good start', target: 30 },
  { emoji: '⭐', title: 'Halfway hero', target: 60 },
  { emoji: '📚', title: 'Reading champions', target: 90 },
  { emoji: '🏆', title: 'Weekly champions', target: 120 },
];

/**
 * This week's class goals for one classroom (Monday to Sunday). The stars come from the weekly report, the goals are
 * chosen by the teacher and kept in this browser. When the stars pass a goal it is marked reached once, and celebrated.
 */
export function useWeeklyGoals(classroomId: string, earnedToday: number): WeeklyState {
  const [week, setWeek] = useState<{ from: string; stars: number } | null>(null);
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [celebrate, setCelebrate] = useState<WeeklyGoal | null>(null);
  const quiet = useRef(true); // goals that are already met when they load or are added stay silent
  const [readyKey, setReadyKey] = useState('');

  useEffect(() => {
    if (!classroomId) return;
    let live = true;
    const timer = window.setTimeout(() => {
      weeklySource.fetch(classroomId)
        .then((r) => { if (live) setWeek({ from: String(r.from), stars: r.rows.reduce((n, row) => n + Number(row.total || 0), 0) }); })
        .catch(() => { /* the slider just keeps its last value */ });
    }, 700);
    return () => { live = false; window.clearTimeout(timer); };
  }, [classroomId, earnedToday]);

  const key = week ? `ezgili-weekly-goals-${classroomId}-${week.from}` : '';

  useEffect(() => {
    if (!key) return;
    try { setSaved(JSON.parse(localStorage.getItem(key) || 'null') || EMPTY); } catch { setSaved(EMPTY); }
    quiet.current = true;
    setReadyKey(key);
  }, [key]);

  useEffect(() => {
    if (!week || !key || readyKey !== key) return;
    const newly = saved.goals.filter((g) => week.stars >= g.target && !saved.reached.includes(g.id));
    const silent = quiet.current;
    quiet.current = false; // only the first look after loading, or after editing the goals, is silent
    if (!newly.length) return;
    const reached = [...saved.reached, ...newly.map((g) => g.id)];
    const next = { ...saved, reached };
    setSaved(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
    if (!silent) {
      setCelebrate(newly[newly.length - 1]);
      playGoalSound(saved.goals.every((g) => reached.includes(g.id)) ? 'full' : 'half');
    }
  }, [week, saved, key, readyKey]);

  const setGoals = useCallback((goals: WeeklyGoal[]) => {
    const sorted = [...goals].sort((a, b) => a.target - b.target);
    const next = { goals: sorted, reached: saved.reached.filter((id) => sorted.some((g) => g.id === id)) };
    quiet.current = true;
    setSaved(next);
    if (key) { try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ } }
  }, [saved.reached, key]);

  const dismiss = useCallback(() => setCelebrate(null), []);
  return { goals: saved.goals, stars: week?.stars ?? 0, setGoals, celebrate, dismiss };
}

/** The slider: it slides along as stars are earned, with a flag at every goal. */
export function WeeklyTrack({ goals, stars, title = 'Our goals this week' }: { goals: WeeklyGoal[]; stars: number; title?: string }) {
  if (!goals.length) return null;
  const max = Math.max(...goals.map((g) => g.target));
  const percent = Math.min(100, (stars / max) * 100);
  const next = goals.find((g) => stars < g.target);
  return (
    <section className="wk-track" aria-label={title}>
      <div className="wk-head">
        <strong>{title}</strong>
        <span>{stars} {stars === 1 ? 'star' : 'stars'}{next ? ` · ${next.target - stars} to go for ${next.emoji} ${next.title}` : ' · every goal reached! 🎉'}</span>
      </div>
      <div className="wk-rail">
        <div className="wk-fill" style={{ width: `${percent}%` }} />
        <div className="wk-knob" style={{ left: `${percent}%` }} aria-hidden="true">⭐</div>
        {goals.map((g) => (
          <span key={g.id} className={`wk-flag${stars >= g.target ? ' reached' : ''}`} style={{ left: `${(g.target / max) * 100}%` }} title={`${g.title}: ${g.target} stars`}>{stars >= g.target ? '✅' : g.emoji}</span>
        ))}
      </div>
      <ul className="wk-list">
        {goals.map((g) => <li key={g.id} className={stars >= g.target ? 'reached' : ''}>{stars >= g.target ? '✅' : g.emoji} {g.title} <b>{g.target}</b></li>)}
      </ul>
    </section>
  );
}

/** Choose this week's goals. */
export function WeeklyGoalEditor({ weekly }: { weekly: WeeklyState }) {
  const { goals, stars, setGoals } = weekly;
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const add = (g?: { emoji: string; title: string; target: number }) => {
    const t = g?.title ?? title.trim();
    const n = g?.target ?? Math.max(1, Math.min(100000, Number(target) || 0));
    if (!t || !n) return;
    setGoals([...goals, { id: crypto.randomUUID(), emoji: g?.emoji ?? '🎯', title: t, target: n }]);
    setTitle(''); setTarget('');
  };
  const unused = GOAL_IDEAS.filter((i) => !goals.some((g) => g.title === i.title));
  return (
    <div className="wk-editor">
      <div className="wk-editor-head">
        <div><h3>Choose this week’s goals</h3><p>Pick what the class is working towards. The class has <b>{stars}</b> {stars === 1 ? 'star' : 'stars'} so far this week (Monday to Sunday).</p></div>
      </div>
      {goals.length > 0 && (
        <ul className="wk-edit-list">
          {goals.map((g) => (
            <li key={g.id}>
              <span aria-hidden="true">{g.emoji}</span>
              <input aria-label="Goal name" value={g.title} maxLength={50} onChange={(e) => setGoals(goals.map((x) => (x.id === g.id ? { ...x, title: e.target.value } : x)))} />
              <input aria-label="Stars needed" type="number" min={1} max={100000} value={g.target} onChange={(e) => setGoals(goals.map((x) => (x.id === g.id ? { ...x, target: Math.max(1, Number(e.target.value) || 1) } : x)))} />
              <button type="button" aria-label={`Remove ${g.title}`} onClick={() => setGoals(goals.filter((x) => x.id !== g.id))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <div className="wk-add">
        <input aria-label="New goal" placeholder="A new goal, e.g. Everyone reads daily" value={title} maxLength={50} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <input aria-label="Stars needed" type="number" min={1} placeholder="Stars" value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <button type="button" className="fun-action primary" disabled={!title.trim() || !Number(target)} onClick={() => add()}>Add goal</button>
      </div>
      {unused.length > 0 && (
        <div className="wk-ideas"><span>Quick ideas:</span>{unused.map((i) => <button key={i.title} type="button" onClick={() => add(i)}>{i.emoji} {i.title} · {i.target}</button>)}</div>
      )}
    </div>
  );
}

/** The celebration when a goal is reached: confetti, the goal and a big cheer. */
export function WeeklyCelebration({ goal, onClose }: { goal: WeeklyGoal | null; onClose: () => void }) {
  useEffect(() => {
    if (!goal) return;
    const t = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(t);
  }, [goal, onClose]);
  if (!goal) return null;
  return (
    <div className="wk-celebrate" role="dialog" aria-modal="true" aria-label="Goal reached" onClick={onClose}>
      <div className="wk-confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.18}s`, ['--c' as string]: ['#ff5d8f', '#ffd24a', '#35c46b', '#4aa8ff', '#9b6bff'][i % 5] }} />)}</div>
      <div className="wk-celebrate-card">
        <span className="wk-big" aria-hidden="true">{goal.emoji}</span>
        <small>GOAL REACHED!</small>
        <h2>{goal.title}</h2>
        <p>The class earned {goal.target} stars this week. Give everyone a huge cheer! 👏</p>
        <button type="button" className="fun-action primary" onClick={onClose}>Hooray!</button>
      </div>
    </div>
  );
}
