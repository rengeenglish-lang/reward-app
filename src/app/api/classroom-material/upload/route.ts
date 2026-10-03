import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { head } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { requireTutor } from '@/lib/session';
import { sqlClient } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MATERIAL_PATH = 'classroom-materials/shared.pdf';
const MAX_SIZE = 150 * 1024 * 1024;

function safeFileName(value: string): string {
  const name = value.split(/[\\/]/).pop()?.replace(/[^\p{L}\p{N}._ ()-]/gu, '').trim().slice(0, 180);
  return name && name.toLowerCase().endsWith('.pdf') ? name : 'classroom-material.pdf';
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    // Vercel calls this same route after a completed upload. handleUpload verifies
    // that callback's signature, so require the tutor session only for token requests.
    if (body.type !== 'blob.upload-completed') await requireTutor();
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (pathname !== MATERIAL_PATH) throw new Error('Invalid classroom material path.');
        let fileName = 'classroom-material.pdf';
        try { if (clientPayload) fileName = safeFileName(JSON.parse(clientPayload).fileName); } catch { /* use fallback name */ }
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: MAX_SIZE,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({ fileName }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const details = JSON.parse(tokenPayload || '{}') as { fileName?: string };
        const fileName = safeFileName(details.fileName || 'classroom-material.pdf');
        const stored = await head(blob.pathname);
        await sqlClient()`INSERT INTO shared_classroom_material(singleton,pathname,file_name,file_size,updated_at)
          VALUES(true,${blob.pathname},${fileName},${stored.size},now())
          ON CONFLICT(singleton) DO UPDATE SET pathname=EXCLUDED.pathname,file_name=EXCLUDED.file_name,file_size=EXCLUDED.file_size,updated_at=now()`;
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error && error.message === 'Authentication required' ? 'Sign in to upload classroom material.' : 'Could not prepare this PDF upload.';
    return NextResponse.json({ error: message }, { status: message.startsWith('Sign in') ? 401 : 400 });
  }
}
