'use server';

import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { requireTutor } from '@/lib/session';
import type { Activity } from '@/lib/department-timeline';

const item = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(200),
});

export async function listActivities(): Promise<{ activities: Activity[]; today: string }> {
  const tutor = await requireTutor();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tutor.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const rows = await sqlClient()`SELECT id, to_char(activity_date, 'YYYY-MM-DD') AS activity_date, title, source FROM department_activities WHERE tutor_id = ${tutor.id} ORDER BY department_activities.activity_date, created_at LIMIT 1000`;
  return { activities: rows as Activity[], today };
}

export async function addActivities(items: Array<z.input<typeof item>>, source: 'typed' | 'photo'): Promise<Activity[]> {
  const tutor = await requireTutor();
  const list = z.array(item).min(1).max(200).parse(items);
  const sql = sqlClient();
  const rows = await sql.transaction(list.map((a) => sql`INSERT INTO department_activities (tutor_id, activity_date, title, source) VALUES (${tutor.id}, ${a.date}, ${a.title}, ${source}) RETURNING id, to_char(activity_date, 'YYYY-MM-DD') AS activity_date, title, source`));
  return rows.flat() as Activity[];
}

export async function deleteActivity(id: string): Promise<void> {
  const tutor = await requireTutor();
  await sqlClient()`DELETE FROM department_activities WHERE id = ${z.string().uuid().parse(id)} AND tutor_id = ${tutor.id}`;
}

export async function updateActivity(id: string, input: z.input<typeof item>): Promise<Activity> {
  const tutor = await requireTutor();
  const a = item.parse(input);
  const rows = await sqlClient()`UPDATE department_activities SET activity_date = ${a.date}, title = ${a.title}
    WHERE id = ${z.string().uuid().parse(id)} AND tutor_id = ${tutor.id}
    RETURNING id, to_char(activity_date, 'YYYY-MM-DD') AS activity_date, title, source`;
  if (!rows.length) throw new Error('Activity not found');
  return rows[0] as Activity;
}
