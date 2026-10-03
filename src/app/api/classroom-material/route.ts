import { NextResponse } from 'next/server';
import { currentTutor } from '@/lib/session';
import { sqlClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!await currentTutor()) return NextResponse.json({ error: 'Sign in to access classroom material.' }, { status: 401 });
    const rows = await sqlClient()`SELECT file_name, file_size, updated_at FROM shared_classroom_material WHERE singleton=true LIMIT 1`;
    const material = rows[0] as { file_name: string; file_size: number | string; updated_at: Date | string } | undefined;
    return NextResponse.json({ material: material ? { name: material.file_name, size: Number(material.file_size), updatedAt: material.updated_at } : null }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Shared PDF storage is not ready yet. Connect private Vercel Blob storage and apply the latest database migration.' }, { status: 503 });
  }
}
