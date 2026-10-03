import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { requireTutor } from '@/lib/session';
import { sqlClient } from '@/lib/db';

export const runtime = 'nodejs';

export async function DELETE() {
  try {
    await requireTutor();
    const rows = await sqlClient()`SELECT pathname FROM shared_classroom_material WHERE singleton=true LIMIT 1`;
    const material = rows[0] as { pathname: string } | undefined;
    if (material) await del(material.pathname);
    await sqlClient()`DELETE FROM shared_classroom_material WHERE singleton=true`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not remove the shared PDF.' }, { status: 503 });
  }
}
