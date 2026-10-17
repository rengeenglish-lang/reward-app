'use server';

import { del, head } from '@vercel/blob';
import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { requireTutor } from '@/lib/session';

export type AnnualProgram = {
  id: string;
  academic_year: string;
  title: string;
  image_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
};

const inputSchema = z.object({
  id: z.string().uuid(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  title: z.string().trim().min(1).max(160),
  fileName: z.string().trim().min(1).max(180),
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
  const rows = await sqlClient()`SELECT id, academic_year, title, file_name, file_size,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    FROM annual_programs WHERE tutor_id = ${tutor.id}
    ORDER BY academic_year DESC, created_at DESC LIMIT 100`;
  return (rows as Omit<AnnualProgram, 'image_url'>[]).map((row) => ({ ...row, image_url: `/api/annual-programs/image?id=${row.id}` }));
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
  const rows = await sqlClient()`INSERT INTO annual_programs (id, tutor_id, academic_year, title, image_path, file_name, content_type, file_size)
    VALUES (${value.id}, ${tutor.id}, ${value.academicYear}, ${value.title}, ${imagePath}, ${value.fileName}, ${image.contentType}, ${image.size})
    RETURNING id, academic_year, title, file_name, file_size,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`;
  const row = rows[0] as Omit<AnnualProgram, 'image_url'>;
  return { ...row, image_url: `/api/annual-programs/image?id=${row.id}` };
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
