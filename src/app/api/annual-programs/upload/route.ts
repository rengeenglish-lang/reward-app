import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { requireTutor } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SIZE = 15 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    if (body.type !== 'blob.upload-completed') await requireTutor();
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const tutor = await requireTutor();
        const payload = JSON.parse(clientPayload || '{}') as { id?: string; fileName?: string };
        const fileName = payload.fileName?.split(/[\\/]/).pop()?.replace(/[^\p{L}\p{N}._ ()-]/gu, '').trim().slice(0, 180) || '';
        const extension = fileName.split('.').pop()?.toLowerCase();
        const id = payload.id || '';
        if (!/^[0-9a-f-]{36}$/i.test(id) || pathname !== `english-department-programs/${tutor.id}/${id}.${extension}` || !['jpg', 'jpeg', 'png', 'webp'].includes(extension || '')) {
          throw new Error('Invalid yearly program image path.');
        }
        return {
          allowedContentTypes: IMAGE_TYPES,
          maximumSizeInBytes: MAX_SIZE,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ fileName }),
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Annual program image upload endpoint failed', error);
    const message = error instanceof Error && error.message === 'Authentication required' ? 'Sign in to upload a yearly program.' : 'Could not prepare this program image upload.';
    return NextResponse.json({ error: message }, { status: message.startsWith('Sign in') ? 401 : 400 });
  }
}
