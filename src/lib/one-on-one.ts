// One-on-one roster: which students need a one-to-one with the teacher, and the sessions planned or done.

export const AREAS = [
  { id: 'reading', label: 'Reading' },
  { id: 'writing', label: 'Writing' },
  { id: 'speaking', label: 'Speaking' },
  { id: 'listening', label: 'Listening' },
  { id: 'vocabulary', label: 'Vocabulary & grammar' },
  { id: 'homework', label: 'Homework & organisation' },
  { id: 'behaviour', label: 'Behaviour' },
  { id: 'wellbeing', label: 'Confidence & wellbeing' },
  { id: 'other', label: 'Something else' },
] as const;

export const FORMATS = [
  { id: 'face_to_face', label: 'Face to face, at my desk' },
  { id: 'break', label: 'During break' },
  { id: 'after_school', label: 'After school' },
  { id: 'online', label: 'Phone or online call' },
  { id: 'with_parent', label: 'With a parent present' },
] as const;

export const DURATIONS = [10, 15, 20, 30, 45] as const;

export type AreaId = (typeof AREAS)[number]['id'];
export type FormatId = (typeof FORMATS)[number]['id'];

export type Flag = { student_id: string; priority: number }; // priority 2 = high
export type Session = {
  id: string; student_id: string; topic: string; details: string; area: AreaId; format: FormatId;
  planned_date: string | null; planned_time: string | null; duration_min: number; goal: string;
  completed: boolean; completed_at: string | null; outcome: string; follow_up: boolean; follow_up_date: string | null; parent_informed: boolean;
};

export const areaLabel = (id: string) => AREAS.find((a) => a.id === id)?.label ?? id;
export const formatLabel = (id: string) => FORMATS.find((f) => f.id === id)?.label ?? id;

export type Status = 'waiting' | 'planned' | 'done';
/** waiting: no one-on-one planned yet; planned: one is planned but not done; done: every planned one is completed. */
export function statusOf(sessions: Session[]): Status {
  if (!sessions.length) return 'waiting';
  return sessions.some((s) => !s.completed) ? 'planned' : 'done';
}
export const STATUS_RANK: Record<Status, number> = { waiting: 0, planned: 1, done: 2 };
