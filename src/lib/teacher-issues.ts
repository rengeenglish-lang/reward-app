export const NOTE_KINDS = [
  { id: 'department', label: 'Department meeting' },
  { id: 'class', label: 'Class meeting' },
  { id: 'pyp', label: 'PYP meeting' },
  { id: 'project', label: 'PYP project' },
] as const;
export type NoteKind = (typeof NOTE_KINDS)[number]['id'];

export const GRADES = [1, 2, 3, 4] as const;

// The six PYP transdisciplinary themes, used for every grade from 1 to 4.
export const PYP_THEMES = [
  'Who we are',
  'Where we are in place and time',
  'How we express ourselves',
  'How the world works',
  'How we organize ourselves',
  'Sharing the planet',
] as const;

export type TeacherNote = { id: string; kind: NoteKind; grade: number | null; theme: string | null; title: string; body: string; note_date: string; source: 'typed' | 'photo' };

export const kindLabel = (kind: NoteKind) => NOTE_KINDS.find((k) => k.id === kind)?.label ?? kind;

export type ProjectIdea = { grade: number; theme: (typeof PYP_THEMES)[number]; title: string; idea: string };

// Starter suggestions for school projects, one for every PYP theme in each grade.
export const PROJECT_IDEAS: ProjectIdea[] = [
  { grade: 1, theme: 'Who we are', title: 'All About Me Book', idea: 'Children draw and label their family, favourite things and what they can do, then share the book with a partner.' },
  { grade: 1, theme: 'Where we are in place and time', title: 'Our School Map', idea: 'Walk around school, then make a simple picture map of the rooms and people who help us.' },
  { grade: 1, theme: 'How we express ourselves', title: 'Feelings Faces Gallery', idea: 'Make a class gallery of faces for different feelings, with a sentence for each: "I feel happy when…".' },
  { grade: 1, theme: 'How the world works', title: 'Float or Sink?', idea: 'Test classroom objects in water, predict first, record the results with pictures and talk about why.' },
  { grade: 1, theme: 'How we organize ourselves', title: 'Class Jobs Chart', idea: 'Decide the jobs a class needs, make a rotating chart and review how it is working after a week.' },
  { grade: 1, theme: 'Sharing the planet', title: 'Window Seed Garden', idea: 'Grow beans on the windowsill, measure them each week and talk about what living things need.' },
  { grade: 2, theme: 'Who we are', title: 'Healthy Habits Poster Fair', idea: 'Groups choose one healthy habit, make a poster and teach it to another class.' },
  { grade: 2, theme: 'Where we are in place and time', title: 'Then and Now Toys', idea: 'Interview grandparents about their toys, compare with today and display a then-and-now timeline.' },
  { grade: 2, theme: 'How we express ourselves', title: 'Class Puppet Show', idea: 'Write a short story, make puppets and perform it for younger students.' },
  { grade: 2, theme: 'How the world works', title: 'Shadow Investigation', idea: 'Track a shadow at different times of day, record it and explain what changes and why.' },
  { grade: 2, theme: 'How we organize ourselves', title: 'Class Market Day', idea: 'Make simple goods, set prices, and use play money to buy and sell. Count and record the takings.' },
  { grade: 2, theme: 'Sharing the planet', title: 'Recycling Detectives', idea: 'Sort the classroom rubbish for a week, graph what is found and propose one change.' },
  { grade: 3, theme: 'Who we are', title: 'Friendship Charter', idea: 'Discuss what makes a good friend, write class agreements and illustrate them as a charter on the wall.' },
  { grade: 3, theme: 'Where we are in place and time', title: 'Explorer Travel Journals', idea: 'Research an explorer, then write journal entries as if you were on the journey, with maps and drawings.' },
  { grade: 3, theme: 'How we express ourselves', title: 'Class Newspaper', idea: 'Write news, interviews and reviews about school life, then lay out and share a class newspaper.' },
  { grade: 3, theme: 'How the world works', title: 'Simple Machines Challenge', idea: 'Build a lever, ramp or pulley to move a load, test improvements and explain how it helps.' },
  { grade: 3, theme: 'How we organize ourselves', title: 'Plan a School Event', idea: 'Plan a real event such as a book fair with a schedule, jobs, a budget and invitations.' },
  { grade: 3, theme: 'Sharing the planet', title: 'Water Saving Campaign', idea: 'Measure water used in school, find ways to save it and launch a poster and announcement campaign.' },
  { grade: 4, theme: 'Who we are', title: 'Community Heroes Interviews', idea: 'Interview people who help the community, write profiles and present them in a class exhibition.' },
  { grade: 4, theme: 'Where we are in place and time', title: 'Ancient Civilization Museum', idea: 'Groups research a civilization and build a museum corner with objects, labels and a guide script.' },
  { grade: 4, theme: 'How we express ourselves', title: 'Short Film or Radio Show', idea: 'Write a script, record a short film or radio show and hold a class premiere with feedback.' },
  { grade: 4, theme: 'How the world works', title: 'Renewable Energy Models', idea: 'Build a model wind turbine or solar oven, test it and explain the science to visitors.' },
  { grade: 4, theme: 'How we organize ourselves', title: 'Mini Business Fair', idea: 'Design a product, calculate costs and prices, advertise it and run a small fair for profit and review.' },
  { grade: 4, theme: 'Sharing the planet', title: 'Endangered Animals Action Plan', idea: 'Research one endangered animal, make an awareness campaign and a plan the school can act on.' },
];

