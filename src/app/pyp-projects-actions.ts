'use server';

import { z } from 'zod';
import { requireTutor } from '@/lib/session';
import { PROJECT_IDEAS, THEME_INFO, type ProjectSuggestion } from '@/lib/teacher-issues';

const input = z.object({ grade: z.number().int().min(1).max(4), theme: z.string().trim().min(1).max(60), description: z.string().trim().max(600).optional(), avoid: z.array(z.string().max(200)).max(20).default([]) });
const line = z.string().trim().min(1).max(300);
const reply = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(600),
  centralIdea: z.string().trim().min(1).max(300),
  linesOfInquiry: z.array(line).min(2).max(4),
  activities: z.array(line).min(3).max(6),
  studentAction: z.string().trim().max(300).default(''),
});

const AGES: Record<number, string> = { 1: '6–7', 2: '7–8', 3: '8–9', 4: '9–10' };

/** A ready-made idea for the grade and theme, used when no AI key is set or the request fails. */
function starter(grade: number, theme: string, avoid: string[]): ProjectSuggestion {
  const pool = PROJECT_IDEAS.filter((i) => i.grade === grade && i.theme === theme);
  const pick = pool.find((i) => !avoid.includes(i.title)) ?? pool[0];
  if (!pick) return { title: `${theme} project`, summary: `Plan a project for Grade ${grade} around the theme "${theme}". Add your own title and details, then save it.`, centralIdea: '', linesOfInquiry: [], activities: [], studentAction: '', source: 'starter' };
  return { title: pick.title, summary: pick.idea, centralIdea: '', linesOfInquiry: [], activities: [], studentAction: '', source: 'starter' };
}

export async function suggestProject(raw: z.input<typeof input>): Promise<ProjectSuggestion> {
  await requireTutor();
  const { grade, theme, avoid, description } = input.parse(raw);
  const themeInfo = description || (THEME_INFO as Record<string, { description: string } | undefined>)[theme]?.description || '';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return starter(grade, theme, avoid);
  const prompt = `You are helping a primary teacher at an IB PYP school in Turkey plan a unit of inquiry project.
Grade ${grade} (ages ${AGES[grade]}), English-language classroom with Turkish-speaking learners.
Transdisciplinary theme: "${theme}"${themeInfo ? ` — ${themeInfo}` : ''}
Suggest ONE practical, age-appropriate project for this theme. Use PYP language (central idea, lines of inquiry, student action). Where natural, connect to Turkish culture or places children know, but do not claim a specific MEB outcome code.
${avoid.length ? `Do not repeat these earlier ideas: ${avoid.join('; ')}.` : ''}
Reply with only JSON:
{"title":"short project name","summary":"2 sentences on what students do","centralIdea":"one transferable sentence","linesOfInquiry":["...","...","..."],"activities":["3 to 5 short activities over 3 to 4 weeks"],"studentAction":"one sentence on how students can take action"}`;
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(45000),
    });
    if (!upstream.ok) return starter(grade, theme, avoid);
    const data = (await upstream.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return starter(grade, theme, avoid);
    return { ...reply.parse(JSON.parse(text.slice(start, end + 1))), source: 'ai' };
  } catch {
    return starter(grade, theme, avoid);
  }
}
