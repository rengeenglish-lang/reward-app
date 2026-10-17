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
  // PDF.js asks for byte ranges so it can show the first page before the
  // entire book has downloaded. Forward those headers to Blob and preserve
  // the partial response metadata on the way back to the browser.
  const range = request.headers.get('range');
  const ifRange = request.headers.get('if-range');
  const result = await get(material.pathname, {
    access: 'private',
    ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    headers: {
      ...(range ? { Range: range } : {}),
      ...(ifRange ? { 'If-Range': ifRange } : {}),
    },
  });
  if (!result) return new NextResponse('PDF not found.', { status: 404 });
  if (result.statusCode === 304) {
    return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' } });
  }
  const contentRange = result.headers.get('content-range');
  const responseHeaders: HeadersInit = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(material.file_name)}`,
    'X-Content-Type-Options': 'nosniff',
    ETag: result.blob.etag,
    'Cache-Control': 'private, max-age=0, must-revalidate',
    'Accept-Ranges': 'bytes',
  };
  const contentLength = result.headers.get('content-length');
  if (contentLength) responseHeaders['Content-Length'] = contentLength;
  if (contentRange) responseHeaders['Content-Range'] = contentRange;
  return new NextResponse(result.stream, { status: contentRange ? 206 : 200, headers: responseHeaders });
}
