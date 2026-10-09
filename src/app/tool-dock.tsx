'use client';

import { useEffect } from 'react';

export type DockId = 'rollcall' | 'checkin' | 'picker' | 'timer' | 'lesson' | 'draw' | 'book' | 'badges' | 'parade';

const ITEMS = [
  { id: 'rollcall', label: 'Roll call', emoji: '📋' },
  { id: 'checkin', label: 'Today’s stars', emoji: '⭐' },
  { id: 'picker', label: 'Who’s next?', emoji: '🎯' },
  { id: 'timer', label: 'Timer', emoji: '⏱️' },
  { id: 'lesson', label: 'Lesson bell', emoji: '🔔' },
  { id: 'draw', label: 'Rewards', emoji: '🎁' },
  { id: 'book', label: 'Our Readers', emoji: '📚' },
  { id: 'badges', label: 'Badges', emoji: '💛' },
  { id: 'parade', label: 'Parade', emoji: '🎉' },
] as const;

/** Quick tools live in a side drawer. Open it from "Quick tools" in the sidebar; it closes after you pick one. */
export default function ToolDock({ open, onClose, active, lessonLabel, rollLabel, onPick }: { open: boolean; onClose: () => void; active: DockId | null; lessonLabel?: string; rollLabel?: string; onPick: (id: DockId) => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <button type="button" className="tool-drawer-scrim" aria-label="Close quick tools" onClick={onClose} />}
      <aside className={`tool-drawer${open ? ' open' : ''}`} aria-label="Quick tools" aria-hidden={!open}>
        <div className="tool-drawer-head"><strong>🧰 Quick tools</strong><button type="button" className="tool-drawer-close" aria-label="Close quick tools" tabIndex={open ? 0 : -1} onClick={onClose}>✕</button></div>
        <nav className="tool-drawer-list">
          {ITEMS.map((item) => {
            const live = item.id === 'lesson' && Boolean(lessonLabel);
            return (
              <button
                key={item.id}
                type="button"
                tabIndex={open ? 0 : -1}
                className={`tool-drawer-btn tone-${item.id}${active === item.id ? ' is-active' : ''}${live ? ' is-live' : ''}`}
                aria-current={active === item.id ? 'page' : undefined}
                onClick={() => onPick(item.id)}
              >
                <span className="tool-dock-icon" aria-hidden="true">{item.emoji}</span>
                <span className="tool-drawer-label">{live ? lessonLabel : item.id === 'rollcall' && rollLabel ? rollLabel : item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
