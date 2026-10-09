// The weekly lesson timetable (Monday to Friday). Lessons repeat every week.
// Times are school clock times, read from the computer's own clock.
export type Slot = { period: number; start: string; end: string; cls: string };

export const LESSONS: Record<number, Slot[]> = {
  1: [ // Monday
    { period: 3, start: '10:30', end: '11:10', cls: '4/B' },
    { period: 5, start: '12:50', end: '13:30', cls: '4/C' },
    { period: 6, start: '13:40', end: '14:20', cls: '4/A' },
  ],
  2: [ // Tuesday
    { period: 3, start: '10:30', end: '11:10', cls: '4/A' },
    { period: 4, start: '11:20', end: '12:00', cls: '4/A' },
    { period: 5, start: '12:50', end: '13:30', cls: '4/C' },
    { period: 6, start: '13:40', end: '14:20', cls: '4/C' },
    { period: 8, start: '15:20', end: '15:55', cls: '4/A' },
    { period: 9, start: '16:05', end: '16:40', cls: '4/B' },
  ],
  3: [ // Wednesday
    { period: 1, start: '09:00', end: '09:35', cls: '4/A' },
    { period: 2, start: '09:45', end: '10:20', cls: '4/A' },
    { period: 3, start: '10:30', end: '11:10', cls: '4/C' },
    { period: 4, start: '11:20', end: '12:00', cls: '4/C' },
  ],
  4: [ // Thursday
    { period: 3, start: '10:30', end: '11:10', cls: '4/B' },
    { period: 4, start: '11:20', end: '12:00', cls: '4/B' },
    { period: 5, start: '12:50', end: '13:30', cls: '4/C' },
    { period: 6, start: '13:40', end: '14:20', cls: '4/C' },
    { period: 7, start: '14:30', end: '15:10', cls: '4/A' },
  ],
  5: [ // Friday
    { period: 6, start: '13:40', end: '14:20', cls: '4/B' },
    { period: 7, start: '14:30', end: '15:10', cls: '4/B' },
    { period: 9, start: '16:05', end: '16:40', cls: '4/B' },
  ],
};

/** "4/A" in the timetable is the classroom called "4A". */
export const className = (cls: string) => cls.replace('/', '');

/** The clock the scheduler reads. Tests can replace `now`. */
export const scheduleClock = { now: (): Date => new Date() };

const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Local date and time of day at the given moment, plus helpers to turn "HH:MM" into a timestamp today. */
function dayParts(at: Date) {
  const dayKey = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  const minutes = at.getHours() * 60 + at.getMinutes();
  const stamp = (hhmm: string) => { const d = new Date(at); d.setHours(0, 0, 0, 0); return d.getTime() + toMinutes(hhmm) * 60000; };
  return { dayKey, minutes, stamp, weekday: at.getDay() };
}

export type ActiveLesson = Slot & { key: string; startsAt: number; endsAt: number; label: string };

/** The lesson that should be running right now, if any. */
export function currentLesson(at: Date = scheduleClock.now()): ActiveLesson | null {
  const { dayKey, minutes, stamp, weekday } = dayParts(at);
  const slot = (LESSONS[weekday] ?? []).find((s) => minutes >= toMinutes(s.start) && minutes < toMinutes(s.end));
  if (!slot) return null;
  return { ...slot, key: `${dayKey}-${slot.period}-${slot.cls}`, startsAt: stamp(slot.start), endsAt: stamp(slot.end), label: `${className(slot.cls)} · Period ${slot.period}` };
}

/** The next lesson today, for the "up next" note. */
export function nextLesson(at: Date = scheduleClock.now()): Slot | null {
  const { minutes, weekday } = dayParts(at);
  return (LESSONS[weekday] ?? []).find((s) => toMinutes(s.start) > minutes) ?? null;
}
