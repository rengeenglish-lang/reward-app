'use server';

import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { requireTutor } from '@/lib/session';
import { AREAS, DURATIONS, FORMATS, type Flag, type Session } from '@/lib/one-on-one';

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable();
const area = z.enum(AREAS.map((a) => a.id) as [string, ...string[]]);
const format = z.enum(FORMATS.map((f) => f.id) as [string, ...string[]]);

const sessionInput = z.object({
  topic: z.string().trim().min(1).max(200),
  details: z.string().trim().max(4000).default(''),
  area, format,
  plannedDate: date, plannedTime: time,
  duration: z.number().int().refine((n) => (DURATIONS as readonly number[]).includes(n) || (n >= 5 && n <= 120)),
  goal: z.string().trim().max(500).default(''),
});


/** Who is ticked as needing a one-on-one, and every session planned or done. */
export async function getOneOnOne(): Promise<{ flags: Flag[]; sessions: Session[]; today: string }> {
  const tutor = await requireTutor();
  const sql = sqlClient();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tutor.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [flags, sessions] = await Promise.all([
    sql`SELECT f.student_id, f.priority::int AS priority FROM one_on_one_flags f JOIN students s ON s.id = f.student_id WHERE s.archived_at IS NULL`,
    sql`SELECT id, student_id, topic, details, area, format, to_char(planned_date, 'YYYY-MM-DD') AS planned_date, planned_time, duration_min::int AS duration_min, goal, completed, completed_at, outcome, follow_up, to_char(follow_up_date, 'YYYY-MM-DD') AS follow_up_date, parent_informed FROM one_on_one_sessions WHERE tutor_id = ${tutor.id} ORDER BY completed, planned_date NULLS LAST, created_at`,
  ]);
  return { flags: flags as Flag[], sessions: sessions as Session[], today };
}

/** The checklist: tick a student as needing a one-on-one (weak), untick to remove, or mark as high priority. */
export async function setOneOnOneFlag(studentId: string, weak: boolean, priority = 1): Promise<void> {
  await requireTutor();
  const s = uuid.parse(studentId), p = z.number().int().min(1).max(2).parse(priority);
  const sql = sqlClient();
  if (weak) await sql`INSERT INTO one_on_one_flags (student_id, priority) VALUES (${s}, ${p}) ON CONFLICT (student_id) DO UPDATE SET priority = ${p}`;
  else await sql`DELETE FROM one_on_one_flags WHERE student_id = ${s}`;
}

/** Ticks or unticks many students at once (for example a whole class). */
export async function setOneOnOneFlagMany(studentIds: string[], weak: boolean): Promise<void> {
  await requireTutor();
  const ids = z.array(uuid).min(1).max(300).parse(studentIds), csv = ids.join(','), sql = sqlClient();
  if (weak) await sql`INSERT INTO one_on_one_flags (student_id) SELECT x FROM unnest(string_to_array(${csv}, ',')::uuid[]) AS x ON CONFLICT (student_id) DO NOTHING`;
  else await sql`DELETE FROM one_on_one_flags WHERE student_id = ANY(string_to_array(${csv}, ',')::uuid[])`;
}


export async function addOneOnOneSession(studentId: string, input: z.input<typeof sessionInput>): Promise<Session> {
  const tutor = await requireTutor();
  const s = uuid.parse(studentId), p = sessionInput.parse(input);
  const rows = await sqlClient()`INSERT INTO one_on_one_sessions (tutor_id, student_id, topic, details, area, format, planned_date, planned_time, duration_min, goal)
    VALUES (${tutor.id}, ${s}, ${p.topic}, ${p.details}, ${p.area}, ${p.format}, ${p.plannedDate}, ${p.plannedTime}, ${p.duration}, ${p.goal})
    RETURNING id, student_id, topic, details, area, format, to_char(planned_date, 'YYYY-MM-DD') AS planned_date, planned_time, duration_min::int AS duration_min, goal, completed, completed_at, outcome, follow_up, to_char(follow_up_date, 'YYYY-MM-DD') AS follow_up_date, parent_informed`;
  return rows[0] as Session;
}

export async function updateOneOnOneSession(id: string, input: z.input<typeof sessionInput>): Promise<Session> {
  const tutor = await requireTutor();
  const p = sessionInput.parse(input);
  const rows = await sqlClient()`UPDATE one_on_one_sessions SET topic = ${p.topic}, details = ${p.details}, area = ${p.area}, format = ${p.format}, planned_date = ${p.plannedDate}, planned_time = ${p.plannedTime}, duration_min = ${p.duration}, goal = ${p.goal}
    WHERE id = ${uuid.parse(id)} AND tutor_id = ${tutor.id}
    RETURNING id, student_id, topic, details, area, format, to_char(planned_date, 'YYYY-MM-DD') AS planned_date, planned_time, duration_min::int AS duration_min, goal, completed, completed_at, outcome, follow_up, to_char(follow_up_date, 'YYYY-MM-DD') AS follow_up_date, parent_informed`;
  if (!rows.length) throw new Error('Session not found');
  return rows[0] as Session;
}

const wrapUp = z.object({
  completed: z.boolean(),
  outcome: z.string().trim().max(4000).default(''),
  followUp: z.boolean().default(false),
  followUpDate: date.default(null),
  parentInformed: z.boolean().default(false),
});

/** Marks a one-on-one as completed (or not completed again), with what came of it. */
export async function setOneOnOneCompleted(id: string, input: z.input<typeof wrapUp>): Promise<Session> {
  const tutor = await requireTutor();
  const w = wrapUp.parse(input);
  const rows = await sqlClient()`UPDATE one_on_one_sessions SET completed = ${w.completed}, completed_at = CASE WHEN ${w.completed}::boolean THEN COALESCE(completed_at, now()) ELSE NULL END,
      outcome = ${w.outcome}, follow_up = ${w.followUp}, follow_up_date = ${w.followUpDate}, parent_informed = ${w.parentInformed}
    WHERE id = ${uuid.parse(id)} AND tutor_id = ${tutor.id}
    RETURNING id, student_id, topic, details, area, format, to_char(planned_date, 'YYYY-MM-DD') AS planned_date, planned_time, duration_min::int AS duration_min, goal, completed, completed_at, outcome, follow_up, to_char(follow_up_date, 'YYYY-MM-DD') AS follow_up_date, parent_informed`;
  if (!rows.length) throw new Error('Session not found');
  return rows[0] as Session;
}

export async function deleteOneOnOneSession(id: string): Promise<void> {
  const tutor = await requireTutor();
  await sqlClient()`DELETE FROM one_on_one_sessions WHERE id = ${uuid.parse(id)} AND tutor_id = ${tutor.id}`;
}
