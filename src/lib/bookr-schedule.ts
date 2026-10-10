export type BookrWeek = { week: number; unit: string; books: string[] };

// Cambridge Primary Path 3, Grade 4 scope and sequence (BOOKR column). Weeks 1–40 transcribed from
// the supplied spreadsheet. Weeks 10, 20, 30 and 40 are marked tatil (holiday) in the source.
export const bookrWeeks: BookrWeek[] = [
  { week: 1, unit: 'Unit 1 - What makes your community', books: ['Class 3B’s Dreams', 'The Princess and the Peanut Allergy', 'Olin’s Secret'] },
  { week: 2, unit: 'Unit 1 - What makes your community', books: ['Bugs In My Hair', 'Guess Who!', 'Lazybones'] },
  { week: 3, unit: 'Unit 1 - What makes your community', books: ['It Looks Terrible - American', 'Twins, Tidy Up!', 'Operation Photobomb'] },
  { week: 4, unit: 'Unit 1 - What makes your community', books: ['Custard the Wibbly Wobbly Dinosaur', 'Janine', 'What Makes Friendship Grow? 1. - The New Teacher'] },
  { week: 5, unit: 'Unit 2 - What is food for?', books: ['Little King Boggen', 'Monster Lunch', 'Monster Lunch (F)'] },
  { week: 6, unit: 'Unit 2 - What is food for?', books: ['Drat That Fat Cat', 'Shante Keys and the New Year’s Peas', 'The Nian Monster'] },
  { week: 7, unit: 'Unit 2 - What is food for?', books: ['Goal 2: Food for Everyone', 'What Makes Friendship Grow? 10. - Hacker Harry', 'Clunk’s New Job'] },
  { week: 8, unit: 'Unit 2 - What is food for?', books: ['Arty Words Part III', 'The Great Big Turnip', 'Chocolate Life'] },
  { week: 9, unit: 'Unit 3 - Why do we need to take care of nature?', books: ['Dodo', 'The Caterpillar That Got Stuck in a Tree', 'Dodo (F)'] },
  { week: 10, unit: 'Holiday (tatil)', books: ['Dario and the Whale', 'Olga’s Story', 'The Purple Poodle in the Attic'] },
  { week: 11, unit: 'Unit 3 - Why do we need to take care of nature?', books: ['What’s in the Garden?', 'What Makes Friendship Grow? 17. - Not Funny!', 'What’s in the Garden? (F)'] },
  { week: 12, unit: 'Unit 3 - Why do we need to take care of nature?', books: ['A Violet in Danger', 'The Boy Who Cried Wolf', 'A Car’s Day'] },
  { week: 13, unit: 'Unit 3 - Why do we need to take care of nature?', books: ['Deep in the Forest', 'Little Panda', 'Ahu and Moai'] },
  { week: 14, unit: 'Unit 4 - What is art?', books: ['Housework My Way', 'My Aunt’s Cats', 'A Polka Dot Day'] },
  { week: 15, unit: 'Unit 4 - What is art?', books: ['How Do You Spend A Day?', 'What Makes Friendship Grow? 2. - What Makes a Friend?', 'Lost and Found'] },
  { week: 16, unit: 'Unit 4 - What is art?', books: ['How Much or How Many?', 'Whose Bedroom is the Best?', 'Colors of Art (F)'] },
  { week: 17, unit: 'Unit 4 - What is art?', books: ['Why Don’t You Come Back?', 'Lottie Loves Music - American', 'Dilly the Pet Dinosaur'] },
  { week: 18, unit: 'Unit 5 - Why do we travel?', books: ['Gadgets at Home', 'Arlo and the Hole', 'Let’s Go Green!'] },
  { week: 19, unit: 'Unit 5 - Why do we travel?', books: ['I’m Moving', 'What Makes Friendship Grow? 3. - Franky Has a Dirty Mouth', 'Dinosaur in Sydney'] },
  { week: 20, unit: 'Holiday (tatil)', books: ['An Evening in the Country', 'Bob’s Tales XIX - A Message in a Bottle', 'Bob’s Tales XVI - The Sad Foal'] },
  { week: 21, unit: 'Unit 5 - Why do we travel?', books: ['Bob’s Tales XVII - Bob Meets a Spider', 'A Day at the Beach', 'Where’s Home?'] },
  { week: 22, unit: 'Unit 5 - Why do we travel?', books: ['Gordon from Boston', 'The Green Octopus in My Bedroom', 'Who Lives Here'] },
  { week: 23, unit: 'Unit 6 - Why do we play sports?', books: ['Meet Viktor', 'The Final Minutes', 'Dirty Hands'] },
  { week: 24, unit: 'Unit 6 - Why do we play sports?', books: ['Teach Your Giraffe to Ski', 'What Makes Friendship Grow? 4. - At the Police Station', 'Esther’s Stress'] },
  { week: 25, unit: 'Unit 6 - Why do we play sports?', books: ['The ’Get well soon!’ Party', 'What Makes Friendship Grow? 9. - The Missing Football Bag', 'Me on Monday'] },
  { week: 26, unit: 'Unit 6 - Why do we play sports?', books: ['The Blue Dove at the Balcony', 'Anybody’s Game', 'Let’s Do Something!'] },
  { week: 27, unit: 'Unit 7 - How can we explore the past?', books: ['Bob’s Tales XXI - When the Brave Ones Are Afraid', 'Bob’s Tales XXII - Looking for Bear Traps', 'Mission 001'] },
  { week: 28, unit: 'Unit 7 - How can we explore the past?', books: ['Bob’s Tales XXIV - The Big, Brave Dogs', 'Charles Darwin', 'Little Red Baseball Cap'] },
  { week: 29, unit: 'Unit 7 - How can we explore the past?', books: ['Bob’s Tales XXIX I Know What I Said', 'Frog in the Fog', 'Lord Bao and the Stone'] },
  { week: 30, unit: 'Holiday (tatil)', books: ['Bob’s Tales XXV Captain Chaos', 'Bob’s Tales XXVI Jasper and the Flowerpot', 'The Deep Sleep'] },
  { week: 31, unit: 'Unit 7 - How can we explore the past?', books: ['Once I Was Famous', 'Pastry War', 'The Ugly Duckling'] },
  { week: 32, unit: 'Unit 8 - How important is electricity?', books: ['Goal 1: No Poverty', 'The Magic World of Vehicles', 'Way Past Sad'] },
  { week: 33, unit: 'Unit 8 - How important is electricity?', books: ['Goal 7: Green Energy for the World', 'The Magic World of Dinosaurs', 'What Makes Friendship Grow? 5. - Ed Elephant'] },
  { week: 34, unit: 'Unit 8 - How important is electricity?', books: ['History of a Bright Family', 'Renewable Rangers', 'Fall in the Country'] },
  { week: 35, unit: 'Unit 8 - How important is electricity?', books: ['Bed in Summer', 'Bring Your Pet to School Day', 'Fire!'] },
  { week: 36, unit: 'Unit 9 - Why do we have music?', books: ['What Do You Want to Be?', 'A Frog’s Life', 'Hamster Hunt'] },
  { week: 37, unit: 'Unit 9 - Why do we have music?', books: ['What Makes Friendship Grow? 6. - The Fight', 'An Albatross in the Sky', 'Cactus Home'] },
  { week: 38, unit: 'Unit 9 - Why do we have music?', books: ['What Makes Friendship Grow? 8. - I Want to Be a Hero Again', 'Anton’s New Friend', 'Friends Forever'] },
  { week: 39, unit: 'Unit 9 - Why do we have music?', books: ['Sam’s Secret Birthday', 'Cats Rule!', 'Grumpy Pants'] },
  { week: 40, unit: 'Holiday (tatil)', books: ['Bob’s Tales XXVII The Terrible Smell', 'Bob’s Tales XXVIII Let’s Stop Mike Meerkat!', 'Goldilocks and the Three Bears'] },
];

const DAY = 86400000;

export function toDateInput(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Most recent Friday on or before the given day, as a local-date input value. */
export function latestFriday(from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 2) % 7));
  return toDateInput(d);
}

/** Friday on which a week's books are issued: week 1 on the start Friday, then one week apart. */
export function issueDate(startFriday: string, week: number): Date {
  const [y, m, d] = startFriday.split('-').map(Number);
  return new Date(y, m - 1, d + (week - 1) * 7);
}

export function isIssued(startFriday: string, week: number, now = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((today - issueDate(startFriday, week).getTime()) / DAY) >= 0;
}
