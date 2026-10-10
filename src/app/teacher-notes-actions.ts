'use server';

import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { requireTutor } from '@/lib/session';
import { type TeacherNote } from '@/lib/teacher-issues';

const noteInput = z.object({
  kind: z.enum(['department', 'class', 'pyp', 'project']),
  grade: z.number().int().min(1).max(4).nullable(),
  theme: z.string().trim().min(1).max(60).nullable(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(20000),
  noteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['typed', 'photo']),
});

export async function listTeacherNotes(): Promise<TeacherNote[]> {
  const tutor = await requireTutor();
  const rows = await sqlClient()`SELECT id, kind, grade, theme, title, body, to_char(note_date, 'YYYY-MM-DD') AS note_date, source FROM teacher_notes WHERE tutor_id = ${tutor.id} ORDER BY teacher_notes.note_date DESC, created_at DESC LIMIT 500`;
  return rows as TeacherNote[];
}

export async function addTeacherNote(input: z.input<typeof noteInput>): Promise<TeacherNote> {
  const tutor = await requireTutor();
  const note = noteInput.parse(input);
  const needsGrade = note.kind === 'class' || note.kind === 'project';
  if (needsGrade && note.grade === null) throw new Error('Choose a grade');
  if (note.kind === 'project' && note.theme === null) throw new Error('Choose a PYP theme');
  const grade = needsGrade ? note.grade : null;
  const theme = note.kind === 'project' ? note.theme : null;
  const rows = await sqlClient()`INSERT INTO teacher_notes (tutor_id, kind, grade, theme, title, body, note_date, source)
    VALUES (${tutor.id}, ${note.kind}, ${grade}, ${theme}, ${note.title}, ${note.body}, ${note.noteDate}, ${note.source})
    RETURNING id, kind, grade, theme, title, body, to_char(note_date, 'YYYY-MM-DD') AS note_date, source`;
  return rows[0] as TeacherNote;
}

/** Renames a PYP theme on every unit plan and project note you saved with the old name. */
export async function renameTheme(oldName: string, newName: string): Promise<void> {
  const tutor = await requireTutor();
  const names = z.object({ oldName: z.string().trim().min(1).max(60), newName: z.string().trim().min(1).max(60) }).parse({ oldName, newName });
  const sql = sqlClient();
  await sql.transaction([
    sql`UPDATE unit_plans SET theme = ${names.newName} WHERE tutor_id = ${tutor.id} AND theme = ${names.oldName}`,
    sql`UPDATE teacher_notes SET theme = ${names.newName} WHERE tutor_id = ${tutor.id} AND theme = ${names.oldName}`,
  ]);
}

export async function deleteTeacherNote(id: string): Promise<void> {
  const tutor = await requireTutor();
  await sqlClient()`DELETE FROM teacher_notes WHERE id = ${z.string().uuid().parse(id)} AND tutor_id = ${tutor.id}`;
}

export async function updateTeacherNote(id: string, input: z.input<typeof noteInput>): Promise<TeacherNote> {
  const tutor = await requireTutor();
  const note = noteInput.parse(input);
  const needsGrade = note.kind === 'class' || note.kind === 'project';
  if (needsGrade && note.grade === null) throw new Error('Choose a grade');
  if (note.kind === 'project' && note.theme === null) throw new Error('Choose a PYP theme');
  const grade = needsGrade ? note.grade : null;
  const theme = note.kind === 'project' ? note.theme : null;
  const rows = await sqlClient()`UPDATE teacher_notes SET kind = ${note.kind}, grade = ${grade}, theme = ${theme}, title = ${note.title}, body = ${note.body}, note_date = ${note.noteDate}, source = ${note.source}
    WHERE id = ${z.string().uuid().parse(id)} AND tutor_id = ${tutor.id}
    RETURNING id, kind, grade, theme, title, body, to_char(note_date, 'YYYY-MM-DD') AS note_date, source`;
  if (!rows.length) throw new Error('Note not found');
  return rows[0] as TeacherNote;
}
