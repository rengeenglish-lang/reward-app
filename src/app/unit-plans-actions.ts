'use server';

import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { requireTutor } from '@/lib/session';
import { type UnitPlan } from '@/lib/teacher-issues';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const planInput = z.object({
  title: z.string().trim().min(1).max(160),
  grade: z.number().int().min(1).max(4).nullable(),
  theme: z.string().trim().min(1).max(60).nullable(),
  startDate: date,
  endDate: date,
  body: z.string().trim().min(1).max(60000),
  source: z.enum(['typed', 'photo']),
}).refine((p) => !p.startDate || !p.endDate || p.startDate <= p.endDate, { message: 'The end date is before the start date' });


export async function listUnitPlans(): Promise<{ plans: UnitPlan[]; today: string }> {
  const tutor = await requireTutor();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tutor.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const rows = await sqlClient()`SELECT id, title, grade, theme, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, body, source FROM unit_plans WHERE tutor_id = ${tutor.id} ORDER BY unit_plans.start_date DESC NULLS LAST, created_at DESC LIMIT 300`;
  return { plans: rows as UnitPlan[], today };
}

export async function addUnitPlan(input: z.input<typeof planInput>): Promise<UnitPlan> {
  const tutor = await requireTutor();
  const p = planInput.parse(input);
  const rows = await sqlClient()`INSERT INTO unit_plans (tutor_id, title, grade, theme, start_date, end_date, body, source)
    VALUES (${tutor.id}, ${p.title}, ${p.grade}, ${p.theme}, ${p.startDate}, ${p.endDate}, ${p.body}, ${p.source})
    RETURNING id, title, grade, theme, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, body, source`;
  return rows[0] as UnitPlan;
}

export async function deleteUnitPlan(id: string): Promise<void> {
  const tutor = await requireTutor();
  await sqlClient()`DELETE FROM unit_plans WHERE id = ${z.string().uuid().parse(id)} AND tutor_id = ${tutor.id}`;
}
