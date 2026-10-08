import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTutor } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_IMAGE_CHARS = 6_000_000; // base64 characters, roughly 4.5 MB of image
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const TYPES = [
  'mcq', 'truefalse', 'single', 'blanks', 'dragwords', 'markwords', 'sortwords', 'sortparas',
  'summary', 'match', 'memory', 'cards', 'essay', 'wordsearch', 'crossword', 'dictation', 'personality',
] as const;
type GenType = (typeof TYPES)[number];

const requestSchema = z.object({
  image: z.string().min(100).max(MAX_IMAGE_CHARS),
  mediaType: z.enum(MEDIA_TYPES),
  types: z.array(z.enum(TYPES)).min(1).max(TYPES.length),
  count: z.number().int().min(3).max(15),
});

const text = (max: number) => z.string().trim().min(1).max(max);
const explain = z.string().max(300).default('');
const marked = text(500).refine((t) => /\*[^*]+\*/.test(t), 'needs at least one *marked* word');
const pair = z.object({ a: text(80), b: text(120) });

const questionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mcq'), q: text(400), options: z.array(text(200)).length(4), answer: z.number().int().min(0).max(3), explain }),
  z.object({ type: z.literal('single'), q: text(400), options: z.array(text(200)).min(2).max(4), answer: z.number().int().min(0).max(3), explain }),
  z.object({ type: z.literal('truefalse'), q: text(400), answer: z.boolean(), explain }),
  z.object({ type: z.literal('blanks'), text: marked, explain }),
  z.object({ type: z.literal('dragwords'), text: marked, distractors: z.array(text(40)).max(4).default([]), explain }),
  z.object({ type: z.literal('markwords'), q: text(200), text: marked, explain }),
  z.object({ type: z.literal('sortwords'), chunks: z.array(text(60)).min(3).max(10), explain }),
  z.object({ type: z.literal('sortparas'), q: text(200), items: z.array(text(200)).min(3).max(6), explain }),
  z.object({ type: z.literal('summary'), q: text(200), rounds: z.array(z.object({ statements: z.array(text(200)).length(3), answer: z.number().int().min(0).max(2) })).min(2).max(4), explain }),
  z.object({ type: z.literal('match'), q: text(200), pairs: z.array(pair).min(3).max(6), explain }),
  z.object({ type: z.literal('memory'), q: text(200), pairs: z.array(pair).min(3).max(6), explain }),
  z.object({ type: z.literal('cards'), q: text(200), cards: z.array(z.object({ front: text(200), back: text(300) })).min(3).max(8), explain }),
  z.object({ type: z.literal('essay'), q: text(300), keywords: z.array(text(40)).min(3).max(8), sample: text(500), explain }),
  z.object({ type: z.literal('wordsearch'), q: text(200), words: z.array(text(14)).min(3).max(10), explain }),
  z.object({ type: z.literal('crossword'), q: text(200), entries: z.array(z.object({ answer: text(14), clue: text(160) })).min(3).max(8), explain }),
  z.object({ type: z.literal('dictation'), sentence: text(240), explain }),
  z.object({ type: z.literal('personality'), q: text(300), options: z.array(z.object({ text: text(200), outcome: z.number().int().min(0).max(4) })).min(2).max(4), explain }),
]);

const SPEC: Record<GenType, string> = {
  mcq: '{"type":"mcq","q":"question","options":["a","b","c","d"],"answer":0,"explain":"why"}  (exactly 4 options, answer is the zero-based index)',
  truefalse: '{"type":"truefalse","q":"a statement","answer":true,"explain":"why"}',
  single: '{"type":"single","q":"short question","options":["a","b","c"],"answer":1,"explain":"why"}  (2 to 4 short options, quick to answer)',
  blanks: '{"type":"blanks","text":"She *has* lived in Istanbul *for/since* ten years.","explain":"why"}  (each missing word between asterisks; alternatives separated by /)',
  dragwords: '{"type":"dragwords","text":"The *cat* sat on the *mat*.","distractors":["dog","table"],"explain":"why"}  (missing words between asterisks, 0 to 3 wrong distractor words)',
  markwords: '{"type":"markwords","q":"Tap all the verbs.","text":"The children *play* football and *eat* lunch.","explain":"why"}  (the words to find are between asterisks)',
  sortwords: '{"type":"sortwords","chunks":["I","have","two","cats"],"explain":"why"}  (3 to 8 pieces in the CORRECT order; one clearly best order)',
  sortparas: '{"type":"sortparas","q":"Put the story in order.","items":["first sentence","second","third"],"explain":"why"}  (3 to 6 sentences in the CORRECT order)',
  summary: '{"type":"summary","q":"Summary of the topic","rounds":[{"statements":["true one","false","false"],"answer":0}],"explain":"why"}  (2 to 4 rounds, exactly 3 statements each, answer is the index of the true one)',
  match: '{"type":"match","q":"Match each term with its meaning.","pairs":[{"a":"term","b":"meaning"}],"explain":"why"}  (3 to 6 pairs)',
  memory: '{"type":"memory","q":"Find the matching pairs.","pairs":[{"a":"word","b":"match"}],"explain":"why"}  (3 to 6 short pairs)',
  cards: '{"type":"cards","q":"Review these cards.","cards":[{"front":"term","back":"definition"}],"explain":""}  (4 to 8 cards)',
  essay: '{"type":"essay","q":"open question","keywords":["idea1","idea2","idea3"],"sample":"model answer in 1-2 sentences","explain":"why"}  (3 to 8 key single words or short stems)',
  wordsearch: '{"type":"wordsearch","q":"Find the words about ...","words":["WORD","OTHER"],"explain":""}  (4 to 8 single words of 3 to 10 letters, letters only)',
  crossword: '{"type":"crossword","q":"Solve the crossword.","entries":[{"answer":"WORD","clue":"short clue"}],"explain":""}  (4 to 7 single words of 3 to 10 letters that share letters)',
  dictation: '{"type":"dictation","sentence":"A natural sentence of 6 to 14 words.","explain":"why"}',
  personality: '{"type":"personality","q":"question about preferences","options":[{"text":"answer","outcome":0},{"text":"answer","outcome":1}],"explain":""}  (each option maps to an outcome index; use the same outcome indexes across questions)',
};

