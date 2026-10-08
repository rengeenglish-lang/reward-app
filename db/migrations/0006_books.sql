-- Library of reader books for the class book picker.
CREATE TABLE books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  series text NOT NULL,
  level text,
  cover_path text NOT NULL,
  aspect numeric(5,3) NOT NULL DEFAULT 0.8, -- cover width / height
  position integer NOT NULL UNIQUE,         -- display order
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per pick. The newest row for a class is the book it must not get again next time.
CREATE TABLE class_book_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  picked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX class_book_picks_class_idx ON class_book_picks(classroom_id, picked_at DESC);

-- "Book returned" column of the reward history.
ALTER TABLE reward_draws ADD COLUMN IF NOT EXISTS book_returned boolean NOT NULL DEFAULT false;

INSERT INTO books (title, series, level, cover_path, aspect, position) VALUES
  ('Inside Out',              'Pearson English Kids Readers', '4', '/books/inside-out.webp',              0.8, 1),
  ('Incredibles 2',           'Pearson English Kids Readers', '4', '/books/incredibles-2.webp',           0.8, 2),
  ('Brave',                   'Pearson English Kids Readers', '4', '/books/brave.webp',                   0.8, 3),
  ('Toy Story 3',             'Pearson English Kids Readers', '4', '/books/toy-story-3.webp',             0.8, 4),
  ('Moana',                   'Pearson English Kids Readers', '4', '/books/moana.webp',                   0.8, 5),
  ('The Lion King',           'Pearson English Kids Readers', '4', '/books/the-lion-king.webp',           0.8, 6),
  ('The Jaguar and the Cow',  'The Thinking Train (Helbling)', 'E', '/books/the-jaguar-and-the-cow.webp', 1.0, 7),
  ('Survival',                'The Thinking Train (Helbling)', 'F', '/books/survival.webp',               1.0, 8),
  ('The Sick Dragon',         'The Thinking Train (Helbling)', 'E', '/books/the-sick-dragon.webp',        1.0, 9),
  ('Unreal School',           'The Thinking Train (Helbling)', 'F', '/books/unreal-school.webp',          1.0, 10),
  ('The Desert Race',         'The Thinking Train (Helbling)', 'D', '/books/the-desert-race.webp',        1.0, 11);
