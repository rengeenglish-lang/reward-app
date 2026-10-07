import type { Metadata } from 'next';
import { currentTutor } from '@/lib/session';
import QuizApp from './quiz-app';

export const metadata: Metadata = {
  title: 'SnapQuiz · Ezgili Champs',
  description: 'Turn a photo of questions into a game with sentence-builder and multiple-choice rounds.',
};
export const dynamic = 'force-dynamic';

export default async function QuizPage() {
  let canGenerate = false;
  try { canGenerate = Boolean(await currentTutor()); } catch { /* no session or database: sample quiz only */ }
  return <QuizApp canGenerate={canGenerate} />;
}
