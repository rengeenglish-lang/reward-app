'use client';

import { useCallback, useEffect, useState } from 'react';

/** The six IB PYP transdisciplinary themes. Teachers can add their own names to this list. */
export const PYP_SIX = [
  { name: 'Who we are', emoji: '🧑‍🤝‍🧑' },
  { name: 'Where we are in place and time', emoji: '🗺️' },
  { name: 'How we express ourselves', emoji: '🎭' },
  { name: 'How the world works', emoji: '🔬' },
  { name: 'How we organize ourselves', emoji: '🏗️' },
  { name: 'Sharing the planet', emoji: '🌍' },
] as const;

const CUSTOM_KEY = 'ezgili-pyp-custom-themes';
const CURRENT_KEY = 'ezgili-pyp-theme-grade4';
const DESC_KEY = 'ezgili-pyp-theme-descriptions';
const EVENT = 'ezgili-pyp-updated';

export type PypCurrent = { theme: string; idea: string };

function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage can be blocked */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
}

/** Re-reads whenever the lists change in this tab or another one. */
function useSynced<T>(load: () => T, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sync = () => setValue(load());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

/** Theme names the teacher added by hand. */
export function useCustomThemes() {
  const custom = useSynced<string[]>(() => { const list = read<string[]>(CUSTOM_KEY, []); return Array.isArray(list) ? list.filter((n) => typeof n === 'string') : []; }, []);
  const add = useCallback((raw: string) => {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!name) return '';
    const all = [...PYP_SIX.map((t) => t.name), ...read<string[]>(CUSTOM_KEY, [])];
    const existing = all.find((n) => n.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    write(CUSTOM_KEY, [...read<string[]>(CUSTOM_KEY, []), name]);
    return name;
  }, []);
  const remove = useCallback((name: string) => {
    write(CUSTOM_KEY, read<string[]>(CUSTOM_KEY, []).filter((n) => n !== name));
    const current = read<PypCurrent>(CURRENT_KEY, { theme: '', idea: '' });
    if (current.theme === name) write(CURRENT_KEY, current.idea ? { theme: '', idea: current.idea } : null);
  }, []);
  /** Renames a theme you added. Keeps it selected if it was the grade's theme. Returns false if the new name is empty or already used. */
  const rename = useCallback((oldName: string, raw: string) => {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!name) return false;
    if (name === oldName) return true;
    const list = read<string[]>(CUSTOM_KEY, []);
    const taken = [...PYP_SIX.map((t) => t.name), ...list.filter((n) => n !== oldName)].some((n) => n.toLowerCase() === name.toLowerCase());
    if (taken) return false;
    write(CUSTOM_KEY, list.map((n) => (n === oldName ? name : n)));
    const descriptions = read<Record<string, string>>(DESC_KEY, {});
    if (descriptions[oldName] !== undefined) { const { [oldName]: moved, ...rest } = descriptions; write(DESC_KEY, { ...rest, [name]: moved }); }
    const current = read<PypCurrent>(CURRENT_KEY, { theme: '', idea: '' });
    if (current.theme === oldName) write(CURRENT_KEY, { theme: name, idea: current.idea });
    return true;
  }, []);
  return { custom, add, remove, rename };
}

/** Every theme name to choose from: the six, then the teacher's own. Used by the Today chip and the plans. */
export function useThemeNames(): string[] {
  const { custom } = useCustomThemes();
  return [...PYP_SIX.map((t) => t.name), ...custom];
}

/** Descriptions you wrote for a theme. A theme without one shows the IB text (or nothing for a theme you added). */
export function useThemeDescriptions() {
  const map = useSynced<Record<string, string>>(() => read<Record<string, string>>(DESC_KEY, {}), {});
  const set = useCallback((name: string, description: string) => {
    const next = { ...read<Record<string, string>>(DESC_KEY, {}) };
    const text = description.trim().slice(0, 600);
    if (text) next[name] = text; else delete next[name];
    write(DESC_KEY, next);
  }, []);
  return { map, set };
}

/** The PYP theme of the whole grade (all Grade 4 classes share it). */
export function usePypCurrent() {
  const current = useSynced<PypCurrent>(() => { const c = read<PypCurrent>(CURRENT_KEY, { theme: '', idea: '' }); return { theme: c.theme || '', idea: c.idea || '' }; }, { theme: '', idea: '' });
  const set = useCallback((next: PypCurrent) => write(CURRENT_KEY, next.theme || next.idea ? next : null), []);
  return { current, set };
}
