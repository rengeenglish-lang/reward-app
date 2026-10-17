import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { currentTutor } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const tutor = await currentTutor();
  if (!tutor) return new NextResponse('Sign in required', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get('id'));
  if (!id.success) return new NextResponse('Invalid program', { status: 400 });
  const rows = await sqlClient()`SELECT image_path, file_name, content_type FROM annual_programs
    WHERE id = ${id.data} AND tutor_id = ${tutor.id} LIMIT 1`;
  const program = rows[0] as { image_path: string; file_name: string; content_type: string } | undefined;
  if (!program) return new NextResponse('Program not found', { status: 404 });
  const blob = await get(program.image_path, { access: 'private' });
  if (!blob) return new NextResponse('Program image not found', { status: 404 });
  return new NextResponse(blob.stream, {
    headers: {
      'Content-Type': program.content_type,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(program.file_name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
