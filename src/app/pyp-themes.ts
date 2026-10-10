'use client';

import { useCallback, useEffect, useState } from 'react';
import { renameTheme } from './teacher-notes-actions';

/** The six IB PYP transdisciplinary themes. They start in your list, and you can rename, remove or add to it. */
export const PYP_SIX = [
  { name: 'Who we are', emoji: '🧑‍🤝‍🧑' },
  { name: 'Where we are in place and time', emoji: '🗺️' },
  { name: 'How we express ourselves', emoji: '🎭' },
  { name: 'How the world works', emoji: '🔬' },
  { name: 'How we organize ourselves', emoji: '🏗️' },
  { name: 'Sharing the planet', emoji: '🌍' },
] as const;

/** One theme in your list. `base` is the IB theme it started as (kept after a rename), or null for a theme you added. */
export type PypThemeItem = { id: string; name: string; base: string | null };

const LIST_KEY = 'ezgili-pyp-themes-v2';
const DESC_KEY = 'ezgili-pyp-theme-descriptions-v2';
const OLD_CUSTOM_KEY = 'ezgili-pyp-custom-themes';
const OLD_DESC_KEY = 'ezgili-pyp-theme-descriptions';
const CURRENT_KEY = 'ezgili-pyp-theme-grade4';
const EVENT = 'ezgili-pyp-updated';

export type PypCurrent = { theme: string; idea: string };

function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage can be blocked */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
}

const ibItems = (): PypThemeItem[] => PYP_SIX.map((t) => ({ id: t.name, name: t.name, base: t.name }));
const clean = (raw: string) => raw.trim().replace(/\s+/g, ' ').slice(0, 60);
const newId = () => `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Loads the list. The first time, it is built from the six IB themes plus any names added before this version. */
function loadThemes(): PypThemeItem[] {
  const saved = read<PypThemeItem[] | null>(LIST_KEY, null);
  if (Array.isArray(saved)) return saved.filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string');
  const old = read<string[]>(OLD_CUSTOM_KEY, []);
  return [...ibItems(), ...(Array.isArray(old) ? old.filter((n) => typeof n === 'string').map((name) => ({ id: newId(), name, base: null })) : [])];
}
function loadDescriptions(themes: PypThemeItem[]): Record<string, string> {
  const saved = read<Record<string, string> | null>(DESC_KEY, null);
  if (saved) return saved;
  const old = read<Record<string, string>>(OLD_DESC_KEY, {}); // keyed by theme name
  const out: Record<string, string> = {};
  for (const t of themes) if (old[t.name]) out[t.id] = old[t.name];
  return out;
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

export const themeEmoji = (t: PypThemeItem) => PYP_SIX.find((s) => s.name === t.base)?.emoji ?? '✨';

/** Your list of PYP themes: add, remove, rename. Removing an IB theme only hides it; "Restore" brings the missing ones back. */
export function useThemes() {
  const themes = useSynced<PypThemeItem[]>(loadThemes, ibItems());
  const store = (next: PypThemeItem[]) => write(LIST_KEY, next);

  const add = useCallback((raw: string): PypThemeItem | null => {
    const name = clean(raw);
    if (!name) return null;
    const list = loadThemes();
    const existing = list.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const item = { id: newId(), name, base: null };
    store([...list, item]);
    return item;
  }, []);

  const remove = useCallback((id: string) => {
    const list = loadThemes();
    const gone = list.find((t) => t.id === id);
    store(list.filter((t) => t.id !== id));
    const descriptions = loadDescriptions(list);
    if (descriptions[id] !== undefined) { const { [id]: _drop, ...rest } = descriptions; void _drop; write(DESC_KEY, rest); }
    const current = read<PypCurrent>(CURRENT_KEY, { theme: '', idea: '' });
    if (gone && current.theme === gone.name) write(CURRENT_KEY, current.idea ? { theme: '', idea: current.idea } : null);
  }, []);

  /** Renames a theme everywhere: the list, the Grade 4 theme, and your saved plans and notes. Returns false if the name is empty or taken. */
  const rename = useCallback((id: string, raw: string): boolean => {
    const name = clean(raw);
    if (!name) return false;
    const list = loadThemes();
    const target = list.find((t) => t.id === id);
    if (!target) return false;
    if (target.name === name) return true;
    if (list.some((t) => t.id !== id && t.name.toLowerCase() === name.toLowerCase())) return false;
    store(list.map((t) => (t.id === id ? { ...t, name } : t)));
    const current = read<PypCurrent>(CURRENT_KEY, { theme: '', idea: '' });
    if (current.theme === target.name) write(CURRENT_KEY, { theme: name, idea: current.idea });
    void renameTheme(target.name, name).catch(() => { /* the list is renamed; saved items keep the old name if this fails */ });
    return true;
  }, []);

  const restoreIb = useCallback(() => {
    const list = loadThemes();
    const have = new Set(list.map((t) => t.base).filter(Boolean));
    const taken = new Set(list.map((t) => t.name.toLowerCase()));
    const back = ibItems().filter((t) => !have.has(t.base) && !taken.has(t.name.toLowerCase()));
    if (back.length) store([...back, ...list]);
  }, []);

  const missingIb = PYP_SIX.some((s) => !themes.some((t) => t.base === s.name));
  return { themes, add, remove, rename, restoreIb, missingIb };
}

/** Every theme name to choose from, in your order. Used by the Today chip, Unit plans and notes. */
export function useThemeNames(): string[] {
  return useThemes().themes.map((t) => t.name);
}

/** Descriptions you wrote, by theme id. A theme without one shows the IB text (or nothing for a theme you added). */
export function useThemeDescriptions() {
  const map = useSynced<Record<string, string>>(() => loadDescriptions(loadThemes()), {});
  const set = useCallback((id: string, description: string) => {
    const next = { ...loadDescriptions(loadThemes()) };
    const text = description.trim().slice(0, 600);
    if (text) next[id] = text; else delete next[id];
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
