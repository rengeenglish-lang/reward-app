'use server';

import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { requireTutor } from '@/lib/session';
import { summariseBehaviour, type BehaviourSummary, type DayRecord, type StudentEntry } from '@/lib/student-analysis';

const uuid = z.string().uuid();

export type AnalysisStudent = { id: string; name: string; classroom: string };

export async function listAnalysisStudents(): Promise<AnalysisStudent[]> {
  await requireTutor();
  const rows = await sqlClient()`SELECT s.id, s.display_name AS name, c.name AS classroom FROM students s JOIN groups g ON g.id = s.group_id JOIN classrooms c ON c.id = g.classroom_id WHERE s.archived_at IS NULL AND g.archived_at IS NULL AND c.archived_at IS NULL ORDER BY c.name, s.display_name`;
  return rows as AnalysisStudent[];
}

export async function getStudentAnalysis(studentId: string): Promise<{ summary: BehaviourSummary; entries: StudentEntry[] }> {
  const tutor = await requireTutor();
  const id = uuid.parse(studentId);
  const sql = sqlClient();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tutor.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [records, entries] = await Promise.all([
    sql`SELECT to_char(record_date, 'YYYY-MM-DD') AS date, criteria FROM behavior_records WHERE student_id = ${id} AND record_date >= current_date - 90 ORDER BY record_date`,
    sql`SELECT id, area, body, to_char(entry_date, 'YYYY-MM-DD') AS entry_date, source FROM student_analysis_entries WHERE student_id = ${id} AND tutor_id = ${tutor.id} ORDER BY student_analysis_entries.entry_date DESC, created_at DESC LIMIT 200`,
  ]);
  return { summary: summariseBehaviour(records as DayRecord[], today), entries: entries as StudentEntry[] };
}

const entryInput = z.object({
  studentId: uuid,
  area: z.enum(['academic', 'behaviour']),
  body: z.string().trim().min(1).max(20000),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['typed', 'photo']),
});

export async function addStudentEntry(input: z.input<typeof entryInput>): Promise<StudentEntry> {
  const tutor = await requireTutor();
  const e = entryInput.parse(input);
  const rows = await sqlClient()`INSERT INTO student_analysis_entries (tutor_id, student_id, area, body, entry_date, source)
    VALUES (${tutor.id}, ${e.studentId}, ${e.area}, ${e.body}, ${e.entryDate}, ${e.source})
    RETURNING id, area, body, to_char(entry_date, 'YYYY-MM-DD') AS entry_date, source`;
  return rows[0] as StudentEntry;
}

export async function deleteStudentEntry(id: string): Promise<void> {
  const tutor = await requireTutor();
  await sqlClient()`DELETE FROM student_analysis_entries WHERE id = ${uuid.parse(id)} AND tutor_id = ${tutor.id}`;
}

export async function updateStudentEntry(id: string, input: { body: string; entryDate: string }): Promise<StudentEntry> {
  const tutor = await requireTutor();
  const e = z.object({ body: z.string().trim().min(1).max(20000), entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input);
  const rows = await sqlClient()`UPDATE student_analysis_entries SET body = ${e.body}, entry_date = ${e.entryDate}
    WHERE id = ${uuid.parse(id)} AND tutor_id = ${tutor.id}
    RETURNING id, area, body, to_char(entry_date, 'YYYY-MM-DD') AS entry_date, source`;
  if (!rows.length) throw new Error('Entry not found');
  return rows[0] as StudentEntry;
}
