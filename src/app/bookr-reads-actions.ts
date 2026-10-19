'use server';

import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { requireTutor } from '@/lib/session';

const uuid = z.string().uuid();
const week = z.number().int().min(1).max(40);
const book = z.number().int().min(0).max(2);

export type BookrRead = { student_id: string; week: number; book: number };

/** Every book the students of one classroom have read. */
export async function getBookrReads(classroomId: string): Promise<BookrRead[]> {
  await requireTutor();
  const id = uuid.parse(classroomId);
  const rows = await sqlClient()`SELECT r.student_id, r.week::int AS week, r.book::int AS book FROM bookr_reads r JOIN students s ON s.id = r.student_id JOIN groups g ON g.id = s.group_id WHERE g.classroom_id = ${id}`;
  return rows as BookrRead[];
}

/** Ticks (read) or unticks (not read) one book for one student. */
export async function setBookrRead(studentId: string, weekNo: number, bookNo: number, read: boolean): Promise<void> {
  await requireTutor();
  const s = uuid.parse(studentId), w = week.parse(weekNo), b = book.parse(bookNo);
  const sql = sqlClient();
  if (read) await sql`INSERT INTO bookr_reads (student_id, week, book) VALUES (${s}, ${w}, ${b}) ON CONFLICT DO NOTHING`;
  else await sql`DELETE FROM bookr_reads WHERE student_id = ${s} AND week = ${w} AND book = ${b}`;
}

/** Ticks or unticks one book for a whole list of students at once. */
export async function setBookrReadMany(studentIds: string[], weekNo: number, bookNo: number, read: boolean): Promise<void> {
  await requireTutor();
  const ids = z.array(uuid).min(1).max(200).parse(studentIds), w = week.parse(weekNo), b = book.parse(bookNo);
  const csv = ids.join(',');
  const sql = sqlClient();
  if (read) await sql`INSERT INTO bookr_reads (student_id, week, book) SELECT x, ${w}, ${b} FROM unnest(string_to_array(${csv}, ',')::uuid[]) AS x ON CONFLICT DO NOTHING`;
  else await sql`DELETE FROM bookr_reads WHERE week = ${w} AND book = ${b} AND student_id = ANY(string_to_array(${csv}, ',')::uuid[])`;
}