function buildPrompt(types: GenType[], count: number): string {
  const personality = types.length === 1 && types[0] === 'personality';
  const lines = types.map((t) => `- ${t}: ${SPEC[t]}`).join('\n');
  return `You are building an interactive study quiz from the attached photo. The photo shows questions, exercises or a text.
Create about ${count} items in total, spread evenly across ONLY these item types:
${lines}

Rules:
- If the photo already contains questions, use them (rewrite as needed). Otherwise write items about the content shown.
- Keep the language of the photo. Keep every item short and unambiguous with one clearly correct answer.
- "explain" is one sentence saying why the answer is right.
- Do not use any item type that is not listed above.
${personality ? '- Also return "outcomes": 2 to 4 result profiles [{"title":"...","description":"one friendly sentence"}] and make each option "outcome" the zero-based index of one of them.\n' : ''}Reply with only JSON in this shape:
{"title":"short quiz title","questions":[ ...items... ]${personality ? ',"outcomes":[...]' : ''}}`;
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
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
    return NextResponse.json({ error: 'That request could not be read. Try a JPG or PNG under 4 MB.' }, { status: 400 });
  }
  const types = Array.from(new Set(parsed.types));
  if (types.includes('personality') && types.length > 1) {
    return NextResponse.json({ error: 'The personality quiz cannot be mixed with other types.' }, { status: 400 });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.image } },
            { type: 'text', text: buildPrompt(types, parsed.count) },
          ],
        }],
      }),
    });
    if (!upstream.ok) {
      console.error('Quiz generation upstream error', upstream.status, await upstream.text().catch(() => ''));
      return NextResponse.json({ error: 'The quiz writer is unavailable right now. Try again in a minute.' }, { status: 502 });
    }
    const data = await upstream.json() as { content?: { type: string; text?: string }[] };
    const reply = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n');
    const raw = extractJson(reply) as { title?: unknown; questions?: unknown; outcomes?: unknown };

    const outcomes = types[0] === 'personality'
      ? z.array(z.object({ title: text(60), description: text(240) })).min(2).max(5).safeParse(raw.outcomes)
      : null;
    if (types[0] === 'personality' && !outcomes?.success) {
      return NextResponse.json({ error: 'The personality quiz could not be built from that photo. Try again.' }, { status: 422 });
    }

    const allowed = new Set<string>(types);
    const questions = (Array.isArray(raw.questions) ? raw.questions : [])
      .map((q) => questionSchema.safeParse(q))
      .flatMap((r) => (r.success && allowed.has(r.data.type) ? [r.data] : []))
      .filter((q) => {
        if (q.type === 'personality') return outcomes?.success ? q.options.every((o) => o.outcome < outcomes.data.length) : false;
        if (q.type === 'mcq' || q.type === 'single') return q.answer < q.options.length;
        return true;
      });
    if (questions.length < 2 && !(questions.length === 1 && questions[0].type !== 'mcq')) {
      return NextResponse.json({ error: 'No usable questions were found in that photo. Try a clearer picture or another quiz type.' }, { status: 422 });
    }
    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 60) : 'Your quiz';
    return NextResponse.json({ title, questions, outcomes: outcomes?.success ? outcomes.data : undefined });
  } catch (error) {
    console.error('Quiz generation failed', error);
    return NextResponse.json({ error: 'The quiz could not be built from that photo. Try again.' }, { status: 500 });
  }
}
