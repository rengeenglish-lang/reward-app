import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { currentTutor } from '@/lib/session';
import { sqlClient } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!await currentTutor()) return new NextResponse('Sign in required', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const rows = await sqlClient()`SELECT pathname, file_name FROM shared_classroom_material WHERE singleton=true LIMIT 1`;
  const material = rows[0] as { pathname: string; file_name: string } | undefined;
  if (!material) return new NextResponse('No shared classroom PDF has been uploaded.', { status: 404 });
  const result = await get(material.pathname, { access: 'private', useCache: false, ifNoneMatch: request.headers.get('if-none-match') ?? undefined });
  if (!result) return new NextResponse('PDF not found.', { status: 404 });
  if (result.statusCode === 304) {
    return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' } });
  }
  return new NextResponse(result.stream, { headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(material.file_name)}`,
    'Content-Length': String(result.blob.size),
    'X-Content-Type-Options': 'nosniff',
    ETag: result.blob.etag,
    'Cache-Control': 'private, no-cache',
  } });
}
