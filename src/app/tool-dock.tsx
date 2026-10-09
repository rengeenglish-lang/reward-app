'use client';

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

/** Quick tools: one tap from any page. Stays on screen while you scroll, and sits at the bottom on phones. */
export default function ToolDock({ active, lessonLabel, rollLabel, onPick }: { active: DockId | null; lessonLabel?: string; rollLabel?: string; onPick: (id: DockId) => void }) {
  return (
    <nav className="tool-dock" aria-label="Quick tools">
      {ITEMS.map((item) => {
        const live = item.id === 'lesson' && Boolean(lessonLabel);
        return (
          <button
            key={item.id}
            type="button"
            className={`tool-dock-btn tone-${item.id}${active === item.id ? ' is-active' : ''}${live ? ' is-live' : ''}`}
            aria-current={active === item.id ? 'page' : undefined}
            onClick={() => onPick(item.id)}
          >
            <span className="tool-dock-icon" aria-hidden="true">{item.emoji}</span>
            <span className="tool-dock-label">{live ? lessonLabel : item.id === 'rollcall' && rollLabel ? rollLabel : item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
