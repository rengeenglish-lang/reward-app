'use server';

import { del, head } from '@vercel/blob';
import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { requireTutor } from '@/lib/session';

export type AnnualProgramEvent = {
  id: string;
  position: number;
  date_label: string;
  grade_level: string;
  activity: string;
  location: string;
};

export type AnnualProgram = {
  id: string;
  academic_year: string;
  title: string;
  image_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
  events: AnnualProgramEvent[];
};

const eventSchema = z.object({
  dateLabel: z.string().trim().min(1).max(40),
  gradeLevel: z.string().trim().max(160),
  activity: z.string().trim().max(200),
  location: z.string().trim().max(240),
});
const inputSchema = z.object({
  id: z.string().uuid(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  title: z.string().trim().min(1).max(160),
  fileName: z.string().trim().min(1).max(180),
  events: z.array(eventSchema).min(1).max(200),
});

export async function getAnnualProgramUploadPath(id: string, fileName: string): Promise<string> {
  const tutor = await requireTutor();
  const uploadId = z.string().uuid().parse(id);
  const safeName = z.string().trim().min(1).max(180).parse(fileName);
  const extension = safeName.split('.').pop()?.toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension || '')) throw new Error('Choose a JPEG, PNG or WebP image.');
  return `english-department-programs/${tutor.id}/${uploadId}.${extension}`;
}

export async function listAnnualPrograms(): Promise<AnnualProgram[]> {
  const tutor = await requireTutor();
  const sql = sqlClient();
  const [rows, events] = await Promise.all([sql`SELECT id, academic_year, title, file_name, file_size,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    FROM annual_programs WHERE tutor_id = ${tutor.id}
    ORDER BY academic_year DESC, created_at DESC LIMIT 100`, sql`SELECT e.id, e.program_id, e.position, e.date_label, e.grade_level, e.activity, e.location
    FROM annual_program_events e JOIN annual_programs p ON p.id = e.program_id
    WHERE p.tutor_id = ${tutor.id} ORDER BY e.program_id, e.position`]);
  const byProgram = new Map<string, AnnualProgramEvent[]>();
  for (const row of events as Array<AnnualProgramEvent & { program_id: string }>) {
    const list = byProgram.get(row.program_id) ?? [];
    list.push(row);
    byProgram.set(row.program_id, list);
  }
  return (rows as Omit<AnnualProgram, 'image_url' | 'events'>[]).map((row) => ({
    ...row,
    image_url: `/api/annual-programs/image?id=${row.id}`,
    events: byProgram.get(row.id) ?? [],
  }));
}

export async function createAnnualProgram(input: z.input<typeof inputSchema>): Promise<AnnualProgram> {
  const tutor = await requireTutor();
  const value = inputSchema.parse(input);
  const extension = value.fileName.split('.').pop()?.toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension || '')) throw new Error('Choose a JPEG, PNG or WebP image.');
  const imagePath = `english-department-programs/${tutor.id}/${value.id}.${extension}`;
  const image = await head(imagePath);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.contentType || '')) throw new Error('The uploaded file is not a supported image.');
  if (image.size > 15 * 1024 * 1024) throw new Error('Images must be 15 MB or smaller.');
  const sql = sqlClient();
  const statements = [
    sql`INSERT INTO annual_programs (id, tutor_id, academic_year, title, image_path, file_name, content_type, file_size)
      VALUES (${value.id}, ${tutor.id}, ${value.academicYear}, ${value.title}, ${imagePath}, ${value.fileName}, ${image.contentType}, ${image.size})
      RETURNING id, academic_year, title, file_name, file_size,
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
    ...value.events.map((event, position) => sql`INSERT INTO annual_program_events (program_id, position, date_label, grade_level, activity, location)
      VALUES (${value.id}, ${position}, ${event.dateLabel}, ${event.gradeLevel}, ${event.activity}, ${event.location})
      RETURNING id, position, date_label, grade_level, activity, location`),
  ];
  const result = await sql.transaction(statements);
  const row = result[0][0] as Omit<AnnualProgram, 'image_url' | 'events'>;
  const savedEvents = result.slice(1).flat() as AnnualProgramEvent[];
  return { ...row, image_url: `/api/annual-programs/image?id=${row.id}`, events: savedEvents };
}

export async function deleteAnnualProgram(id: string): Promise<void> {
  const tutor = await requireTutor();
  const programId = z.string().uuid().parse(id);
  const rows = await sqlClient()`SELECT image_path FROM annual_programs WHERE id = ${programId} AND tutor_id = ${tutor.id} LIMIT 1`;
  if (!rows.length) return;
  const imagePath = (rows[0] as { image_path: string }).image_path;
  await del(imagePath);
  await sqlClient()`DELETE FROM annual_programs WHERE id = ${programId} AND tutor_id = ${tutor.id}`;
}
