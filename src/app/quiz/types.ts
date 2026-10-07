export type QType =
  | 'mcq' | 'truefalse' | 'single' | 'blanks' | 'dragwords' | 'markwords' | 'sortwords' | 'sortparas'
  | 'summary' | 'match' | 'memory' | 'cards' | 'essay' | 'wordsearch' | 'crossword' | 'dictation'
  | 'personality' | 'arith';

export type Pair = { a: string; b: string };

export type Q =
  | { type: 'mcq'; q: string; options: string[]; answer: number; explain: string }
  | { type: 'single'; q: string; options: string[]; answer: number; explain: string }
  | { type: 'truefalse'; q: string; answer: boolean; explain: string }
  | { type: 'blanks'; text: string; explain: string }
  | { type: 'dragwords'; text: string; distractors: string[]; explain: string }
  | { type: 'markwords'; q: string; text: string; explain: string }
  | { type: 'sortwords'; chunks: string[]; explain: string }
  | { type: 'sortparas'; q: string; items: string[]; explain: string }
  | { type: 'summary'; q: string; rounds: { statements: string[]; answer: number }[]; explain: string }
  | { type: 'match'; q: string; pairs: Pair[]; explain: string }
  | { type: 'memory'; q: string; pairs: Pair[]; explain: string }
  | { type: 'cards'; q: string; cards: { front: string; back: string }[]; explain: string }
  | { type: 'essay'; q: string; keywords: string[]; sample: string; explain: string }
  | { type: 'wordsearch'; q: string; words: string[]; explain: string }
  | { type: 'crossword'; q: string; entries: { answer: string; clue: string }[]; explain: string }
  | { type: 'dictation'; sentence: string; explain: string }
  | { type: 'personality'; q: string; options: { text: string; outcome: number }[]; explain: string }
  | { type: 'arith'; a: number; b: number; op: '+' | '-' | '×' | '÷'; answer: number; explain: string };

export type Persona = { title: string; description: string };
export type Quiz = { title: string; qs: Q[]; outcomes?: Persona[]; lives?: number };

/** What a question view reports when the player has finished it. */
export type Done = { ok: boolean; note?: string; bonus?: number; pick?: number };

export type TypeInfo = { id: QType; title: string; h5p: string; blurb: string; photo: boolean; exclusive?: boolean };

export const TYPE_INFO: TypeInfo[] = [
  { id: 'mcq', title: 'Multiple choice', h5p: 'Multiple Choice', blurb: 'Pick the right answer from four options.', photo: true },
  { id: 'truefalse', title: 'True or false', h5p: 'True/False Question', blurb: 'Decide if a statement is true or false.', photo: true },
  { id: 'single', title: 'Rapid single choice', h5p: 'Single Choice Set', blurb: 'Quick one-tap questions that move on by themselves.', photo: true },
  { id: 'blanks', title: 'Fill in the blanks', h5p: 'Fill in the Blanks, Complex fill the blanks', blurb: 'Type the missing words in a text.', photo: true },
  { id: 'dragwords', title: 'Drag the words', h5p: 'Drag the Words', blurb: 'Drag words into the gaps of a text.', photo: true },
  { id: 'markwords', title: 'Mark the words', h5p: 'Mark the Words', blurb: 'Tap every word that fits the instruction.', photo: true },
  { id: 'sortwords', title: 'Sentence builder', h5p: 'Sentence order (like Drag the Words)', blurb: 'Drag word pieces into a correct sentence.', photo: true },
  { id: 'sortparas', title: 'Sort the paragraphs', h5p: 'Sort the Paragraphs', blurb: 'Put sentences or steps in the right order.', photo: true },
  { id: 'summary', title: 'Summary', h5p: 'Summary', blurb: 'Choose the true statement in each step to build a summary.', photo: true },
  { id: 'match', title: 'Match the pairs', h5p: 'Drag and Drop, Image pairing', blurb: 'Match each term with its meaning.', photo: true },
  { id: 'memory', title: 'Memory game', h5p: 'Memory Game', blurb: 'Flip cards to find matching pairs.', photo: true },
  { id: 'cards', title: 'Flashcards', h5p: 'Dialog Cards, Flashcards, Guess the Answer', blurb: 'Flip cards and rate what you knew.', photo: true },
  { id: 'essay', title: 'Short answer', h5p: 'Essay', blurb: 'Write an answer and get feedback on key ideas.', photo: true },
  { id: 'wordsearch', title: 'Word search', h5p: 'Find the words', blurb: 'Find hidden words in a letter grid.', photo: true },
  { id: 'crossword', title: 'Crossword', h5p: 'Crossword', blurb: 'Solve a crossword from clues.', photo: true },
  { id: 'dictation', title: 'Dictation', h5p: 'Dictation', blurb: 'Listen to a sentence and type it.', photo: true },
  { id: 'personality', title: 'Personality quiz', h5p: 'Personality Quiz', blurb: 'Answer questions and get a fun result. No right answers.', photo: true, exclusive: true },
  { id: 'arith', title: 'Arithmetic quiz', h5p: 'Arithmetic Quiz', blurb: 'Timed sums. No photo needed.', photo: false, exclusive: true },
];

/** The mix used by the "Mixed quiz" button (H5P Quiz / Question Set). */
export const MIXED: QType[] = ['mcq', 'truefalse', 'blanks', 'sortwords', 'dragwords', 'match'];
