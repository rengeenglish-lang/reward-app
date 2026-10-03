import { head } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { requireTutor } from '@/lib/session';
import { sqlClient } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MATERIAL_PATH = 'classroom-materials/shared.pdf';

function safeFileName(value: unknown): string {
  if (typeof value !== 'string') return 'classroom-material.pdf';
  const name = value.split(/[\\/]/).pop()?.replace(/[^\p{L}\p{N}._ ()-]/gu, '').trim().slice(0, 180);
  return name && name.toLowerCase().endsWith('.pdf') ? name : 'classroom-material.pdf';
}

export async function POST(request: Request) {
  try {
    await requireTutor();
    const body = await request.json() as { fileName?: unknown };
    const blob = await head(MATERIAL_PATH);
    if (blob.contentType !== 'application/pdf') return NextResponse.json({ error: 'The uploaded file is not a PDF.' }, { status: 400 });
    const fileName = safeFileName(body.fileName);
    await sqlClient()`INSERT INTO shared_classroom_material(singleton,pathname,file_name,file_size,updated_at)
      VALUES(true,${blob.pathname},${fileName},${blob.size},now())
      ON CONFLICT(singleton) DO UPDATE SET pathname=EXCLUDED.pathname,file_name=EXCLUDED.file_name,file_size=EXCLUDED.file_size,updated_at=now()`;
    return NextResponse.json({ material: { name: fileName, size: blob.size, updatedAt: blob.uploadedAt } });
  } catch {
    return NextResponse.json({ error: 'Could not finish saving the shared PDF. Check the Vercel Blob connection and database migration.' }, { status: 503 });
  }
}
