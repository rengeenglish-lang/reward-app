import type { Q } from './types';

export const SAMPLE_GRAMMAR: Q[] = [
  { type: 'sortwords', chunks: ['She', 'has', 'lived', 'in', 'Istanbul', 'for', 'ten years'], explain: 'Present perfect with for + a period of time.' },
  { type: 'mcq', q: 'If it rains tomorrow, we ___ the picnic.', options: ['cancel', 'will cancel', 'would cancel', 'cancelled'], answer: 1, explain: 'First conditional: if + present simple, will + base verb.' },
  { type: 'sortwords', chunks: ['Could', 'you', 'tell', 'me', 'where', 'the station', 'is?'], explain: 'In an indirect question the verb follows the subject: where the station is.' },
  { type: 'mcq', q: 'Choose the sentence with the correct article.', options: ['He is an university student.', 'He is a university student.', 'He is the university student.', 'He is university student.'], answer: 1, explain: 'University starts with the sound /ju:/, so we use a.' },
  { type: 'sortwords', chunks: ['I', 'wish', 'I', 'had', 'studied', 'harder'], explain: 'Wish + past perfect talks about a regret about the past.' },
  { type: 'mcq', q: 'By next year, they ___ the new bridge.', options: ['finish', 'are finishing', 'will have finished', 'have finished'], answer: 2, explain: 'Future perfect: will have + past participle, for an action completed before a future time.' },
];

/** One round of every photo-based type, so every view can be tried without a photo. */
export const SAMPLE_ALL: Q[] = [
  { type: 'mcq', q: 'Which word is a noun?', options: ['quickly', 'happiness', 'run', 'beautiful'], answer: 1, explain: 'Happiness names a feeling, so it is a noun.' },
  { type: 'truefalse', q: 'The past tense of "go" is "goed".', answer: false, explain: 'Go is irregular: the past tense is went.' },
  { type: 'single', q: 'Plural of "child"?', options: ['childs', 'children', 'childes'], answer: 1, explain: 'Child has an irregular plural.' },
  { type: 'blanks', text: 'She *has* lived in Istanbul *for/since* ten years.', explain: 'Present perfect with for + a period of time.' },
  { type: 'dragwords', text: 'The *cat* sat on the *mat* and watched the *birds*.', distractors: ['dog', 'table'], explain: 'Use the nouns that make the sentence sensible.' },
  { type: 'markwords', q: 'Tap all the verbs.', text: 'The children *play* football and *eat* lunch outside.', explain: 'Play and eat are action words.' },
  { type: 'sortwords', chunks: ['I', 'wish', 'I', 'had', 'studied', 'harder'], explain: 'Wish + past perfect talks about a regret about the past.' },
  { type: 'sortparas', q: 'Put the story in order.', items: ['Ali woke up late.', 'He missed the bus.', 'He walked to school.', 'He arrived just in time.'], explain: 'Follow the cause and effect.' },
  { type: 'summary', q: 'Build a summary of the water cycle.', rounds: [
    { statements: ['Water evaporates when the sun heats it.', 'Water evaporates when it freezes.', 'Water only moves underground.'], answer: 0 },
    { statements: ['Clouds form when vapour cools and condenses.', 'Clouds form from smoke only.', 'Clouds are solid rock.'], answer: 0 },
  ], explain: 'Evaporation then condensation.' },
  { type: 'match', q: 'Match each word with its meaning.', pairs: [{ a: 'huge', b: 'very big' }, { a: 'tiny', b: 'very small' }, { a: 'rapid', b: 'very fast' }, { a: 'silent', b: 'without sound' }], explain: 'These are all strong adjectives.' },
  { type: 'memory', q: 'Find the opposite pairs.', pairs: [{ a: 'hot', b: 'cold' }, { a: 'up', b: 'down' }, { a: 'early', b: 'late' }, { a: 'open', b: 'closed' }], explain: 'Opposites are antonyms.' },
  { type: 'cards', q: 'Flip each card and rate yourself.', cards: [{ front: 'borrow', back: 'to take something and give it back later' }, { front: 'lend', back: 'to give something for a short time' }, { front: 'rent', back: 'to pay to use something' }], explain: '' },
  { type: 'essay', q: 'In one or two sentences, why is sleep important?', keywords: ['health', 'energy', 'memory', 'brain', 'rest'], sample: 'Sleep gives the body rest and energy, and it helps the brain store memories.', explain: 'A good answer mentions rest, energy or memory.' },
  { type: 'wordsearch', q: 'Find the animal words.', words: ['CAT', 'HORSE', 'RABBIT', 'TIGER', 'SHEEP'], explain: 'Words can run across, down or diagonally.' },
  { type: 'crossword', q: 'Solve the crossword.', entries: [
    { answer: 'PLANET', clue: 'Earth is one' }, { answer: 'STAR', clue: 'The sun is one' }, { answer: 'MOON', clue: 'It orbits Earth' }, { answer: 'ORBIT', clue: 'The path around a planet' }, { answer: 'SPACE', clue: 'Where the planets are' },
  ], explain: '' },
  { type: 'dictation', sentence: 'The quick brown fox jumps over the lazy dog.', explain: 'Listen carefully to each word.' },
];

export const SAMPLE_PERSONALITY: { qs: Q[]; outcomes: { title: string; description: string }[] } = {
  outcomes: [
    { title: 'The Explorer', description: 'You learn by trying new things and asking lots of questions.' },
    { title: 'The Planner', description: 'You like clear steps, lists and finishing what you start.' },
  ],
  qs: [
    { type: 'personality', q: 'A new topic starts in class. What do you do first?', options: [{ text: 'Jump in and try an example', outcome: 0 }, { text: 'Read the instructions carefully', outcome: 1 }], explain: '' },
    { type: 'personality', q: 'How do you prefer to study?', options: [{ text: 'Different place each time', outcome: 0 }, { text: 'Same desk with a timetable', outcome: 1 }], explain: '' },
    { type: 'personality', q: 'Pick a weekend plan.', options: [{ text: 'Surprise trip', outcome: 0 }, { text: 'Tidy up and prepare for the week', outcome: 1 }], explain: '' },
  ],
};
