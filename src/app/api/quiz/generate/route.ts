import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTutor } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_IMAGE_CHARS = 6_000_000; // base64 characters, roughly 4.5 MB of image
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const requestSchema = z.object({
  image: z.string().min(100).max(MAX_IMAGE_CHARS),
  mediaType: z.enum(MEDIA_TYPES),
});

const orderQuestion = z.object({
  type: z.literal('order'),
  chunks: z.array(z.string().trim().min(1).max(60)).min(3).max(10),
  explain: z.string().max(300).default(''),
});
const mcqQuestion = z.object({
  type: z.literal('mcq'),
  q: z.string().trim().min(3).max(400),
  options: z.array(z.string().trim().min(1).max(200)).length(4),
  answer: z.number().int().min(0).max(3),
  explain: z.string().max(300).default(''),
});
const questionSchema = z.discriminatedUnion('type', [orderQuestion, mcqQuestion]);

const PROMPT = `You are building a language-practice quiz from the attached photo. The photo shows questions, exercises or a text.
Create 8 questions in total: about half "order" questions and half "mcq" questions.
- If the photo already contains questions, use them (rewrite as needed). Otherwise write questions about the content shown.
- "order": a sentence split into 3 to 8 pieces (single words or short phrases). "chunks" lists the pieces in the CORRECT order. The sentence must be natural and have one clearly best order.
- "mcq": a question with exactly 4 options and "answer" = the zero-based index of the correct option.
- Every question has a one-sentence "explain" that says why the answer is right.
- Keep the language of the photo.
Reply with only JSON in this shape:
{"title":"short quiz title","questions":[{"type":"order","chunks":["I","have","two","cats"],"explain":"..."},{"type":"mcq","q":"...","options":["a","b","c","d"],"answer":0,"explain":"..."}]}`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON in model reply');
  return JSON.parse(body.slice(start, end + 1));
}

export async function POST(request: Request) {
  try {
    await requireTutor();
  } catch {
    return NextResponse.json({ error: 'Sign in as the tutor to turn photos into quizzes.' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Photo quizzes are not set up yet. Add ANTHROPIC_API_KEY to the project settings.' }, { status: 503 });
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'That image could not be read. Try a JPG or PNG under 4 MB.' }, { status: 400 });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.image } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });
    if (!upstream.ok) {
      console.error('Quiz generation upstream error', upstream.status, await upstream.text().catch(() => ''));
      return NextResponse.json({ error: 'The quiz writer is unavailable right now. Try again in a minute.' }, { status: 502 });
    }
    const data = await upstream.json() as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n');
    const raw = extractJson(text) as { title?: unknown; questions?: unknown };
    const questions = (Array.isArray(raw.questions) ? raw.questions : [])
      .map((q) => questionSchema.safeParse(q))
      .flatMap((r) => (r.success ? [r.data] : []));
    if (questions.length < 2) {
      return NextResponse.json({ error: 'No usable questions were found in that photo. Try a clearer picture.' }, { status: 422 });
    }
    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 60) : 'Your quiz';
    return NextResponse.json({ title, questions });
  } catch (error) {
    console.error('Quiz generation failed', error);
    return NextResponse.json({ error: 'The quiz could not be built from that photo. Try again.' }, { status: 500 });
  }
}
