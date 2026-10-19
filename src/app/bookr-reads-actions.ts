'use server';

import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { requireTutor } from '@/lib/session';

const uuid = z.string().uuid();
const week = z.number().int().min(1).max(40);
const book = z.number().int().min(0).max(2);

/** Every book read earns double points: 2 instead of the usual 1. */
const POINTS_PER_BOOK = 2;
const todayFor = (timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export type BookrRead = { student_id: string; week: number; book: number };

/** Every book the students of one classroom have read. */
export async function getBookrReads(classroomId: string): Promise<BookrRead[]> {
  await requireTutor();
  const id = uuid.parse(classroomId);
  const rows = await sqlClient()`SELECT r.student_id, r.week::int AS week, r.book::int AS book FROM bookr_reads r JOIN students s ON s.id = r.student_id JOIN groups g ON g.id = s.group_id WHERE g.classroom_id = ${id}`;
  return rows as BookrRead[];
}

/**
 * Ticks (read) or unticks (not read) one book for one student.
 * Ticking also awards double points, linked to this book, so unticking takes the points back.
 */
export async function setBookrRead(studentId: string, weekNo: number, bookNo: number, read: boolean): Promise<void> {
  const tutor = await requireTutor();
  const s = uuid.parse(studentId), w = week.parse(weekNo), b = book.parse(bookNo);
  const sql = sqlClient(), key = `bookr:${w}:${b}`, day = todayFor(tutor.timezone);
  if (read) {
    await sql.transaction([
      sql`INSERT INTO bookr_reads (student_id, week, book) VALUES (${s}, ${w}, ${b}) ON CONFLICT DO NOTHING`,
      sql`INSERT INTO student_point_awards (student_id, group_id, criterion, points, awarded_on, source_key) SELECT st.id, st.group_id, 'book_read', ${POINTS_PER_BOOK}, ${day}::date, ${key} FROM students st WHERE st.id = ${s} ON CONFLICT (student_id, source_key) WHERE source_key IS NOT NULL DO NOTHING`,
    ]);
  } else {
    await sql.transaction([
      sql`DELETE FROM bookr_reads WHERE student_id = ${s} AND week = ${w} AND book = ${b}`,
      sql`DELETE FROM student_point_awards WHERE student_id = ${s} AND source_key = ${key}`,
    ]);
  }
}

/** Ticks or unticks one book for a whole list of students at once, with the same double points. */
export async function setBookrReadMany(studentIds: string[], weekNo: number, bookNo: number, read: boolean): Promise<void> {
  const tutor = await requireTutor();
  const ids = z.array(uuid).min(1).max(200).parse(studentIds), w = week.parse(weekNo), b = book.parse(bookNo);
  const csv = ids.join(','), sql = sqlClient(), key = `bookr:${w}:${b}`, day = todayFor(tutor.timezone);
  if (read) {
    await sql.transaction([
      sql`INSERT INTO bookr_reads (student_id, week, book) SELECT x, ${w}, ${b} FROM unnest(string_to_array(${csv}, ',')::uuid[]) AS x ON CONFLICT DO NOTHING`,
      sql`INSERT INTO student_point_awards (student_id, group_id, criterion, points, awarded_on, source_key) SELECT st.id, st.group_id, 'book_read', ${POINTS_PER_BOOK}, ${day}::date, ${key} FROM students st WHERE st.id = ANY(string_to_array(${csv}, ',')::uuid[]) ON CONFLICT (student_id, source_key) WHERE source_key IS NOT NULL DO NOTHING`,
    ]);
  } else {
    await sql.transaction([
      sql`DELETE FROM bookr_reads WHERE week = ${w} AND book = ${b} AND student_id = ANY(string_to_array(${csv}, ',')::uuid[])`,
      sql`DELETE FROM student_point_awards WHERE source_key = ${key} AND student_id = ANY(string_to_array(${csv}, ',')::uuid[])`,
    ]);
  }
}

export type BookrExtra = { student_id: string; extra: number };

/** The extra books the teacher added for each student of a classroom. */
export async function getBookrExtras(classroomId: string): Promise<BookrExtra[]> {
  await requireTutor();
  const id = uuid.parse(classroomId);
  const rows = await sqlClient()`SELECT e.student_id, e.extra::int AS extra FROM bookr_extra e JOIN students s ON s.id = e.student_id JOIN groups g ON g.id = s.group_id WHERE g.classroom_id = ${id}`;
  return rows as BookrExtra[];
}

/** Sets the number of extra books for a student. Each extra book also earns double points. Zero removes both. */
export async function setBookrExtra(studentId: string, extra: number): Promise<void> {
  const tutor = await requireTutor();
  const s = uuid.parse(studentId), n = z.number().int().min(0).max(500).parse(extra);
  const sql = sqlClient(), day = todayFor(tutor.timezone);
  if (n === 0) {
    await sql.transaction([
      sql`DELETE FROM bookr_extra WHERE student_id = ${s}`,
      sql`DELETE FROM student_point_awards WHERE student_id = ${s} AND source_key = 'bookr-extra'`,
    ]);
  } else {
    await sql.transaction([
      sql`INSERT INTO bookr_extra (student_id, extra) VALUES (${s}, ${n}) ON CONFLICT (student_id) DO UPDATE SET extra = ${n}, updated_at = now()`,
      sql`INSERT INTO student_point_awards (student_id, group_id, criterion, points, awarded_on, source_key) SELECT st.id, st.group_id, 'book_read', ${n * POINTS_PER_BOOK}, ${day}::date, 'bookr-extra' FROM students st WHERE st.id = ${s} ON CONFLICT (student_id, source_key) WHERE source_key IS NOT NULL DO UPDATE SET points = ${n * POINTS_PER_BOOK}`,
    ]);
  }
}

/** Ticks (or unticks) all three books of a week for one student with a single click, with double points for each. */
export async function setBookrWeekForStudent(studentId: string, weekNo: number, read: boolean): Promise<void> {
  const tutor = await requireTutor();
  const s = uuid.parse(studentId), w = week.parse(weekNo);
  const sql = sqlClient(), day = todayFor(tutor.timezone);
  if (read) {
    await sql.transaction([
      sql`INSERT INTO bookr_reads (student_id, week, book) SELECT ${s}, ${w}, b FROM generate_series(0, 2) AS b ON CONFLICT DO NOTHING`,
      sql`INSERT INTO student_point_awards (student_id, group_id, criterion, points, awarded_on, source_key) SELECT st.id, st.group_id, 'book_read', ${POINTS_PER_BOOK}, ${day}::date, 'bookr:' || ${w}::text || ':' || b::text FROM students st CROSS JOIN generate_series(0, 2) AS b WHERE st.id = ${s} ON CONFLICT (student_id, source_key) WHERE source_key IS NOT NULL DO NOTHING`,
    ]);
  } else {
    await sql.transaction([
      sql`DELETE FROM bookr_reads WHERE student_id = ${s} AND week = ${w}`,
      sql`DELETE FROM student_point_awards WHERE student_id = ${s} AND source_key LIKE ${`bookr:${w}:%`}`,
    ]);
  }
}
