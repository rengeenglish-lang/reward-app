'use client';

import { BookOpen, Bell, ClipboardCheck, Gift, Heart, Sparkles, Timer, Users } from 'lucide-react';

export type DockId = 'checkin' | 'picker' | 'timer' | 'lesson' | 'draw' | 'book' | 'badges' | 'parade';

const ITEMS = [
  { id: 'checkin', label: 'Check-in', icon: ClipboardCheck },
  { id: 'picker', label: 'Pick a student', icon: Users },
  { id: 'timer', label: 'Timer', icon: Timer },
  { id: 'lesson', label: 'Lesson bell', icon: Bell },
  { id: 'draw', label: 'Reward draw', icon: Gift },
  { id: 'book', label: 'Book picker', icon: BookOpen },
  { id: 'badges', label: 'Badges', icon: Heart },
  { id: 'parade', label: 'Mascot parade', icon: Sparkles },
] as const;

/** Quick tools: one tap from any page. Stays on screen while you scroll, and sits at the bottom on phones. */
export default function ToolDock({ active, lessonLabel, onPick }: { active: DockId | null; lessonLabel?: string; onPick: (id: DockId) => void }) {
  return (
    <nav className="tool-dock" aria-label="Quick tools">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const live = item.id === 'lesson' && Boolean(lessonLabel);
        return (
          <button
            key={item.id}
            type="button"
            className={`tool-dock-btn tone-${item.id}${active === item.id ? ' is-active' : ''}${live ? ' is-live' : ''}`}
            aria-current={active === item.id ? 'page' : undefined}
            onClick={() => onPick(item.id)}
          >
            <span className="tool-dock-icon"><Icon size={19} /></span>
            <span className="tool-dock-label">{live ? lessonLabel : item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