export type UnitPlan = { id: string; title: string; grade: number | null; theme: string | null; start_date: string | null; end_date: string | null; body: string; source: 'typed' | 'photo' };

export const IB_PYP_URL = 'https://www.ibo.org/programmes/primary-years-programme/curriculum/';

// The IB's six transdisciplinary themes, with the IB's published description of each (paraphrased). Every PYP school,
// including those in Turkey, plans units under these themes for each grade; the central ideas are written by each school.
export const THEME_INFO: Record<(typeof PYP_THEMES)[number], { icon: string; description: string }> = {
  'Who we are': { icon: '🧑‍🤝‍🧑', description: 'The nature of the self; beliefs and values; personal, physical, mental, social and spiritual health; human relationships; rights and responsibilities; what it means to be human.' },
  'Where we are in place and time': { icon: '🧭', description: 'Orientation in place and time; personal histories; homes and journeys; the discoveries, explorations and migrations of humankind; how individuals and civilizations are connected, locally and globally.' },
  'How we express ourselves': { icon: '🎭', description: 'The ways we discover and express ideas, feelings, nature, culture, beliefs and values; how we reflect on, extend and enjoy our creativity; our appreciation of the aesthetic.' },
  'How the world works': { icon: '🔬', description: 'The natural world and its laws; how the natural world and human societies interact; how people use scientific principles; the impact of scientific and technological advances on society and the environment.' },
  'How we organize ourselves': { icon: '🏛️', description: 'The connections between human-made systems and communities; the structure and function of organizations; societal decision-making; economic activities and their impact on people and the environment.' },
  'Sharing the planet': { icon: '🌍', description: 'Rights and responsibilities in sharing finite resources with other people and living things; communities and the relationships within and between them; access to equal opportunities; peace and conflict resolution.' },
};

export type ProjectSuggestion = { title: string; summary: string; centralIdea: string; linesOfInquiry: string[]; activities: string[]; studentAction: string; source: 'ai' | 'starter' };

export function suggestionToText(s: ProjectSuggestion): string {
  return [s.summary, s.centralIdea && `Central idea: ${s.centralIdea}`, s.linesOfInquiry.length && `Lines of inquiry:\n${s.linesOfInquiry.map((l) => `- ${l}`).join('\n')}`, s.activities.length && `Activities:\n${s.activities.map((l) => `- ${l}`).join('\n')}`, s.studentAction && `Student action: ${s.studentAction}`].filter(Boolean).join('\n\n');
}
